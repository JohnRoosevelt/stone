import { loadParquetContent } from "$lib/parquet";
import { listBooks, listChapters } from "$lib/admin/api";

const CID_TO_TYPE = { 0: "bible", 1: "sda", 2: "book" };
const CID_LABEL = { 0: "圣经", 1: "怀著", 2: "书籍" };

// 并发写入的最大书籍数（D1 Free 限制 5 并发连接，留一些余量）
const CONCURRENCY = 1;

/**
 * 对一本书的数据进行批处理导入（一次 HTTP 请求 + 一次 D1 batch）
 */
async function importBook({ cid, book, lang, log }) {
  const start = Date.now();

  // 1. 下载并解析 R2 Parquet 数据
  const r2Data = await loadParquetContent({
    cid: CID_TO_TYPE[cid],
    lang,
    bookId: book.book_id,
  });
  if (!r2Data || r2Data.length === 0) {
    log(`  📖 ${book.name} → ⏭️ R2 无数据`);
    return { chapters: 0, paragraphs: 0 };
  }

  // 2. 查询 D1 中已有的章节，跳过已同步的
  const existing = await listChapters({
    cid,
    book_id: book.book_id,
    lang_code: lang,
  }).catch(() => []);
  const existingIds = new Set(
    (Array.isArray(existing) ? existing : []).map((c) => c.chapter_id),
  );

  // 3. 组装待写入的章节和段落数据
  const chaptersPayload = [];
  let totalParagraphs = 0;

  for (let i = 0; i < r2Data.length; i++) {
    const ch = r2Data[i];
    const chapter_id = i + 1;
    if (existingIds.has(chapter_id)) continue;

    const title = ch.n || String(chapter_id);
    const items = ch.verses || ch.ps || [];

    const paragraphs = items.map((item, j) => ({
      id: j + 1,
      num: item.p != null ? Number(item.p) : null,
      text_content: item.c || item.o || "_",
      format: item.t ?? null,
    }));

    chaptersPayload.push({
      cid,
      book_id: book.book_id,
      chapter_id,
      title,
      paragraphs,
    });
    totalParagraphs += paragraphs.length;
  }

  // 4. 没有新数据就直接返回
  if (chaptersPayload.length === 0) {
    log(`  📖 ${book.name} → ⏭️ 全部已同步 (${r2Data.length} 章)`);
    return { chapters: 0, paragraphs: 0 };
  }

  // 5. 一次批量写入 D1
  const res = await fetch("/api/admin/batch-import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lang_code: lang, chapters: chaptersPayload }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const result = await res.json();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  log(
    `  📖 ${book.name} → ✅ ${result.chapters} 章 ${result.paragraphs} 段 (${elapsed}s)`,
  );
  return { chapters: result.chapters, paragraphs: result.paragraphs };
}

/**
 * @param {object} options
 * @param {string}  options.lang        - 语言代码，默认 "zh"
 * @param {(msg: string) => void} options.onProgress - 进度回调
 * @returns {Promise<{books: number, chapters: number, paragraphs: number}>}
 */
export async function importAllToD1({ lang = "zh", onProgress } = {}) {
  const log = onProgress || (() => {});
  const CIDS = [0, 1, 2];
  const total = { books: 0, chapters: 0, paragraphs: 0 };

  log("🔄 开始批量导入...");

  // 统计总书籍数
  let totalBooks = 0;
  for (const cid of CIDS) {
    const books = await listBooks({ cid, lang, q: "" }).catch(() => []);
    totalBooks += Array.isArray(books) ? books.length : 0;
  }
  log(`📊 共 ${totalBooks} 本书`);

  for (const cid of CIDS) {
    log(`\n📂 [${CID_LABEL[cid]}] 查询书籍列表...`);
    const books = await listBooks({ cid, lang, q: "" }).catch(() => []);
    if (!Array.isArray(books) || books.length === 0) {
      log(`  ⏭️ 无书籍`);
      continue;
    }
    log(`  📚 共 ${books.length} 本书`);

    // 用有限并发同时处理多本书
    for (let i = 0; i < books.length; i += CONCURRENCY) {
      const batch = books.slice(i, i + CONCURRENCY);
      const tasks = batch.map((book) =>
        importBook({ cid, book, lang, log }).catch((e) => {
          log(`  📖 ${book.name} → ❌ ${e.message}`);
          return { chapters: 0, paragraphs: 0 };
        }),
      );

      // 等待这一批全部完成后再进入下一批
      const results = await Promise.all(tasks);
      for (const r of results) {
        total.books++;
        total.chapters += r.chapters;
        total.paragraphs += r.paragraphs;
      }
    }
  }

  log(
    `\n🎉 全部导入完成！共 ${total.books} 本书、${total.chapters} 章、${total.paragraphs} 段`,
  );
  return total;
}
