import { browser } from "$app/environment";

export async function load({ parent, params: { cid, bookId, chapterId } }) {
  let titleZh, chapterZh;

  if (!browser) {
    return { titleZh, chapterZh };
  }
  const { dirZh } = await parent();

  const chapterData = dirZh[chapterId - 1];

  if (cid === "bible") {
    titleZh = chapterData.id;
    chapterZh = chapterData.verses;
  } else if (cid === "book") {
    titleZh = chapterData.n;
    chapterZh = chapterData.ps;
  } else {
    titleZh = chapterData.n;
    chapterZh = chapterData.ps;
  }

  return { titleZh, chapterZh };
}
