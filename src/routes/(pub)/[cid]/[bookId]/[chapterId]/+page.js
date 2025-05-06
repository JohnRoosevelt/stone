
export async function load({ fetch, parent, params: { chapterId } }) {

  const { dirZh } = await parent()

  const { n: titleZh, ps: chapterZh } = dirZh[chapterId - 1]

  return { titleZh, chapterZh }
}