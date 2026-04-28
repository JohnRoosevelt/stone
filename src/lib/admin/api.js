async function request(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `API error: ${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`,
      );
    }

    // Some responses may have no body (e.g. 204 No Content)
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Invalid JSON response from ${url}`);
    }
    throw err;
  }
}

// ── Books ──────────────────────────────────────────────────────────

export async function listBooks({ cid, lang = "zh", q = "" }) {
  const params = new URLSearchParams({ cid, lang, q });
  return request(`/api/admin/books?${params}`);
}

export async function createBook(data) {
  return request("/api/admin/books", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateBook(data) {
  return request("/api/admin/books", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteBook({ cid, book_id }) {
  return request("/api/admin/books", {
    method: "DELETE",
    body: JSON.stringify({ cid, book_id }),
  });
}

// ── Chapters ───────────────────────────────────────────────────────

export async function listChapters({ cid, book_id, lang_code = "zh" }) {
  const params = new URLSearchParams({ cid, book_id, lang_code });
  return request(`/api/admin/chapters?${params}`);
}

export async function createChapter(data) {
  return request("/api/admin/chapters", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateChapter(data) {
  return request("/api/admin/chapters", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteChapter(data) {
  return request("/api/admin/chapters", {
    method: "DELETE",
    body: JSON.stringify(data),
  });
}

// ── Paragraphs ─────────────────────────────────────────────────────

export async function listParagraphs({ chapter_id }) {
  const params = new URLSearchParams({ chapter_id });
  return request(`/api/admin/paragraphs?${params}`);
}

export async function createParagraph(data) {
  return request("/api/admin/paragraphs", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateParagraph(data) {
  return request("/api/admin/paragraphs", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteParagraph(data) {
  return request("/api/admin/paragraphs", {
    method: "DELETE",
    body: JSON.stringify(data),
  });
}
