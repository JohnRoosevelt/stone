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

/// A single highlight/annotation segment within a paragraph.
///
/// One record per (cid, book_id, chapter_id, lang_code, p_index) **paragraph**,
/// not per marked span. All the segments of a paragraph live in one row's
/// `segments` JSON column as an array of these structs.
///
/// `start` and `end` are character offsets into the paragraph's text
/// (0-based, half-open — `end` is exclusive), so `end - start` is the length.
/// `style` is one of `"underline"`, `"underline_wavy"`, `"bg"`, `"text"`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnnotationSegment {
    pub start: i64,
    pub end: i64,
    pub style: String,
    pub color: String,
}

/// A single annotation row with denormalised book/chapter names for the
/// "all annotations" list page.
#[derive(Debug, Serialize)]
pub struct AllAnnotation {
    pub id: i64,
    pub cid: i64,
    pub book_id: i64,
    pub chapter_id: i64,
    pub lang_code: String,
    pub p_index: i64,
    pub segments: Vec<AnnotationSegment>,
    pub updated_at: Option<String>,
    /// Book name from book_i18n (empty string if book data not imported)
    pub book_name: String,
    /// Chapter title from chapters (empty string if chapter data not imported)
    pub chapter_title: String,
}

/// All annotation segments for one paragraph. UNIQUE on
/// (cid, book_id, chapter_id, lang_code, p_index).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParagraphAnnotations {
    pub id: Option<i64>,
    pub cid: i64,
    pub book_id: i64,
    pub chapter_id: i64,
    pub lang_code: String,
    pub p_index: i64,
    /// JSON-encoded array of `AnnotationSegment` — see the helper
    /// `serde_json::to_string(&pa.segments)` at the call site.
    pub segments: Vec<AnnotationSegment>,
    pub updated_at: Option<String>,
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
