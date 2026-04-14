import { sqlite3Worker1Promiser } from "@sqlite.org/sqlite-wasm";

export async function initSQLite() {
  try {
    console.log("Loading and initializing SQLite3 module...");

    const promiser = await new Promise((resolve) => {
      sqlite3Worker1Promiser({
        onready: resolve,
      });
    });

    console.log("Done initializing. Running demo...");
    const configResponse = await promiser("config-get");
    console.log(
      "Running SQLite3 version",
      configResponse.result.version.libVersion,
    );

    const openResponse = await promiser("open", {
      filename: "file:mydb.sqlite3?vfs=opfs",
    });

    const { dbId } = openResponse;
    console.log(
      "OPFS is available, created persisted database at",
      openResponse.result.filename.replace(/^file:(.*?)\?vfs=opfs$/, "$1"),
    );

    // Your SQLite code here.
    return { promiser, dbId };
  } catch (err) {
    if (!(err instanceof Error)) {
      err = new Error(err.result.message);
    }
    console.error(err.name, err.message);
  }
}
