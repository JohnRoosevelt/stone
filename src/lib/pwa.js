// PWA Install helper
//
// Usage example:
//
// <script>
//   import { isInstallable, triggerInstall } from "$lib/pwa.js";
//
//   let showInstall = $state(isInstallable());
//
//   window.addEventListener("pwa-install-ready", () => {
//     showInstall = isInstallable();
//   });
// </script>
//
// {#if showInstall}
//   <button onclick={triggerInstall}>安装到桌面</button>
// {/if}

let deferredPrompt;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  console.log("PWA: Install prompt available");
  window.dispatchEvent(new CustomEvent("pwa-install-ready"));
});

export function isInstallable() {
  return !!deferredPrompt;
}

export function triggerInstall() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then((choice) => {
    console.log(
      `PWA: User ${choice.outcome === "accepted" ? "accepted" : "dismissed"}`,
    );
    deferredPrompt = null;
  });
}
