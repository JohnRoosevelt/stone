export async function wakeLock() {
  navigator.wakeLock?.request('screen').then(wakeLock => {
    console.log('Wake Lock is active!');

    wakeLock.addEventListener('release', () => {
      console.log('Wake Lock has been released');
    });
  }).catch(error => console.error({ error }))
}


		// let wakeLock;
		// let preventSleep;

		// async function requestWakeLock() {
			
		// 	try {
		// 		wakeLock = await navigator.wakeLock.request('screen');
		// 		console.log('Wake Lock is active!');

		// 		wakeLock.addEventListener('release', () => {
		// 			console.log('Wake Lock has been released');
		// 			wakeLock = undefined;
		// 		});
		// 	} catch (err) {
		// 		console.error(`${err.name}, ${err.message}`);
		// 		preventSleep = setInterval(() => {
		// 			if (preventSleep) {
		// 				console.log("Keeping the device awake...", preventSleep);
		// 			}
		// 		}, 10000);
		// 	}
		// }

		// async function releaseWakeLock() {
			
		// 	if (wakeLock) {
		// 		await wakeLock.release();
		// 		console.log('Wake Lock has been released.....');
		// 		wakeLock = undefined;
		// 	}

		// 	if (preventSleep) {
		// 		clearInterval(preventSleep)
		// 		preventSleep = undefined
		// 	}
		// }

		// window.addEventListener('load', requestWakeLock);

		// document.addEventListener('visibilitychange', async () => {
		// 	console.log(document.visibilityState);
			
		// 	if (document.visibilityState === 'visible') {
		// 		await requestWakeLock();
		// 	} else {
		// 		await releaseWakeLock();
		// 	}
		// });