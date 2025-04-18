export async function wakeLock() {
  navigator.wakeLock?.request('screen').then(wakeLock => {
    console.log('Wake Lock is active!');

    wakeLock.addEventListener('release', () => {
      console.log('Wake Lock has been released');
    });
  }).catch(error => console.error({ error }))
}