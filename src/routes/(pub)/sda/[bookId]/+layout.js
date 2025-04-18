import { PUBLIC_R2 } from '$env/static/public';
import books from "$lib/sda.json";

export async function load({ parent, fetch, params: { bookId } }) {  
  const book = books.find(i => i.id == bookId)

  async function getBookDir(bookId, lang) {
    const res = await fetch(`${PUBLIC_R2}/sda/${lang}/${bookId}.json`)
    return res.json()
  }

  const [dirEn, dirZh ] = await Promise.all([
    getBookDir(bookId, 'en'),
    getBookDir(bookId, 'zh'),
  ])
  
  return { bookId, book, dirEn, dirZh }
}