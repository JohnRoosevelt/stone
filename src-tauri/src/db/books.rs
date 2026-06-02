//! Book / chapter / paragraph CRUD and initial-import helpers.

use rusqlite::{params, Connection, Result};

use super::models::{Book, Chapter, FullChapter, Paragraph};

/// Get all books for a given language, optionally filtered by CID
pub fn get_books(conn: &Connection, lang: &str, cid: Option<i64>) -> Result<Vec<Book>> {
    let mut sql = String::from(
        "SELECT i.cid, i.book_id, i.name, i.title, i.abbreviation, b.section, b.featured
         FROM book_i18n i
         JOIN book_base b ON i.cid = b.cid AND i.book_id = b.book_id
         WHERE i.lang_code = ?1",
    );
    if cid.is_some() {
        sql.push_str(" AND i.cid = ?2");
    }
    sql.push_str(" ORDER BY i.cid, i.book_id");

    let mut stmt = conn.prepare(&sql)?;

    // Use dynamic params to avoid closure type mismatch
    let params: Vec<Box<dyn rusqlite::types::ToSql>> = if let Some(cid_val) = cid {
        vec![Box::new(lang.to_string()), Box::new(cid_val)]
    } else {
        vec![Box::new(lang.to_string())]
    };
    let params_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let rows = stmt.query_map(params_refs.as_slice(), |row| {
        Ok(Book {
            cid: row.get(0)?,
            book_id: row.get(1)?,
            name: row.get(2)?,
            title: row.get(3)?,
            abbreviation: row.get(4)?,
            section: row.get(5)?,
            featured: row.get(6)?,
        })
    })?;

    let mut books = Vec::new();
    for row in rows {
        books.push(row?);
    }
    Ok(books)
}

/// Get chapters for a given book
pub fn get_chapters(conn: &Connection, cid: i64, book_id: i64, lang: &str) -> Result<Vec<Chapter>> {
    let mut stmt = conn.prepare(
        "SELECT chapter_id, title
         FROM chapters
         WHERE cid = ?1 AND book_id = ?2 AND lang_code = ?3
         ORDER BY chapter_id",
    )?;

    let rows = stmt.query_map(params![cid, book_id, lang], |row| {
        Ok(Chapter {
            chapter_id: row.get(0)?,
            title: row.get(1)?,
        })
    })?;

    let mut chapters = Vec::new();
    for row in rows {
        chapters.push(row?);
    }
    Ok(chapters)
}

/// Get paragraphs for a given chapter
pub fn get_paragraphs(
    conn: &Connection,
    cid: i64,
    book_id: i64,
    chapter_id: i64,
    lang: &str,
) -> Result<Vec<Paragraph>> {
    let mut stmt = conn.prepare(
        "SELECT id, num, text_content, format
         FROM chapter_paragraphs
         WHERE cid = ?1 AND book_id = ?2 AND chapter_id = ?3 AND lang_code = ?4
         ORDER BY id",
    )?;

    let rows = stmt.query_map(params![cid, book_id, chapter_id, lang], |row| {
        Ok(Paragraph {
            id: row.get(0)?,
            num: row.get(1)?,
            text_content: row.get(2)?,
            format: row.get(3)?,
        })
    })?;

    let mut paragraphs = Vec::new();
    for row in rows {
        paragraphs.push(row?);
    }
    Ok(paragraphs)
}

/// Get the full book content (chapters + paragraphs) in the same format as R2 parquet
pub fn get_full_book(
    conn: &Connection,
    cid: i64,
    book_id: i64,
    lang: &str,
) -> Result<Vec<FullChapter>> {
    let mut ch_stmt = conn.prepare(
        "SELECT chapter_id, title FROM chapters WHERE cid=?1 AND book_id=?2 AND lang_code=?3 ORDER BY chapter_id"
    )?;
    let ch_rows = ch_stmt.query_map(params![cid, book_id, lang], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
    })?;

    let mut chapters = Vec::new();
    for ch in ch_rows {
        let (ch_id, title) = ch?;
        let mut p_stmt = conn.prepare(
            "SELECT id, num, text_content, format FROM chapter_paragraphs WHERE cid=?1 AND book_id=?2 AND chapter_id=?3 AND lang_code=?4 ORDER BY id"
        )?;
        let p_rows = p_stmt.query_map(params![cid, book_id, ch_id, lang], |row| {
            Ok(super::models::FullParagraph {
                c: row.get::<_, String>(2)?,
                p: row.get::<_, Option<i64>>(1)?,
                t: row.get::<_, Option<i64>>(3)?,
            })
        })?;
        let mut ps = Vec::new();
        for p in p_rows {
            ps.push(p?);
        }
        chapters.push(FullChapter { n: title, ps });
    }
    Ok(chapters)
}

/// Save pre-parsed chapter data from the frontend to SQLite.
/// When append=false, old data is cleared before writing.
/// start_chapter_id: chapter ID offset for chunked imports.
pub fn save_book(
    conn: &Connection,
    cid: i64,
    book_id: i64,
    lang: &str,
    chapters: Vec<FullChapter>,
    append: bool,
    start_chapter_id: i64,
) -> Result<(i64, i64), String> {
    if !append {
        conn.execute(
            "DELETE FROM chapter_paragraphs WHERE cid=?1 AND book_id=?2 AND lang_code=?3",
            params![cid, book_id, lang],
        )
        .map_err(|e| format!("delete cp: {e}"))?;
        conn.execute(
            "DELETE FROM chapters WHERE cid=?1 AND book_id=?2 AND lang_code=?3",
            params![cid, book_id, lang],
        )
        .map_err(|e| format!("delete ch: {e}"))?;
    }

    let mut ch_count = 0i64;
    let mut p_count = 0i64;
    for (idx, ch) in chapters.iter().enumerate() {
        let chapter_id = start_chapter_id + idx as i64;
        conn.execute(
            "INSERT OR REPLACE INTO chapters (cid,book_id,chapter_id,lang_code,title) VALUES (?1,?2,?3,?4,?5)",
            params![cid, book_id, chapter_id, lang, &ch.n],
        ).map_err(|e| format!("insert ch: {e}"))?;
        ch_count += 1;
        for (i, p) in ch.ps.iter().enumerate() {
            conn.execute(
                "INSERT OR REPLACE INTO chapter_paragraphs (cid,book_id,chapter_id,id,num,lang_code,text_content,format) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
                params![cid, book_id, chapter_id, (i + 1) as i64, p.p, lang, &p.c, p.t],
            ).map_err(|e| format!("insert cp: {e}"))?;
            p_count += 1;
        }
    }
    Ok((ch_count, p_count))
}

/// Check whether a book has chapter data in the local database
pub fn has_book_data(conn: &Connection, cid: i64, book_id: i64, lang: &str) -> Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM chapters WHERE cid=?1 AND book_id=?2 AND lang_code=?3",
        params![cid, book_id, lang],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

/// Delete a book's local data (paragraphs + chapters)
pub fn delete_book_data(
    conn: &Connection,
    cid: i64,
    book_id: i64,
    lang: &str,
) -> Result<(), String> {
    conn.execute(
        "DELETE FROM chapter_paragraphs WHERE cid=?1 AND book_id=?2 AND lang_code=?3",
        params![cid, book_id, lang],
    )
    .map_err(|e| format!("e: {e}"))?;
    conn.execute(
        "DELETE FROM chapters WHERE cid=?1 AND book_id=?2 AND lang_code=?3",
        params![cid, book_id, lang],
    )
    .map_err(|e| format!("e: {e}"))?;
    Ok(())
}

/// Check whether the initial import needs to run.
///
/// Returns true when:
/// - book_base has metadata (seed completed), AND
/// - `initial_import_done` flag is NOT set to "1".
///
/// This means it will also return true after a crash mid-import
/// (partially imported books + flag still "0"), allowing the
/// first-launch UI to resume and fill in the gaps.
pub fn needs_initial_import(conn: &Connection) -> Result<bool> {
    let has_books: i64 = conn
        .query_row("SELECT COUNT(*) FROM book_base", [], |row| row.get(0))
        .unwrap_or(0);
    if has_books == 0 {
        return Ok(false);
    }
    // Only skip if the flag is explicitly "1" (fully done)
    let flag: String = conn
        .query_row(
            "SELECT value FROM app_flags WHERE key='initial_import_done'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_default();
    Ok(flag != "1")
}

/// Mark initial import as completed
pub fn mark_import_complete(conn: &Connection) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO app_flags (key, value) VALUES ('initial_import_done', '1')",
        [],
    )?;
    Ok(())
}

/// Reset the initial-import flag so the first-launch UI triggers again.
pub fn reset_import_flag(conn: &Connection) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO app_flags (key, value) VALUES ('initial_import_done', '0')",
        [],
    )?;
    Ok(())
}

/// Get all book IDs that already have chapter data for a given language.
/// Used by the first-launch UI to skip already-imported books.
pub fn get_imported_book_ids(conn: &Connection, lang: &str) -> Result<Vec<(i64, i64)>> {
    let mut stmt = conn.prepare("SELECT DISTINCT cid, book_id FROM chapters WHERE lang_code=?1")?;
    let rows = stmt.query_map(params![lang], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
    })?;
    let mut result = Vec::new();
    for r in rows {
        result.push(r?);
    }
    Ok(result)
}

/// Get book list for initial import (all books regardless of import status).
pub fn get_all_books_for_import(conn: &Connection, lang: &str) -> Result<Vec<(i64, i64, String)>> {
    let mut stmt = conn.prepare(
        "SELECT bb.cid, bb.book_id, bi.name
         FROM book_base bb
         JOIN book_i18n bi ON bi.cid = bb.cid AND bi.book_id = bb.book_id
         WHERE bi.lang_code = ?1
         ORDER BY bb.cid, bb.book_id",
    )?;
    let rows = stmt.query_map(params![lang], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;
    let mut result = Vec::new();
    for r in rows {
        result.push(r?);
    }
    Ok(result)
}

/// Get the database file size in bytes
pub fn get_db_size(db_path: &std::path::Path) -> Result<u64, String> {
    std::fs::metadata(db_path)
        .map(|m| m.len())
        .map_err(|e| format!("{e}"))
}

/// Format file size as a human-readable string
pub fn format_size(bytes: u64) -> String {
    if bytes < 1024 {
        return format!("{bytes} B");
    }
    let kb = bytes as f64 / 1024.0;
    if kb < 1024.0 {
        return format!("{:.1} KB", kb);
    }
    let mb = kb / 1024.0;
    format!("{:.1} MB", mb)
}
