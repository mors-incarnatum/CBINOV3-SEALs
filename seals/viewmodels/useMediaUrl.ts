"use client";
import { useEffect, useState } from "react";
import { iconPath } from "@/lib/board";
import { useBoardStore } from "@/store/BoardProvider";
import { mediaRepository } from "@/services/storage/mediaRepository";

export function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(() =>
        typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches),
    );
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return;
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
        mq.addEventListener?.("change", onChange);
        return () => mq.removeEventListener?.("change", onChange);
    }, []);
    return reduced;
}

/**
 * Resolves either an uploaded IndexedDB photo (by mediaId) or a bundled symbol
 * (static SVG by default, or animated GIF only when animation is enabled and
 * prefers-reduced-motion is false). Releases object URLs on unmount/change.
 */
export function useMediaUrl(iconName: string | null, mediaId?: string | null): {
    src: string | undefined;
    missingMedia: boolean;
} {
    const profileId = useBoardStore(s => s.activeProfileId);
    const animationEnabled = useBoardStore(s => s.featureFlags?.animation ?? false);
    const reducedMotion = useReducedMotion();
    const [resolved, setResolved] = useState<{
        mediaId: string;
        profileId: string;
        url: string | undefined;
        missing: boolean;
    } | null>(null);

    useEffect(() => {
        if (!mediaId) return;
        let cancelled = false;
        let objectUrl: string | undefined;
        void mediaRepository.loadMedia(profileId, mediaId).then(record => {
            if (cancelled) return;
            if (!record) {
                setResolved({ mediaId, profileId, url: undefined, missing: true });
                return;
            }
            objectUrl = URL.createObjectURL(record.blob);
            setResolved({ mediaId, profileId, url: objectUrl, missing: false });
        });
        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [profileId, mediaId]);

    if (mediaId) {
        const activeMatch =
            resolved && resolved.mediaId === mediaId && resolved.profileId === profileId ? resolved : null;
        if (activeMatch?.url) return { src: activeMatch.url, missingMedia: false };
        return {
            src: iconPath(iconName, animationEnabled && !reducedMotion),
            missingMedia: activeMatch?.missing ?? false,
        };
    }

    return {
        src: iconPath(iconName, animationEnabled && !reducedMotion),
        missingMedia: false,
    };
}
