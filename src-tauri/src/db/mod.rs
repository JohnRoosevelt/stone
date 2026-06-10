//! Database access layer.
//!
//! Split into focused submodules:
//! - `models` — public data structs returned from queries
//! - `schema` — `init_database` (DDL, indexes, triggers)
//! - `books` — book/chapter/paragraph CRUD + initial import helpers
//! - `search` — FTS5 + CJK LIKE search
//! - `annotations` — per-paragraph segment list (save / list / clear)
//! - `progress` — per-book reading position
//!
//! All query functions take a `&Connection` so callers can choose the
//! read or write connection from `DbState`.

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

pub mod annotations;
pub mod books;
pub mod models;
pub mod progress;
pub mod schema;
pub mod search;

// Re-export model types at the `db::` level so existing call sites
// (`db::ParagraphAnnotations`, `db::Book`, ...) keep working after the split.
pub use models::{
    AllAnnotation, AnnotationSegment, Book, BookForImport, Chapter, FullChapter, FullParagraph,
    Paragraph, ParagraphAnnotations, ReadingProgress, SearchResult,
};
// Re-export the most-used query functions at the `db::` level too, so the
// lib.rs call sites (`db::save_paragraph_annotations`, `db::get_books`, ...)
// don't need to know the internal layout.
pub use annotations::{
    clear_all_annotations, clear_paragraph_annotations, delete_annotation,
    get_all_annotations, get_paragraph_annotations, save_paragraph_annotations,
};
pub use books::{
    delete_book_data, format_size, get_all_books_for_import, get_books, get_chapters,
    get_full_book, get_imported_book_ids, get_paragraphs, has_book_data, mark_import_complete,
    needs_initial_import, reset_import_flag, save_book, get_db_size,
};
pub use progress::{get_all_reading_progress, get_reading_progress, save_reading_progress};
pub use schema::init_database;
pub use search::search;

/// Read-write split database state.
/// - read_conn: independent Mutex-guarded read connection (non-blocking concurrent reads under WAL)
/// - write_conn: independent Mutex-guarded write connection (serialized writes)
///
/// SQLite WAL mode: reads do not block writes, and writes do not block reads.
pub struct DbState {
    pub read_conn: Arc<Mutex<Connection>>,
    pub write_conn: Arc<Mutex<Connection>>,
    pub db_path: PathBuf,
}
