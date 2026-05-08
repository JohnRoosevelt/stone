/** Validate numeric CID (0=bible, 1=sda, 2=book), returns undefined if invalid */
export function validateCid(cid) {
  const n = Number(cid);
  return Number.isInteger(n) && n >= 0 && n <= 2 ? n : undefined;
}

export function getDB(platform) {
  if (!platform?.env?.DB) {
    throw new Error("D1 database not available");
  }
  return platform.env.DB;
}
