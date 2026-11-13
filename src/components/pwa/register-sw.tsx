"use client";

import { useEffect, useState } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Install still works without a worker; the page stays online-first.
    });
  }, []);
  return null;
}

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="bg-danger px-4 py-2 text-center text-sm font-semibold text-white">
      You&apos;re offline. FloorTrack can show the last cached screen, but signing in and saving need a connection.
    </div>
  );
}
