//! Per-paragraph text annotations.
//!
//! One row per `(cid, book_id, chapter_id, lang_code, p_index)` paragraph.
//! Each row's `segments` column stores a JSON array of
//! `{start, end, style, color}` entries. A paragraph can carry multiple
//! distinct segments (e.g. two underlined words, plus a highlighted phrase),
//! and a single (start, end) range can carry multiple styles via repeated
//! entries with different `style` values.
//!
//! `save_paragraph_annotations` is an upsert keyed on the paragraph
//! composite UNIQUE — the frontend sends the *full* segments list for a
//! paragraph and the DB stores it as-is. This keeps the DB layer dumb
//! (a single store) and the merge logic in one place (the toolbar).

use rusqlite::{params, Connection};

use super::models::{AnnotationSegment, ParagraphAnnotations};

/// Upsert the segments list for one paragraph. Replaces whatever was
/// previously stored for the same (cid, book, chapter, lang, p_index).
/// Returns the row id.
pub fn save_paragraph_annotations(
    conn: &Connection,
    pa: &ParagraphAnnotations,
) -> Result<i64, String> {
    let segments_json =
        serde_json::to_string(&pa.segments).map_err(|e| e.to_string())?;
    log::info!(
        "[anno] save: cid={} book={} chapter={} lang={} p={} segments={} payload={}",
        pa.cid, pa.book_id, pa.chapter_id, pa.lang_code, pa.p_index,
        pa.segments.len(), segments_json,
    );

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| e.to_string())?;

    // UPSERT — first save inserts, subsequent saves overwrite segments.
    // ON CONFLICT requires SQLite ≥ 3.24 (universally available now).
    tx.execute(
        "INSERT INTO annotations (cid, book_id, chapter_id, lang_code, p_index, segments, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))
         ON CONFLICT(cid, book_id, chapter_id, lang_code, p_index) DO UPDATE SET
             segments = excluded.segments,
             updated_at = excluded.updated_at",
        params![
            pa.cid,
            pa.book_id,
            pa.chapter_id,
            pa.lang_code,
            pa.p_index,
            segments_json
        ],
    )
    .map_err(|e| e.to_string())?;

    let id: i64 = tx
        .query_row(
            "SELECT id FROM annotations
             WHERE cid=?1 AND book_id=?2 AND chapter_id=?3 AND lang_code=?4 AND p_index=?5",
            params![pa.cid, pa.book_id, pa.chapter_id, pa.lang_code, pa.p_index],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(id)
}

/// Fetch every paragraph's annotation row for a chapter. The frontend
/// groups by p_index and renders each segment as a DOM span.
pub fn get_paragraph_annotations(
    conn: &Connection,
    cid: i64,
    book_id: i64,
    chapter_id: i64,
    lang_code: &str,
) -> Result<Vec<ParagraphAnnotations>, String> {
    let sql = "SELECT id, cid, book_id, chapter_id, lang_code, p_index, segments, updated_at
               FROM annotations
               WHERE cid = ?1 AND book_id = ?2 AND chapter_id = ?3 AND lang_code = ?4
               ORDER BY p_index";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![cid, book_id, chapter_id, lang_code], |row| {
            let raw_segments: String = row.get(6)?;
            // Best-effort parse: corrupt/missing column → empty list rather
            // than failing the whole read. Defensive against a future schema
            // mishap or a row that somehow ended up with a non-JSON value.
            let segments: Vec<AnnotationSegment> = serde_json::from_str(&raw_segments)
                .unwrap_or_default();
            Ok(ParagraphAnnotations {
                id: Some(row.get(0)?),
                cid: row.get(1)?,
                book_id: row.get(2)?,
                chapter_id: row.get(3)?,
                lang_code: row.get(4)?,
                p_index: row.get(5)?,
                segments,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    let total_segs: usize = result.iter().map(|r| r.segments.len()).sum();
    log::info!(
        "[anno] get: cid={} book={} chapter={} lang={} rows={} total_segments={}",
        cid, book_id, chapter_id, lang_code, result.len(), total_segs,
    );
    Ok(result)
}

/// Clear all segments for one paragraph (deletes the row).
pub fn clear_paragraph_annotations(
    conn: &Connection,
    cid: i64,
    book_id: i64,
    chapter_id: i64,
    lang_code: &str,
    p_index: i64,
) -> Result<(), String> {
    let n = conn
        .execute(
            "DELETE FROM annotations
             WHERE cid=?1 AND book_id=?2 AND chapter_id=?3 AND lang_code=?4 AND p_index=?5",
            params![cid, book_id, chapter_id, lang_code, p_index],
        )
        .map_err(|e| e.to_string())?;
    log::info!(
        "[anno] clear_paragraph: cid={} book={} chapter={} lang={} p={} rows_deleted={}",
        cid, book_id, chapter_id, lang_code, p_index, n,
    );
    Ok(())
}

/// Wipe all annotations across all chapters. Returns the number of rows removed.
pub fn clear_all_annotations(conn: &Connection) -> Result<usize, String> {
    let n = conn
        .execute("DELETE FROM annotations", [])
        .map_err(|e| e.to_string())?;
    log::info!("[anno] clear_all: rows_deleted={}", n);
    Ok(n)
}
