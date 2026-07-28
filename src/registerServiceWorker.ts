export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => console.log('Service worker registered:', registration))
        .catch((err) => console.error('Service worker registration failed:', err));
    });
  }
}
