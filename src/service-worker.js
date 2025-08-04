/// <reference types="@sveltejs/kit" />
import { build, files, version, prerendered } from '$service-worker';

// Create a unique cache name for this deployment
const CACHE = `cache-${version}`;

const ASSETS = [
	...build, // the app itself
	...files,  // everything in `static`
	...prerendered,
];

// console.log('SW: Script evaluating...')
self.addEventListener('install', (event) => {
	// console.log('SW: Installing...');
	// Create a new cache and add all files to it
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
		console.log('SW: Assets pre-cached successfully.');
	}

	event.waitUntil(addFilesToCache());
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	// console.log('SW: Activating...');
	// Remove previous cached data from disk
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) {
				console.log(`SW: Deleting old cache: ${key}`);
				await caches.delete(key);
			}
		}
		console.log('SW: Old caches cleaned up.');
	}

	event.waitUntil(deleteOldCaches());
	clients.claim();
});

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	if (url.protocol === 'chrome-extension:') {
		console.log(`SW: Skipping chrome-extension request: ${url.href}`);
		return;
	}


	// ignore POST requests etc
	if (event.request.method !== 'GET') return;


	async function respond() {
		const cache = await caches.open(CACHE);

		// `build`/`files` can always be served from the cache
		if (ASSETS.includes(url.pathname)) {
			const response = await cache.match(url.pathname);

			if (response) {
				return response;
			}
		}

		// for everything else, try the network first, but
		// fall back to the cache if we're offline
		try {
			const response = await fetch(event.request);

			// if we're offline, fetch can return a value that is not a Response
			// instead of throwing - and we can't pass this non-Response to respondWith
			if (!(response instanceof Response)) {
				throw new Error('invalid response from fetch');
			}

			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}

			return response;
		} catch (err) {
			const response = await cache.match(event.request);

			if (response) {
				return response;
			}

			// if there's no cache, then just error out
			// as there is nothing we can do to respond to this request
			throw err;
		}
	}

	event.respondWith(respond());
});