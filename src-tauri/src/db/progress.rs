//! Per-book reading position (chapter + scroll percentage).

use rusqlite::{params, Connection};

use super::models::ReadingProgress;

pub fn save_reading_progress(conn: &Connection, rp: &ReadingProgress) -> Result<(), String> {
    let sql =
        "INSERT INTO reading_progress (cid, book_id, lang_code, chapter_id, scroll_percentage)
               VALUES (?1, ?2, ?3, ?4, ?5)
               ON CONFLICT(cid, book_id, lang_code) DO UPDATE SET
                   chapter_id = excluded.chapter_id,
                   scroll_percentage = excluded.scroll_percentage,
                   updated_at = datetime('now')";
    conn.execute(
        sql,
        params![
            rp.cid,
            rp.book_id,
            rp.lang_code,
            rp.chapter_id,
            rp.scroll_percentage
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_reading_progress(
    conn: &Connection,
    cid: i64,
    book_id: i64,
    lang_code: &str,
) -> Result<Option<ReadingProgress>, String> {
    let sql = "SELECT id, cid, book_id, lang_code, chapter_id, scroll_percentage, updated_at
               FROM reading_progress
               WHERE cid = ?1 AND book_id = ?2 AND lang_code = ?3";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map(params![cid, book_id, lang_code], |row| {
            Ok(ReadingProgress {
                id: Some(row.get(0)?),
                cid: row.get(1)?,
                book_id: row.get(2)?,
                lang_code: row.get(3)?,
                chapter_id: row.get(4)?,
                scroll_percentage: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    match rows.next() {
        Some(Ok(rp)) => Ok(Some(rp)),
        Some(Err(e)) => Err(e.to_string()),
        None => Ok(None),
    }
}

pub fn get_all_reading_progress(conn: &Connection) -> Result<Vec<ReadingProgress>, String> {
    let sql = "SELECT id, cid, book_id, lang_code, chapter_id, scroll_percentage, updated_at
               FROM reading_progress ORDER BY updated_at DESC";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(ReadingProgress {
                id: Some(row.get(0)?),
                cid: row.get(1)?,
                book_id: row.get(2)?,
                lang_code: row.get(3)?,
                chapter_id: row.get(4)?,
                scroll_percentage: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}
