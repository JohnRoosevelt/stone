// Seed utility - fetches book data from R2 (.parquet for book, .json for others) and stores in local SQLite
import { PUBLIC_R2 } from "$env/static/public";
import sda from "$lib/sda/sda.json";
import bible from "$lib/bible/bible.json";
import bookMeta from "$lib/book/book.json";
import { loadParquetContent } from "$lib/parquet";

const BOOK_META = { bible, sda, book: bookMeta };

function getBookMeta(cid, bookId) {
  return (BOOK_META[cid] || []).find((b) => b.id == bookId);
}

async function fetchBookContent(cid, bookId) {
  if (cid === "book") {
    return loadParquetContent(cid, bookId);
  }
  const res = await fetch(`${PUBLIC_R2}/${cid}/zh/${bookId}.json`);
  return res.json();
}

export async function seedBookToDB(cid, bookId, onProgress = null) {
  const db = await import("$lib/db/dbManager.js");

  const cached = await db.isBookCached(cid, bookId);
  if (cached) {
    console.log(`[Seed] ${cid}/${bookId} already cached`);
    return;
  }

  const bookMeta = getBookMeta(cid, bookId);
  const dirZh = await fetchBookContent(cid, bookId);

  const chapters = dirZh.map((ch, idx) => {
    let title, content;

    if (cid === "bible") {
      title = ch.id;
      content = JSON.stringify({ verses: ch.verses || [] });
    } else {
      title = ch.n;
      content = JSON.stringify({ ps: ch.ps || [] });
    }

    return { chapterId: idx + 1, title, content };
  });

  await db.seedBook(cid, bookId, bookMeta?.name || "", bookMeta?.tag || "", chapters);
  console.log(`[Seed] ${cid}/${bookId} seeded with ${chapters.length} chapters`);

  if (onProgress) onProgress({ cid, bookId, chapterCount: chapters.length });
}

/**
 * Seed all books of a cid
 */
export async function seedAllBooksOfCid(cid, onProgress = null) {
  const db = await import("$lib/db/dbManager.js");
  const booksList = BOOK_META[cid] || [];

  for (const book of booksList) {
    await seedBookToDB(cid, book.id, onProgress);
  }
}
