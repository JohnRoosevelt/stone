mod db;
mod seed;

use db::{init_database, DbState};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::Manager;

fn get_db_path(app: &tauri::AppHandle) -> PathBuf {
    let app_dir = app.path().app_data_dir().expect("app data dir");
    std::fs::create_dir_all(&app_dir).ok();
    app_dir.join("stone.db")
}

// ═══════════════════════════════════════════════════════════
// Read commands — use `read_conn` (RwLock, concurrent reads)
// ═══════════════════════════════════════════════════════════

#[tauri::command]
fn get_books(
    state: tauri::State<DbState>,
    lang: String,
    cid: Option<i64>,
) -> Result<Vec<db::Book>, String> {
    let conn = state.read_conn.lock().map_err(|e| e.to_string())?;
    db::get_books(&conn, &lang, cid).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_chapters(
    state: tauri::State<DbState>,
    cid: i64,
    book_id: i64,
    lang: String,
) -> Result<Vec<db::Chapter>, String> {
    let conn = state.read_conn.lock().map_err(|e| e.to_string())?;
    db::get_chapters(&conn, cid, book_id, &lang).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_paragraphs(
    state: tauri::State<DbState>,
    cid: i64,
    book_id: i64,
    chapter_id: i64,
    lang: String,
) -> Result<Vec<db::Paragraph>, String> {
    let conn = state.read_conn.lock().map_err(|e| e.to_string())?;
    db::get_paragraphs(&conn, cid, book_id, chapter_id, &lang).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_full_book(
    state: tauri::State<DbState>,
    cid: i64,
    book_id: i64,
    lang: String,
) -> Result<Vec<db::FullChapter>, String> {
    let conn = state.read_conn.lock().map_err(|e| e.to_string())?;
    db::get_full_book(&conn, cid, book_id, &lang).map_err(|e| e.to_string())
}

#[tauri::command]
fn has_book_data(
    state: tauri::State<DbState>,
    cid: i64,
    book_id: i64,
    lang: String,
) -> Result<bool, String> {
    let conn = state.read_conn.lock().map_err(|e| e.to_string())?;
    db::has_book_data(&conn, cid, book_id, &lang).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_db_size(state: tauri::State<DbState>) -> Result<String, String> {
    let bytes = db::get_db_size(&state.db_path)?;
    Ok(db::format_size(bytes))
}

#[tauri::command]
fn needs_initial_import(state: tauri::State<DbState>) -> Result<bool, String> {
    let conn = state.read_conn.lock().map_err(|e| e.to_string())?;
    db::needs_initial_import(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_imported_books(
    state: tauri::State<DbState>,
    lang: String,
) -> Result<Vec<(i64, i64)>, String> {
    let conn = state.read_conn.lock().map_err(|e| e.to_string())?;
    db::get_imported_book_ids(&conn, &lang).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_all_books_for_import(
    state: tauri::State<DbState>,
    lang: String,
) -> Result<Vec<db::BookForImport>, String> {
    let conn = state.read_conn.lock().map_err(|e| e.to_string())?;
    db::get_all_books_for_import(&conn, &lang)
        .map(|rows| {
            rows.into_iter()
                .map(|(cid, book_id, name)| db::BookForImport { cid, book_id, name })
                .collect()
        })
        .map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct SearchResponse {
    results: Vec<db::SearchResult>,
    total: i64,
}

#[tauri::command]
fn search(
    state: tauri::State<DbState>,
    q: String,
    lang: String,
    cid: Option<i64>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<SearchResponse, String> {
    let conn = state.read_conn.lock().map_err(|e| e.to_string())?;
    let (results, total) = db::search(
        &conn,
        &q,
        &lang,
        cid,
        limit.unwrap_or(200),
        offset.unwrap_or(0),
    )
    .map_err(|e| e.to_string())?;
    Ok(SearchResponse { results, total })
}

// ═══════════════════════════════════════════════════════════
// Write commands — use `write_conn` (Mutex, serialized writes)
// ═══════════════════════════════════════════════════════════

#[tauri::command]
fn save_book(
    state: tauri::State<DbState>,
    cid: i64,
    book_id: i64,
    lang: String,
    chapters: Vec<db::FullChapter>,
    append: Option<bool>,
    start_chapter_id: Option<i64>,
) -> Result<(i64, i64), String> {
    let conn = state.write_conn.lock().map_err(|e| e.to_string())?;
    db::save_book(
        &conn,
        cid,
        book_id,
        &lang,
        chapters,
        append.unwrap_or(false),
        start_chapter_id.unwrap_or(1),
    )
}

#[tauri::command]
fn delete_book_data(
    state: tauri::State<DbState>,
    cid: i64,
    book_id: i64,
    lang: String,
) -> Result<(), String> {
    let conn = state.write_conn.lock().map_err(|e| e.to_string())?;
    db::delete_book_data(&conn, cid, book_id, &lang).map_err(|e| e.to_string())
}

#[tauri::command]
fn mark_import_complete(state: tauri::State<DbState>) -> Result<(), String> {
    let conn = state.write_conn.lock().map_err(|e| e.to_string())?;
    db::mark_import_complete(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn reset_initial_import(state: tauri::State<DbState>) -> Result<(), String> {
    let conn = state.write_conn.lock().map_err(|e| e.to_string())?;
    db::reset_import_flag(&conn).map_err(|e| e.to_string())
}

// ═══════════════════════════════════════════════════════════
// Annotation commands — read (read_conn)
// ═══════════════════════════════════════════════════════════

#[tauri::command]
fn get_annotations(
    state: tauri::State<DbState>,
    cid: i64,
    book_id: i64,
    chapter_id: i64,
    lang: String,
) -> Result<Vec<db::Annotation>, String> {
    let conn = state.read_conn.lock().map_err(|e| e.to_string())?;
    db::get_annotations(&conn, cid, book_id, chapter_id, &lang).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_annotation(
    state: tauri::State<DbState>,
    annotation: db::Annotation,
) -> Result<i64, String> {
    let conn = state.write_conn.lock().map_err(|e| e.to_string())?;
    db::save_annotation(&conn, &annotation).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_annotation(state: tauri::State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.write_conn.lock().map_err(|e| e.to_string())?;
    db::delete_annotation(&conn, id).map_err(|e| e.to_string())
}

// ═══════════════════════════════════════════════════════════
// Reading Progress commands
// ═══════════════════════════════════════════════════════════

#[tauri::command]
fn save_reading_progress(
    state: tauri::State<DbState>,
    progress: db::ReadingProgress,
) -> Result<(), String> {
    let conn = state.write_conn.lock().map_err(|e| e.to_string())?;
    db::save_reading_progress(&conn, &progress).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_reading_progress(
    state: tauri::State<DbState>,
    cid: i64,
    book_id: i64,
    lang: String,
) -> Result<Option<db::ReadingProgress>, String> {
    let conn = state.read_conn.lock().map_err(|e| e.to_string())?;
    db::get_reading_progress(&conn, cid, book_id, &lang).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_all_reading_progress(
    state: tauri::State<DbState>,
) -> Result<Vec<db::ReadingProgress>, String> {
    let conn = state.read_conn.lock().map_err(|e| e.to_string())?;
    db::get_all_reading_progress(&conn).map_err(|e| e.to_string())
}

// ═══════════════════════════════════════════════════════════
// App entry point
// ═══════════════════════════════════════════════════════════

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            let db_path = get_db_path(&app.handle());
            log::info!("Database path: {:?}", db_path);

            // Initialize read-write split connections
            let (write_conn, read_conn) = init_database(&db_path).expect("Failed to init DB");

            // Seed data uses the write connection
            if seed::needs_seed(&write_conn) {
                if let Err(e) = seed::seed_database(&write_conn) {
                    log::error!("Seed failed: {}", e);
                }
            }

            app.manage(DbState {
                read_conn: Arc::new(Mutex::new(read_conn)),
                write_conn: Arc::new(Mutex::new(write_conn)),
                db_path: db_path.clone(),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Reads
            get_books,
            get_chapters,
            get_paragraphs,
            get_full_book,
            has_book_data,
            get_db_size,
            search,
            needs_initial_import,
            get_imported_books,
            get_all_books_for_import,
            // Writes
            save_book,
            delete_book_data,
            mark_import_complete,
            reset_initial_import,
            // Annotations
            get_annotations,
            save_annotation,
            delete_annotation,
            // Reading Progress
            save_reading_progress,
            get_reading_progress,
            get_all_reading_progress,
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri");
}
