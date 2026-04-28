export function getDB(platform) {
  if (!platform?.env?.DB) {
    throw new Error("D1 database not available");
  }
  return platform.env.DB;
}
