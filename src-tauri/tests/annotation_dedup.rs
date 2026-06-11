//! Integration tests for per-paragraph annotation DB ops.
//!
//! New model: one row per (cid, book, chapter, lang, p_index). The row's
//! `segments` column is a JSON array of `{start, end, style, color}`
//! objects. Each save *replaces* the full segments list for the paragraph
//! (upsert). Multi-segment paragraphs and disjoint paragraphs coexist.

use app_lib::db::{
    init_database, save_paragraph_annotations, AnnotationSegment, ParagraphAnnotations,
};
use std::path::PathBuf;

fn tmp_db_path() -> PathBuf {
    let mut p = std::env::temp_dir();
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    p.push(format!("stone-anno-test-{nanos}.db"));
    p
}

fn seg(start: i64, end: i64, style: &str, color: &str) -> AnnotationSegment {
    AnnotationSegment {
        start,
        end,
        style: style.to_string(),
        color: color.to_string(),
    }
}

fn make_pa(
    cid: i64,
    book_id: i64,
    chapter_id: i64,
    p_index: i64,
    segments: Vec<AnnotationSegment>,
) -> ParagraphAnnotations {
    ParagraphAnnotations {
        id: None,
        cid,
        book_id,
        chapter_id,
        lang_code: "zh".to_string(),
        p_index,
        segments,
        updated_at: None,
    }
}

#[test]
fn save_upserts_one_row_per_paragraph() {
    let path = tmp_db_path();
    let (write_conn, _read_conn) = init_database(&path).expect("init db");

    // 1) First save on a paragraph: one row.
    let first = make_pa(1, 1, 1, 3, vec![seg(12, 16, "bg", "OrangeRed")]);
    let id1 = save_paragraph_annotations(&write_conn, &first).expect("first save");
    assert!(id1 > 0);

    let count: i64 = write_conn
        .query_row("SELECT COUNT(*) FROM annotations", [], |r| r.get(0))
        .unwrap();
    assert_eq!(
        count, 1,
        "after first save: exactly 1 row for that paragraph"
    );

    // 2) Save a second time with an expanded segments list — still one row
    //    (upsert), same id (the row is preserved, only the data changes).
    let second = make_pa(
        1,
        1,
        1,
        3,
        vec![
            seg(12, 16, "bg", "OrangeRed"),
            seg(20, 24, "underline", "OrangeRed"),
        ],
    );
    let id2 = save_paragraph_annotations(&write_conn, &second).expect("expand save");
    assert_eq!(id2, id1, "upsert should preserve the row id");

    let count: i64 = write_conn
        .query_row("SELECT COUNT(*) FROM annotations", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 1, "after expanding segments: still exactly 1 row");

    // The stored segments should reflect the expanded list.
    let stored: String = write_conn
        .query_row(
            "SELECT segments FROM annotations WHERE id = ?1",
            [id2],
            |r| r.get(0),
        )
        .unwrap();
    let parsed: Vec<AnnotationSegment> = serde_json::from_str(&stored).unwrap();
    assert_eq!(parsed.len(), 2);
    assert_eq!(parsed[0].style, "bg");
    assert_eq!(parsed[1].style, "underline");

    // 3) Save with a single-segment list (e.g. user removed one highlight) —
    //    still one row, same id, now with one entry.
    let third = make_pa(1, 1, 1, 3, vec![seg(12, 16, "bg", "OrangeRed")]);
    let id3 = save_paragraph_annotations(&write_conn, &third).expect("shrink save");
    assert_eq!(id3, id1, "id is preserved across re-saves");

    let count: i64 = write_conn
        .query_row("SELECT COUNT(*) FROM annotations", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 1, "after shrinking segments: still 1 row");

    let stored: String = write_conn
        .query_row(
            "SELECT segments FROM annotations WHERE id = ?1",
            [id3],
            |r| r.get(0),
        )
        .unwrap();
    let parsed: Vec<AnnotationSegment> = serde_json::from_str(&stored).unwrap();
    assert_eq!(parsed.len(), 1, "stored list should be the new short one");

    let _ = std::fs::remove_file(&path);
}

#[test]
fn save_keeps_disjoint_paragraphs_separate() {
    let path = tmp_db_path();
    let (write_conn, _read_conn) = init_database(&path).expect("init db");

    // Three paragraphs in the same chapter, each with its own segments.
    let a = make_pa(1, 1, 1, 3, vec![seg(12, 16, "bg", "OrangeRed")]);
    let b = make_pa(1, 1, 1, 4, vec![seg(0, 4, "underline_wavy", "Tomato")]);
    let c = make_pa(1, 1, 1, 5, vec![]); // empty segments — still a row
    let _ = save_paragraph_annotations(&write_conn, &a).unwrap();
    let _ = save_paragraph_annotations(&write_conn, &b).unwrap();
    let _ = save_paragraph_annotations(&write_conn, &c).unwrap();

    let count: i64 = write_conn
        .query_row("SELECT COUNT(*) FROM annotations", [], |r| r.get(0))
        .unwrap();
    assert_eq!(
        count, 3,
        "one row per paragraph, even when segments is empty"
    );

    // Different chapters in the same book also don't collide.
    let d = make_pa(1, 1, 2, 3, vec![seg(0, 4, "text", "Lime")]);
    let _ = save_paragraph_annotations(&write_conn, &d).unwrap();
    let count: i64 = write_conn
        .query_row("SELECT COUNT(*) FROM annotations", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 4);

    let _ = std::fs::remove_file(&path);
}

#[test]
fn get_returns_separate_paragraphs() {
    let path = tmp_db_path();
    let (write_conn, read_conn) = init_database(&path).expect("init db");

    let a = make_pa(
        1,
        1,
        1,
        3,
        vec![
            seg(0, 2, "bg", "OrangeRed"),
            seg(10, 12, "underline", "Tomato"),
        ],
    );
    let b = make_pa(1, 1, 1, 7, vec![seg(0, 5, "underline_wavy", "Magenta")]);
    let _ = save_paragraph_annotations(&write_conn, &a).unwrap();
    let _ = save_paragraph_annotations(&write_conn, &b).unwrap();

    let result = app_lib::db::get_paragraph_annotations(&read_conn, 1, 1, 1, "zh").expect("read");
    assert_eq!(result.len(), 2, "two paragraphs worth of rows");

    // Find paragraph 3 and verify its two segments came back.
    let p3 = result.iter().find(|p| p.p_index == 3).expect("p3 present");
    assert_eq!(p3.segments.len(), 2);
    assert_eq!(p3.segments[0].style, "bg");
    assert_eq!(p3.segments[0].start, 0);
    assert_eq!(p3.segments[0].end, 2);
    assert_eq!(p3.segments[1].style, "underline");
    assert_eq!(p3.segments[1].start, 10);
    assert_eq!(p3.segments[1].end, 12);

    // Verify the per-segment color round-trips intact.
    let p7 = result.iter().find(|p| p.p_index == 7).expect("p7 present");
    assert_eq!(p7.segments[0].color, "Magenta");

    let _ = std::fs::remove_file(&path);
}

#[test]
fn clear_paragraph_removes_only_that_row() {
    let path = tmp_db_path();
    let (write_conn, _read_conn) = init_database(&path).expect("init db");

    let a = make_pa(1, 1, 1, 3, vec![seg(0, 2, "bg", "OrangeRed")]);
    let b = make_pa(1, 1, 1, 4, vec![seg(0, 2, "underline", "Tomato")]);
    let _ = save_paragraph_annotations(&write_conn, &a).unwrap();
    let _ = save_paragraph_annotations(&write_conn, &b).unwrap();

    app_lib::db::clear_paragraph_annotations(&write_conn, 1, 1, 1, "zh", 3).expect("clear p3");

    let count: i64 = write_conn
        .query_row("SELECT COUNT(*) FROM annotations", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 1, "p3 cleared, p4 remains");

    // Re-saving p3 with new segments should create a new row (not upsert the
    // cleared one, since the unique key only conflicts on existing rows).
    let a_again = make_pa(1, 1, 1, 3, vec![seg(20, 24, "text", "Lime")]);
    let _ = save_paragraph_annotations(&write_conn, &a_again).unwrap();
    let count: i64 = write_conn
        .query_row("SELECT COUNT(*) FROM annotations", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 2, "p3 recreated");

    let _ = std::fs::remove_file(&path);
}

#[test]
fn clear_all_annotations_wipes_everything() {
    let path = tmp_db_path();
    let (write_conn, _read_conn) = init_database(&path).expect("init db");

    let _ = save_paragraph_annotations(
        &write_conn,
        &make_pa(1, 1, 1, 0, vec![seg(0, 2, "bg", "OrangeRed")]),
    )
    .unwrap();
    let _ = save_paragraph_annotations(
        &write_conn,
        &make_pa(1, 1, 1, 1, vec![seg(0, 2, "underline", "Tomato")]),
    )
    .unwrap();

    let n = app_lib::db::clear_all_annotations(&write_conn).expect("clear all");
    assert_eq!(n, 2);

    let count: i64 = write_conn
        .query_row("SELECT COUNT(*) FROM annotations", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 0);

    let _ = std::fs::remove_file(&path);
}
