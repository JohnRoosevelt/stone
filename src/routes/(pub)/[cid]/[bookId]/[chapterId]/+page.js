export async function load({ parent, params: { chapterId } }) {
  const { chapters } = await parent();
  const chapter = chapters[chapterId - 1];
  // console.log({ chapter, chapterId, chapters });
  return { title: chapter?.n, sections: chapter?.ps ?? [] };
}
