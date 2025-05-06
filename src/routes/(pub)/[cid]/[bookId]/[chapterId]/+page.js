export async function load({ parent, params: { chapterId } }) {
  const {dirEn, dirZh} = await parent()
  const {n: titleEn, ps: chapterEn} = dirEn[chapterId -1]
  const {n: titleZh, ps: chapterZh} = dirZh[chapterId -1]
  
  return { chapterId, titleEn, chapterEn, titleZh, chapterZh }
}