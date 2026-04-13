// This page has dynamic data. SSR enabled, no prerender.
// Data is loaded from local SQLite if cached, otherwise from R2.
export const prerender = false;

import { PUBLIC_R2 } from "$env/static/public";
import sda from "$lib/sda/sda.json";
import bible from "$lib/bible/bible.json";
import books from "$lib/book/book.json";

function getBookMeta(cid, bookId) {
  const all = { bible, sda, book: books };
  return (all[cid] || []).find((b) => b.id == bookId);
}

async function fetchBookDir(fetchFn, cid, bookId) {
  const res = await fetchFn(`${PUBLIC_R2}/${cid}/zh/${bookId}.json`);
  return res.json();
}

export async function load({
  fetch,
  parent,
  params: { cid, bookId, chapterId },
}) {
  const { dirZh: _ } = await parent();

  let titleZh, chapterZh;

  // Always fetch from R2 (SSR compatible)
  const dirZh = await fetchBookDir(fetch, cid, bookId);
  const chapterData = dirZh[chapterId - 1];

  if (cid === "bible") {
    titleZh = chapterData.id;
    chapterZh = chapterData.verses;
  } else {
    titleZh = chapterData.n;
    chapterZh = chapterData.ps;
  }

  // Seed to local DB in background (client-side only, non-blocking)
  if (typeof window !== "undefined") {
    const { seedBook } = await import("$lib/db/dbManager.js");
    const bookMeta = getBookMeta(cid, bookId);
    const chapters = dirZh.map((ch, idx) => ({
      chapterId: idx + 1,
      title: cid === "bible" ? ch.id : ch.n,
      content:
        cid === "bible"
          ? JSON.stringify({ verses: ch.verses || [] })
          : JSON.stringify({ ps: ch.ps || [] }),
    }));
    seedBook(
      cid,
      bookId,
      bookMeta?.name || "",
      bookMeta?.tag || "",
      chapters,
    ).catch(() => {});
  }

  return { titleZh, chapterZh, fromCache: false };
}
