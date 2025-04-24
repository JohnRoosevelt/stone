// place files you want to import through the `$lib` alias in this folder.
export function showId(id, block = 'center', inline = 'center') {
  // 'start'（顶部）、'center'（居中）、'end'（底部）、'nearest'（最近）, 
  //  block -> y,   inline -> x

  setTimeout(() => {
    const element = document.getElementById(id);
    // console.log({ id, element, block, inline });
    if (element) {
      element.scrollIntoView({
        block,
        inline,
        behavior: "smooth",
      });
    }
  }, 0);
}

export async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}