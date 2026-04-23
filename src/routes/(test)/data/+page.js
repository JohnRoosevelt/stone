import { browser, dev } from "$app/environment";

export function load({ data }) {
  console.log("info:", data, `broswer: ${browser}, dev: ${dev}`);

  if (browser) {
    console.log("browser data:", data);
    return { ...data, b: "data from client" };
  }
}
