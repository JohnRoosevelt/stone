/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  const response = await resolve(event);

  // COOP/COEP headers disabled for now - they block Vite dev server worker chunks
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  // response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");

  return response;
}
