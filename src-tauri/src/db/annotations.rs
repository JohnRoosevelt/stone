//! Text annotations (underline, wavy underline, background, text color).
//!
//! `replace_annotation` is the dedup path used by LongpressCtrl.saveHighlight —
//! see the doc comment on the function for the transactional contract.

use rusqlite::{params, Connection};

use super::models::Annotation;

pub fn save_annotation(conn: &Connection, ann: &Annotation) -> Result<i64, String> {
    let sql = "INSERT INTO annotations (cid, book_id, chapter_id, lang_code, p_index, start_offset, length, text, ann_type, color)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)";
    conn.execute(
        sql,
        params![
            ann.cid,
            ann.book_id,
            ann.chapter_id,
            ann.lang_code,
            ann.p_index,
            ann.start_offset,
            ann.length,
            ann.text,
            ann.ann_type,
            ann.color
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

/// Atomically replace any annotation at the same (p_index, start_offset, length)
/// in the same chapter with the new one. Returns the new row id. This is the
/// path LongpressCtrl uses to save — it guarantees that two consecutive
/// "mark this same span" actions (whether the UI thinks it's a "new" or a
/// "type-change") can't produce duplicate rows.
pub fn replace_annotation(conn: &Connection, ann: &Annotation) -> Result<i64, String> {
    let tx = conn
        .unchecked_transaction()
        .map_err(|e| e.to_string())?;
    tx.execute(
        "DELETE FROM annotations
         WHERE cid=?1 AND book_id=?2 AND chapter_id=?3 AND lang_code=?4
           AND p_index=?5 AND start_offset=?6 AND length=?7",
        params![
            ann.cid,
            ann.book_id,
            ann.chapter_id,
            ann.lang_code,
            ann.p_index,
            ann.start_offset,
            ann.length
        ],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT INTO annotations (cid, book_id, chapter_id, lang_code, p_index, start_offset, length, text, ann_type, color)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            ann.cid,
            ann.book_id,
            ann.chapter_id,
            ann.lang_code,
            ann.p_index,
            ann.start_offset,
            ann.length,
            ann.text,
            ann.ann_type,
            ann.color
        ],
    )
    .map_err(|e| e.to_string())?;
    let id = tx.last_insert_rowid();
    tx.commit().map_err(|e| e.to_string())?;
    Ok(id)
}

pub fn delete_annotation(conn: &Connection, id: i64) -> Result<(), String> {
    conn.execute("DELETE FROM annotations WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Wipe all annotations. Returns the number of rows removed.
pub fn clear_annotations(conn: &Connection) -> Result<usize, String> {
    let n = conn
        .execute("DELETE FROM annotations", [])
        .map_err(|e| e.to_string())?;
    Ok(n)
}

pub fn get_annotations(
    conn: &Connection,
    cid: i64,
    book_id: i64,
    chapter_id: i64,
    lang_code: &str,
) -> Result<Vec<Annotation>, String> {
    let sql = "SELECT id, cid, book_id, chapter_id, lang_code, p_index, start_offset, length, text, ann_type, color, created_at
               FROM annotations
               WHERE cid = ?1 AND book_id = ?2 AND chapter_id = ?3 AND lang_code = ?4
               ORDER BY id";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![cid, book_id, chapter_id, lang_code], |row| {
            Ok(Annotation {
                id: Some(row.get(0)?),
                cid: row.get(1)?,
                book_id: row.get(2)?,
                chapter_id: row.get(3)?,
                lang_code: row.get(4)?,
                p_index: row.get(5)?,
                start_offset: row.get(6)?,
                length: row.get(7)?,
                text: row.get(8)?,
                ann_type: row.get(9)?,
                color: row.get(10)?,
                created_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}
