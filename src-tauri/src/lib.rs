mod db;

use db::{init_database, DbState};
use std::path::PathBuf;
use tauri::Manager;

/// 获取数据库文件路径（放在应用数据目录下）
fn get_db_path(app: &tauri::AppHandle) -> PathBuf {
    let app_dir = app
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir");
    std::fs::create_dir_all(&app_dir).ok();
    app_dir.join("stone.db")
}

// ── Tauri 命令 ──────────────────────────────────────────────

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
            // 日志插件
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // 初始化数据库
            let db_path = get_db_path(&app.handle());
            log::info!("Database path: {:?}", db_path);
            let conn = init_database(&db_path).expect("Failed to initialize database");
            app.manage(DbState {
                conn: std::sync::Mutex::new(conn),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_books,
            get_chapters,
            get_paragraphs,
            search,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
