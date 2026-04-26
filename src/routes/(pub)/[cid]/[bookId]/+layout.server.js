export async function load({ params: { bookId }, parent }) {
  const { books } = await parent();
  const book = books.find((b) => b.book_id === Number(bookId));

  return { books, book };
}
