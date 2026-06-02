//! Public data structs returned from queries and Tauri commands.

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct Book {
    pub cid: i64,
    pub book_id: i64,
    pub name: String,
    pub title: Option<String>,
    pub abbreviation: Option<String>,
    pub section: Option<String>,
    pub featured: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct Chapter {
    pub chapter_id: i64,
    pub title: String,
}

#[derive(Debug, Serialize)]
pub struct Paragraph {
    pub id: i64,
    pub num: Option<i64>,
    pub text_content: String,
    pub format: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub rowid: i64,
    pub cid: i64,
    pub book_id: i64,
    pub chapter_id: i64,
    pub id: i64,
    pub num: Option<i64>,
    pub text_content: String,
    pub format: Option<i64>,
    pub lang_code: String,
    pub chapter_title: String,
    pub book_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FullParagraph {
    pub c: String,
    pub p: Option<i64>,
    pub t: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FullChapter {
    pub n: String,
    pub ps: Vec<FullParagraph>,
}

/// Lightweight struct for initial import: book ID and name only
#[derive(Debug, Serialize)]
pub struct BookForImport {
    pub cid: i64,
    pub book_id: i64,
    pub name: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Annotation {
    pub id: Option<i64>,
    pub cid: i64,
    pub book_id: i64,
    pub chapter_id: i64,
    pub lang_code: String,
    pub p_index: i64,
    pub start_offset: i64,
    pub length: i64,
    pub text: String,
    pub ann_type: String, // "underline_wavy", "underline", "bg", "text"
    pub color: String,
    pub created_at: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReadingProgress {
    pub id: Option<i64>,
    pub cid: i64,
    pub book_id: i64,
    pub lang_code: String,
    pub chapter_id: i64,
    pub scroll_percentage: i64,
    pub updated_at: Option<String>,
}
