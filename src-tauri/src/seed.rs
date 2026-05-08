/// 数据库种子数据 — 书籍元数据
///
/// 从 schemas/ 目录的 SQL 种子文件嵌入到编译产物中。
/// 首次启动时调用 seed_database() 写⼊。
use rusqlite::Connection;

/// 检查是否需要种子（book_base 表为空）
pub fn needs_seed(conn: &Connection) -> bool {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM book_base", [], |row| row.get(0))
        .unwrap_or(0);
    count == 0
}

/// 种子数据：book_base
const BOOK_BASE_SQL: &str = include_str!("../../schemas/books.sql");

/// 种子数据：book_i18n 中文
const BOOK_ZH_SQL: &str = include_str!("../../schemas/books.zh.sql");

/// 种子数据：book_i18n 英文
const BOOK_EN_SQL: &str = include_str!("../../schemas/books.en.sql");

/// 执行种子数据写入
pub fn seed_database(conn: &Connection) -> Result<(), String> {
    conn.execute_batch("PRAGMA foreign_keys = OFF;")
        .map_err(|e| format!("pragma error: {e}"))?;

    conn.execute_batch(BOOK_BASE_SQL)
        .map_err(|e| format!("book_base seed error: {e}"))?;
    conn.execute_batch(BOOK_ZH_SQL)
        .map_err(|e| format!("book_zh seed error: {e}"))?;
    conn.execute_batch(BOOK_EN_SQL)
        .map_err(|e| format!("book_en seed error: {e}"))?;

    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| format!("pragma error: {e}"))?;

    log::info!("Database seeded successfully");
    Ok(())
}
