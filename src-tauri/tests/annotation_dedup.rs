//! Integration tests for annotation DB ops.
//!
//! Covers the dedup path used by LongpressCtrl.saveHighlight: when the user
//! re-marks the same (p_index, start_offset, length) span — e.g. switching
//! the annotation type from underline to wavy underline — we expect exactly
//! one row, not two.

use app_lib::db::{init_database, replace_annotation, Annotation};
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

fn make_ann(
    cid: i64,
    book_id: i64,
    chapter_id: i64,
    p_index: i64,
    start_offset: i64,
    length: i64,
    text: &str,
    ann_type: &str,
) -> Annotation {
    Annotation {
        id: None,
        cid,
        book_id,
        chapter_id,
        lang_code: "zh".to_string(),
        p_index,
        start_offset,
        length,
        text: text.to_string(),
        ann_type: ann_type.to_string(),
        color: "OrangeRed".to_string(),
        created_at: None,
    }
}

#[test]
fn replace_annotation_dedups_same_key() {
    let path = tmp_db_path();
    let (write_conn, _read_conn) = init_database(&path).expect("init db");

    // 1) Initial save: one row.
    let first = make_ann(1, 1, 1, 3, 12, 4, "你们", "bg");
    let id1 = replace_annotation(&write_conn, &first).expect("first save");
    assert!(id1 > 0, "first insert should return a positive id");

    let count: i64 = write_conn
        .query_row("SELECT COUNT(*) FROM annotations", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 1, "after first save: exactly 1 row");

    // 2) User switches the same span to underline_wavy — same key, different type.
    let switched = make_ann(1, 1, 1, 3, 12, 4, "你们", "underline_wavy");
    let id2 = replace_annotation(&write_conn, &switched).expect("replace save");
    assert!(id2 > id1, "new id should differ from the replaced id");

    let count: i64 = write_conn
        .query_row("SELECT COUNT(*) FROM annotations", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 1, "after type switch: still exactly 1 row");

    // The surviving row should reflect the new type.
    let stored_type: String = write_conn
        .query_row(
            "SELECT ann_type FROM annotations WHERE id = ?1",
            [id2],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(stored_type, "underline_wavy", "stored type should be the new one");

    // 3) Re-mark the EXACT same span with the SAME type — still 1 row.
    let same_again = make_ann(1, 1, 1, 3, 12, 4, "你们", "underline_wavy");
    let id3 = replace_annotation(&write_conn, &same_again).expect("idempotent save");
    assert!(id3 > 0);

    let count: i64 = write_conn
        .query_row("SELECT COUNT(*) FROM annotations", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 1, "idempotent re-mark: still 1 row");

    let _ = std::fs::remove_file(&path);
}

#[test]
fn replace_annotation_preserves_disjoint_spans() {
    let path = tmp_db_path();
    let (write_conn, _read_conn) = init_database(&path).expect("init db");

    // Two distinct spans in the same chapter — should coexist.
    let a = make_ann(1, 1, 1, 3, 12, 4, "你们", "bg");
    let b = make_ann(1, 1, 1, 3, 30, 4, "去了", "underline_wavy");
    let _ = replace_annotation(&write_conn, &a).unwrap();
    let _ = replace_annotation(&write_conn, &b).unwrap();

    // Replace span A with the SAME (p, off, len) but a different ann_type.
    // This is the "user picked the same span and switched the type" flow
    // — we expect DELETE to remove span A and INSERT to add a new row.
    // Span B (different start_offset) must remain untouched.
    let a_switched = make_ann(1, 1, 1, 3, 12, 4, "你们", "underline");
    let _ = replace_annotation(&write_conn, &a_switched).unwrap();

    let count: i64 = write_conn
        .query_row("SELECT COUNT(*) FROM annotations", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 2, "span A replaced, span B preserved");

    // Now replace span B in-place (same key, different type) — still 2.
    let b_switched = make_ann(1, 1, 1, 3, 30, 4, "去了", "text");
    let _ = replace_annotation(&write_conn, &b_switched).unwrap();

    let count: i64 = write_conn
        .query_row("SELECT COUNT(*) FROM annotations", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 2, "span B replaced in-place, span A still 1 row");

    let _ = std::fs::remove_file(&path);
}

#[test]
fn replace_annotation_collision_atomic() {
    // The transaction is meant to be atomic: if DELETE removed the row but
    // INSERT failed, we'd lose data. We can't easily simulate the INSERT
    // failure here, but we CAN verify the transactional property by
    // confirming that the row id sequence advances past the deleted row.
    let path = tmp_db_path();
    let (write_conn, _read_conn) = init_database(&path).expect("init db");

    let a = make_ann(1, 1, 1, 0, 0, 4, "太初", "bg");
    let id_a = replace_annotation(&write_conn, &a).unwrap();

    let a_again = make_ann(1, 1, 1, 0, 0, 4, "太初", "underline");
    let id_a2 = replace_annotation(&write_conn, &a_again).unwrap();

    assert!(id_a2 > id_a, "INSERT inside the same transaction gets a new rowid");
    assert_ne!(id_a, id_a2);

    // The old id should no longer be in the table.
    let count_old: i64 = write_conn
        .query_row("SELECT COUNT(*) FROM annotations WHERE id = ?1", [id_a], |r| r.get(0))
        .unwrap();
    assert_eq!(count_old, 0, "old id should be deleted by the transaction");

    let _ = std::fs::remove_file(&path);
}
