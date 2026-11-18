"use client";
import { useEffect } from "react";

export default function OfflineServiceWorker() {
    useEffect(() => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
        if (process.env.NODE_ENV === "development") return;
        void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }, []);
    return null;
}
