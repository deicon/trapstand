export async function refreshPwa(): Promise<void> {
  const registration = await navigator.serviceWorker?.getRegistration?.();
  await registration?.update?.();

  if (registration?.waiting) {
    let didReload = false;
    const reloadOnce = () => {
      if (didReload) {
        return;
      }

      didReload = true;
      window.location.reload();
    };

    navigator.serviceWorker?.addEventListener?.("controllerchange", reloadOnce, { once: true });
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    window.setTimeout(reloadOnce, 1000);
    return;
  }

  window.location.reload();
}
