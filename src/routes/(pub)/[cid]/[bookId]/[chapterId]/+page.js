// This page has dynamic data from R2, so we use SSR (server-side rendering)
// instead of prerendering. The server will render it on each request.
export const prerender = false;

export async function load({ fetch, parent, params: { cid, chapterId } }) {
  const { dirZh } = await parent();

  let titleZh, chapterZh;

  if (cid === "bible") {
    titleZh = dirZh[chapterId - 1].id;
    chapterZh = dirZh[chapterId - 1].verses;
  }

  if (cid === "sda" || cid === "book") {
    titleZh = dirZh[chapterId - 1].n;
    chapterZh = dirZh[chapterId - 1].ps;
  }

  return { titleZh, chapterZh };
}
