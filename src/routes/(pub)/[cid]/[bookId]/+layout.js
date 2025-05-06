import { PUBLIC_R2 } from '$env/static/public';
import sda from "$lib/sda.json";

async function getBookDir(fetch, cid, bookId, lang) {
  const res = await fetch(`${PUBLIC_R2}/${cid}/${lang}/${bookId}.json`)
  return res.json()
}

export async function load({ fetch, params: { cid, bookId } }) {
  let book;

  switch (cid) {
    case 'sda':
      book = sda.find(i => i.id == bookId)
      break;

    default:
      break;
  }

  const dirZh = await getBookDir(fetch, cid, bookId, 'zh');

  return { book, dirZh }
}