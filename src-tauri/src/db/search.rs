//! Search: CJK uses LIKE; non-CJK uses FTS5.
//!
//! Both paths return paginated results + total count for the same query.

use rusqlite::{Connection, Result};

use super::models::SearchResult;

/// Check whether the query string contains CJK characters.
fn has_cjk(s: &str) -> bool {
    s.chars().any(|c| {
        let cp = c as u32;
        (cp >= 0x4E00 && cp <= 0x9FFF)
            || (cp >= 0x3400 && cp <= 0x4DBF)
            || (cp >= 0x2E80 && cp <= 0x2EFF)
            || (cp >= 0x3000 && cp <= 0x303F)
    })
}

/// Build an FTS5 MATCH query (for non-CJK text).
fn build_fts_match(raw: &str) -> String {
    let cleaned: String = raw.chars().filter(|c| !r#"*"()+~^"#.contains(*c)).collect();
    let words: Vec<&str> = cleaned
        .split_whitespace()
        .filter(|w| !w.is_empty())
        .collect();
    if words.is_empty() {
        return String::new();
    }
    words
        .iter()
        .map(|w| format!("\"{}\"", w))
        .collect::<Vec<_>>()
        .join(" AND ")
}

pub fn search(
    conn: &Connection,
    q: &str,
    lang: &str,
    cid: Option<i64>,
    limit: i64,
    offset: i64,
) -> Result<(Vec<SearchResult>, i64)> {
    let is_cjk = has_cjk(q);
    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    let (where_clause, from_clause, order_clause) = if is_cjk {
        // CJK: use LIKE
        let mut where_sql = format!(
            "WHERE cp.lang_code = ?{} AND cp.text_content LIKE ?{}",
            params_vec.len() + 1,
            params_vec.len() + 2
        );
        params_vec.push(Box::new(lang.to_string()));
        params_vec.push(Box::new(format!("%{}%", q)));

        // CID filtering
        if let Some(c) = cid {
            where_sql.push_str(&format!(" AND cp.cid = ?{}", params_vec.len() + 1));
            params_vec.push(Box::new(c));
        }

        (
            where_sql,
            "FROM chapter_paragraphs cp".to_string(),
            "ORDER BY cp.cid, cp.book_id, cp.rowid".to_string(),
        )
    } else {
        // Non-CJK: use FTS5
        let match_str = build_fts_match(q);
        let mut where_sql = format!(
            "WHERE cp.lang_code = ?{} AND chapter_paragraphs_fts MATCH ?{}",
            params_vec.len() + 1,
            params_vec.len() + 2
        );
        params_vec.push(Box::new(lang.to_string()));
        params_vec.push(Box::new(match_str));

        // CID filtering
        if let Some(c) = cid {
            where_sql.push_str(&format!(" AND cp.cid = ?{}", params_vec.len() + 1));
            params_vec.push(Box::new(c));
        }

        (
            where_sql,
            "FROM chapter_paragraphs cp JOIN chapter_paragraphs_fts fts ON fts.rowid = cp.rowid"
                .to_string(),
            "ORDER BY cp.cid, cp.book_id, fts.rank".to_string(),
        )
    };

    let full_sql = format!(
        "SELECT cp.rowid, cp.cid, cp.book_id, cp.chapter_id, cp.id, cp.num,
                cp.text_content, cp.format, cp.lang_code,
                ch.title AS chapter_title, bi.name AS book_name
         {}
         JOIN chapters ch
           ON ch.cid = cp.cid AND ch.book_id = cp.book_id
          AND ch.chapter_id = cp.chapter_id AND ch.lang_code = cp.lang_code
         JOIN book_i18n bi
           ON bi.cid = cp.cid AND bi.book_id = cp.book_id AND bi.lang_code = cp.lang_code
         {}
         {}
         LIMIT ?{} OFFSET ?{}",
        from_clause,
        where_clause,
        order_clause,
        params_vec.len() + 1,
        params_vec.len() + 2
    );

    // Query total count first
    let count_sql = format!(
        "SELECT COUNT(*) FROM chapter_paragraphs cp {} {}",
        if is_cjk {
            ""
        } else {
            "JOIN chapter_paragraphs_fts fts ON fts.rowid = cp.rowid"
        },
        where_clause
    );

    let total: i64 = {
        let mut stmt = conn.prepare(&count_sql)?;
        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            params_vec.iter().map(|p| p.as_ref()).collect();
        stmt.query_row(params_refs.as_slice(), |row| row.get(0))?
    };

    // Query paginated results
    let mut stmt = conn.prepare(&full_sql)?;
    let params_refs: Vec<&dyn rusqlite::types::ToSql> = {
        let mut p: Vec<&dyn rusqlite::types::ToSql> =
            params_vec.iter().map(|p| p.as_ref()).collect();
        p.push(&limit);
        p.push(&offset);
        p
    };

    let rows = stmt.query_map(params_refs.as_slice(), |row| {
        Ok(SearchResult {
            rowid: row.get(0)?,
            cid: row.get(1)?,
            book_id: row.get(2)?,
            chapter_id: row.get(3)?,
            id: row.get(4)?,
            num: row.get(5)?,
            text_content: row.get(6)?,
            format: row.get(7)?,
            lang_code: row.get(8)?,
            chapter_title: row.get(9)?,
            book_name: row.get(10)?,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }

    Ok((results, total))
}
