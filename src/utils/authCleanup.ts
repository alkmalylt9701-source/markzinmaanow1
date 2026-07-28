export function clearStoredAuthSession() {
  if (typeof window === "undefined") return;

  const removeAuthKeys = (storage: Storage) => {
    Object.keys(storage)
      .filter((key) => key.startsWith("sb-") && key.endsWith("-auth-token"))
      .forEach((key) => storage.removeItem(key));
  };

  try {
    removeAuthKeys(window.localStorage);
    removeAuthKeys(window.sessionStorage);
  } catch {
    // تجاهل أخطاء التخزين في المتصفحات المقيدة
  }
}
