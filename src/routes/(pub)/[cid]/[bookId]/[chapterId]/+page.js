export async function load({ data }) {
  // data 来自 +page.server.js，包含 titleZh, chapterZh（从 D1 加载）
  const { titleZh, chapterZh } = data;
  return { titleZh, chapterZh };
}
