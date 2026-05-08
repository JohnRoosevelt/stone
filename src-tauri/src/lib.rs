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

#[tauri::command]
fn get_books(
    state: tauri::State<DbState>,
    lang: String,
    cid: Option<i64>,
) -> Result<Vec<db::Book>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::get_books(&conn, &lang, cid).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_chapters(
    state: tauri::State<DbState>,
    cid: i64,
    book_id: i64,
    lang: String,
) -> Result<Vec<db::Chapter>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::get_chapters(&conn, cid, book_id, &lang).map_err(|e| e.to_string())
}

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
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
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
fn get_full_book(
    state: tauri::State<DbState>,
    cid: i64,
    book_id: i64,
    lang: String,
) -> Result<Vec<db::FullChapter>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::get_full_book(&conn, cid, book_id, &lang).map_err(|e| e.to_string())
}

#[tauri::command]
fn has_book_data(
    state: tauri::State<DbState>,
    cid: i64,
    book_id: i64,
    lang: String,
) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::has_book_data(&conn, cid, book_id, &lang).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_book_data(
    state: tauri::State<DbState>,
    cid: i64,
    book_id: i64,
    lang: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::delete_book_data(&conn, cid, book_id, &lang).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_db_size(state: tauri::State<DbState>) -> Result<String, String> {
    let bytes = db::get_db_size(&state.db_path)?;
    Ok(db::format_size(bytes))
}

#[tauri::command]
fn get_paragraphs(
    state: tauri::State<DbState>,
    cid: i64,
    book_id: i64,
    chapter_id: i64,
    lang: String,
) -> Result<Vec<db::Paragraph>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::get_paragraphs(&conn, cid, book_id, chapter_id, &lang).map_err(|e| e.to_string())
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
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            let conn = init_database(&db_path).expect("Failed to init DB");
            if seed::needs_seed(&conn) {
                if let Err(e) = seed::seed_database(&conn) {
                    log::error!("Seed failed: {}", e);
                }
            }
            app.manage(DbState {
                conn: Arc::new(Mutex::new(conn)),
                db_path: db_path.clone(),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_books,
            get_chapters,
            get_full_book,
            save_book,
            has_book_data,
            delete_book_data,
            get_db_size,
            get_paragraphs,
            search,
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri");
}
