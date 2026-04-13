// Seed utility - fetches book data from R2 and stores in local SQLite
import { PUBLIC_R2 } from "$env/static/public";
import sda from "$lib/sda/sda.json";
import bible from "$lib/bible/bible.json";
import books from "$lib/book/book.json";

/**
 * Get book metadata by cid and bookId
 */
function getBookMeta(cid, bookId) {
  const allBooks = { bible, sda, book };
  return (allBooks[cid] || []).find((b) => b.id == bookId);
}

/**
 * Fetch book directory from R2
 */
async function fetchBookDir(fetch, cid, bookId, lang = "zh") {
  const res = await fetch(`${PUBLIC_R2}/${cid}/${lang}/${bookId}.json`);
  if (!res.ok) throw new Error(`Failed to fetch ${cid}/${bookId}`);
  return res.json();
}

/**
 * Seed a single book into local DB
 */
export async function seedBookToDB(fetch, cid, bookId, onProgress = null) {
  const { default: db } = await import("$lib/db/dbManager.js");

  // Check if already cached
  const cached = await db.isBookCached(cid, bookId);
  if (cached) {
    console.log(`[Seed] ${cid}/${bookId} already cached`);
    return;
  }

  // Fetch book data
  const bookMeta = getBookMeta(cid, bookId);
  const dirZh = await fetchBookDir(fetch, cid, bookId);

  // Transform chapters into flat array
  const chapters = dirZh.map((ch, idx) => {
    let title, content;

    if (cid === "bible") {
      title = ch.id;
      content = JSON.stringify({ verses: ch.verses || [] });
    } else {
      title = ch.n;
      content = JSON.stringify({ ps: ch.ps || [] });
    }

    return {
      chapterId: idx + 1,
      title,
      content,
    };
  });

  // Send to worker for seeding
  await db.seedBook(cid, bookId, bookMeta?.name || "", bookMeta?.tag || "", chapters);
  console.log(`[Seed] ${cid}/${bookId} seeded with ${chapters.length} chapters`);

  if (onProgress) onProgress({ cid, bookId, chapterCount: chapters.length });
}

/**
 * Seed all books of a cid
 */
export async function seedAllBooksOfCid(fetch, cid, onProgress = null) {
  const { default: db } = await import("$lib/db/dbManager.js");
  const allBooks = { bible, sda, book };
  const booksList = allBooks[cid] || [];

  for (const book of booksList) {
    await seedBookToDB(fetch, cid, book.id, onProgress);
  }
}
