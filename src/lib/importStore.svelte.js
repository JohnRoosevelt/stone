/**
 * Background import state — module-level
 */
const MAX_CONCURRENT = 3;

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

export async function startImport(cid, lang, booksToImport) {
  if (_s.running) return;
  _s.running = true;
  _s.total = 0;
  _s.downloaded = 0;
  _s.written = 0;
  _s.error = "";
  _s.logs = [];

  const list = booksToImport.filter((b) => !b.local);
  if (list.length === 0) {
    _s.running = false;
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

  // Consumer: serial writes
  async function startWriter() {
    writing = true;
    while (writeQueue.length > 0 || downloading > 0) {
      if (writeQueue.length > 0) {
        const { bookId, chapters, name } = writeQueue.shift();
        const t1 = performance.now();
        try {
          await invoke("save_book", { cid, bookId, lang, chapters });
          const ms = (performance.now() - t1).toFixed(0);
          addLog("write", `${name} ✓ ${ms}ms`);
          _s.written++;
          await new Promise((r) => setTimeout(r, 0)); // yield to UI
        } catch (e) {
          addLog("error", `${name} ✗ ${e}`);
        }
      } else {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    writing = false;
  }

  // Producer: limit concurrent downloads
  let downloading = list.length;
  let nextIndex = 0;

  function downloadOne(b) {
    const startedAt = nowStr();
    const t1 = performance.now();
    loadR2Parquet(`${cid}/${lang}/${b.book_id}`)
      .then((chapters) => {
        const ms = (performance.now() - t1).toFixed(0);
        addLog(
          "download",
          `${startedAt} ${b.name} ✓ ${ms}ms (${chapters.length}ch)`,
        );
        _s.downloaded++;
        writeQueue.push({ bookId: b.book_id, chapters, name: b.name });
        if (!writing) startWriter();
      })
      .catch((e) => {
        addLog("error", `${startedAt} ${b.name} ✗ ${e}`);
      })
      .finally(() => {
        downloading--;
        // Start the next one
        if (nextIndex < list.length) {
          downloadOne(list[nextIndex++]);
        }
      });
  }

  // Initially start MAX_CONCURRENT downloads
  const initial = Math.min(MAX_CONCURRENT, list.length);
  for (let i = 0; i < initial; i++) {
    downloadOne(list[i]);
    await new Promise((r) => setTimeout(r, 0)); // yield to UI between downloads
  }
  nextIndex = initial;

  // Wait for all to complete
  while (downloading > 0 || writeQueue.length > 0 || writing) {
    await new Promise((r) => setTimeout(r, 200));
  }

  const totalMs = (performance.now() - t0).toFixed(0);
  addLog("info", `Done: ${_s.total} books, ${totalMs}ms total`);
  _s.running = false;
}
