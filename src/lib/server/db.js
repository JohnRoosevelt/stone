/** 验证数字 CID（0=bible, 1=sda, 2=book），无效返回 undefined */
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
