// place files you want to import through the `$lib` alias in this folder.
export function showId(id, block = 'center', inline = 'center') {
  // 'start'（顶部）、'center'（居中）、'end'（底部）、'nearest'（最近）
  setTimeout(() => {
    const element = document.getElementById(id);
    // console.log(id, element);
    if (element) {
      element.scrollIntoView({
        block,
        inline,
        behavior: "smooth",
      });
    }
  }, 0);
}