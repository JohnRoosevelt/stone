/**
 * Shared import engine
 *
 * Provides a producer-consumer pattern for downloading books from R2 and
 * writing them into the local SQLite database.
 *
 * Both the manual import page (/tools/import) and the first-launch
 * auto-import (InitialImport.svelte) reuse this module.
 *
 * State is module-level $state so the import page's template reads it
 * reactively.  External callers can await `waitForDone()` to know when
 * a batch finishes.
 */

const MAX_CONCURRENT = 10;

const _s = $state({
  running: false,
  total: 0,
  downloaded: 0,
  written: 0,
  currentLang: "zh",
  currentCid: 0,
  error: "",
  /** @type {{time: string, text: string, type: string}[]} */
  logs: [],
});

let _resolveDone = null;
let _donePromise = null;

function nowStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function addLog(type, text) {
  _s.logs.unshift({ time: nowStr(), text, type });
}

export function isRunning() {
  return _s.running;
}
export function getTotal() {
  return _s.total;
}
export function getDownloaded() {
  return _s.downloaded;
}
export function getWritten() {
  return _s.written;
}
export function getLogs() {
  return _s.logs;
}
export function getError() {
  return _s.error;
}
export function getCurrentCid() {
  return _s.currentCid;
}
export function getCurrentLang() {
  return _s.currentLang;
}

/**
 * Resolves when the currently running batch finishes.
 * Returns null if nothing is running.
 */
export function waitForDone() {
  return _donePromise;
}

/**
 * Reset counters and log (without touching running flag).
 */
export function reset() {
  _s.total = 0;
  _s.downloaded = 0;
  _s.written = 0;
  _s.error = "";
  _s.logs = [];
}

/**
 * Start importing a batch of books for a single (cid, lang) group.
 *
 * @param {number} cid          - category ID (0=bible, 1=sda, 2=books)
 * @param {string} lang         - language code (zh/en)
 * @param {{book_id:number, name:string, local?:boolean}[]} booksToImport
 * @returns {Promise<void>}     - resolves when the whole batch is done
 */
export async function startImport(cid, lang, booksToImport) {
  if (_s.running) {
    // If already running, wait for the current batch first
    if (_donePromise) await _donePromise;
  }

  _donePromise = new Promise((resolve) => {
    _resolveDone = resolve;
  });

  _s.running = true;
  _s.total = 0;
  _s.downloaded = 0;
  _s.written = 0;
  _s.currentCid = cid;
  _s.currentLang = lang;
  _s.error = "";
  _s.logs = [];

  const list = booksToImport.filter((b) => !b.local);
  if (list.length === 0) {
    _s.running = false;
    _resolveDone();
    return;
  }
  _s.total = list.length;
  addLog(
    "info",
    `Start: ${list.length} books, max ${MAX_CONCURRENT} concurrent`,
  );

  const { invoke } = await import("@tauri-apps/api/core");
  const { loadR2Parquet } = await import("$lib/parquet");
  const writeQueue = [];
  let writing = false;
  const t0 = performance.now();

  // ── Consumer: serial SQLite writes ──
  async function startWriter() {
    writing = true;
    while (writeQueue.length > 0 || downloading > 0) {
      if (writeQueue.length > 0) {
        const { bookId, chapters, name } = writeQueue.shift();
        const t1 = performance.now();
        try {
          await invoke("save_book", { cid, bookId, lang, chapters });
          const ms = (performance.now() - t1).toFixed(0);
          addLog("write", `\u{1f4be} ${name}  \u{23f1}${ms}ms`);
          _s.written++;
          await new Promise((r) => setTimeout(r, 0)); // yield to UI
        } catch (e) {
          addLog("error", `\u{274c} ${name} DB write failed: ${e}`);
        }
      } else {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    writing = false;
  }

  // ── Producer: concurrent downloads (MAX_CONCURRENT at a time) ──
  let downloading = list.length;
  let nextIndex = 0;

  function downloadOne(b) {
    const t1 = performance.now();
    loadR2Parquet(`${cid}/${lang}/${b.book_id}`, true)
      .then((chapters) => {
        const ms = (performance.now() - t1).toFixed(0);
        addLog(
          "download",
          `\u{1f4e5} ${b.name}  \u{23f1}${ms}ms  (${chapters.length} chapters)`,
        );
        _s.downloaded++;
        writeQueue.push({ bookId: b.book_id, chapters, name: b.name });
        if (!writing) startWriter();
      })
      .catch((e) => {
        addLog("error", `\u{274c} ${b.name} download failed: ${e}`);
      })
      .finally(() => {
        downloading--;
        if (nextIndex < list.length) {
          downloadOne(list[nextIndex++]);
        }
      });
  }

  // Start the initial wave
  const initial = Math.min(MAX_CONCURRENT, list.length);
  for (let i = 0; i < initial; i++) {
    downloadOne(list[i]);
    await new Promise((r) => setTimeout(r, 0));
  }
  nextIndex = initial;

  // Wait until everything finishes
  while (downloading > 0 || writeQueue.length > 0 || writing) {
    await new Promise((r) => setTimeout(r, 200));
  }

  const totalMs = (performance.now() - t0).toFixed(0);
  addLog("info", `Done: ${_s.total} books, ${totalMs}ms total`);
  _s.running = false;
  _resolveDone();
}
