export interface StoredMediaRecord {
    key: string;
    profileId: string;
    mediaId: string;
    blob: Blob;
    mimeType: string;
    width: number;
    height: number;
    checksum: string;
}

export interface MediaSaveResult {
    ok: boolean;
    mediaId?: string;
    mimeType?: string;
    width?: number;
    height?: number;
    checksum?: string;
    error?: string;
}

export interface IMediaRepository {
    saveMedia(
        profileId: string,
        mediaId: string,
        blob: Blob,
        meta: { mimeType: string; width: number; height: number; checksum?: string },
    ): Promise<MediaSaveResult>;
    loadMedia(profileId: string, mediaId: string): Promise<StoredMediaRecord | null>;
    removeMedia(profileId: string, mediaId: string): Promise<void>;
    listProfileMedia(profileId: string): Promise<StoredMediaRecord[]>;
}

export async function discardPreparedMedia(profileId: string, repo: IMediaRepository = mediaRepository) {
    const records = await repo.listProfileMedia(profileId);
    await Promise.all(records.map(record => repo.removeMedia(profileId, record.mediaId)));
}

const DB_NAME = "wikahon-media-v1";
const DB_VERSION = 1;
const STORE_NAME = "media";

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTO_EDGE = 1024;
export const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function mediaKey(profileId: string, mediaId: string): string {
    return `${profileId}:${mediaId}`;
}

export async function readBlobArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    if (typeof blob.arrayBuffer === "function") {
        return blob.arrayBuffer();
    }
    return new Response(blob).arrayBuffer();
}

export async function computeBlobChecksum(blob: Blob): Promise<string> {
    const buffer = await readBlobArrayBuffer(blob);
    if (typeof crypto !== "undefined" && crypto.subtle && typeof crypto.subtle.digest === "function") {
        const digest = await crypto.subtle.digest("SHA-256", buffer);
        return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
    }
    const bytes = new Uint8Array(buffer);
    let hash = 2166136261;
    for (let i = 0; i < bytes.length; i++) {
        hash ^= bytes[i];
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}

function openMediaDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
            reject(new Error("IndexedDB is unavailable in this environment."));
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
                store.createIndex("profileId", "profileId", { unique: false });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not open media database."));
    });
}

export class IndexedDbMediaRepository implements IMediaRepository {
    async saveMedia(
        profileId: string,
        mediaId: string,
        blob: Blob,
        meta: { mimeType: string; width: number; height: number; checksum?: string },
    ): Promise<MediaSaveResult> {
        try {
            const bytes = await readBlobArrayBuffer(blob);
            const checksum = meta.checksum ?? (await computeBlobChecksum(blob));
            const db = await openMediaDb();
            const record = {
                key: mediaKey(profileId, mediaId),
                profileId,
                mediaId,
                bytes,
                mimeType: meta.mimeType,
                width: meta.width,
                height: meta.height,
                checksum,
            };
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, "readwrite");
                tx.objectStore(STORE_NAME).put(record);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error ?? new Error("Failed to save media."));
                tx.onabort = () => reject(tx.error ?? new Error("Saving media was interrupted."));
            });
            db.close();
            return {
                ok: true,
                mediaId,
                mimeType: meta.mimeType,
                width: meta.width,
                height: meta.height,
                checksum,
            };
        } catch (error) {
            return {
                ok: false,
                error: error instanceof Error ? error.message : "Could not save media.",
            };
        }
    }

    async loadMedia(profileId: string, mediaId: string): Promise<StoredMediaRecord | null> {
        try {
            const db = await openMediaDb();
            const record = await new Promise<StoredMediaRecord | null>((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, "readonly");
                const req = tx.objectStore(STORE_NAME).get(mediaKey(profileId, mediaId));
                req.onsuccess = () => {
                    const raw = req.result as
                        | (Omit<StoredMediaRecord, "blob"> & { blob?: Blob; bytes?: ArrayBuffer })
                        | undefined;
                    if (!raw) {
                        resolve(null);
                        return;
                    }
                    const blob =
                        raw.blob instanceof Blob
                            ? raw.blob
                            : new Blob([raw.bytes ?? new ArrayBuffer(0)], { type: raw.mimeType });
                    resolve({
                        key: raw.key,
                        profileId: raw.profileId,
                        mediaId: raw.mediaId,
                        blob,
                        mimeType: raw.mimeType,
                        width: raw.width,
                        height: raw.height,
                        checksum: raw.checksum,
                    });
                };
                req.onerror = () => reject(req.error ?? new Error("Failed to load media."));
            });
            db.close();
            return record;
        } catch {
            return null;
        }
    }

    async removeMedia(profileId: string, mediaId: string): Promise<void> {
        try {
            const db = await openMediaDb();
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, "readwrite");
                tx.objectStore(STORE_NAME).delete(mediaKey(profileId, mediaId));
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error ?? new Error("Failed to delete media."));
            });
            db.close();
        } catch {
            // Best-effort cleanup.
        }
    }

    async listProfileMedia(profileId: string): Promise<StoredMediaRecord[]> {
        try {
            const db = await openMediaDb();
            const items = await new Promise<StoredMediaRecord[]>((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, "readonly");
                const index = tx.objectStore(STORE_NAME).index("profileId");
                const req = index.getAll(profileId);
                req.onsuccess = () => resolve((req.result as StoredMediaRecord[]) ?? []);
                req.onerror = () => reject(req.error ?? new Error("Failed to list profile media."));
            });
            db.close();
            return items;
        } catch {
            return [];
        }
    }
}

export const mediaRepository: IMediaRepository = new IndexedDbMediaRepository();

export interface ProcessedPhoto {
    blob: Blob;
    mimeType: string;
    width: number;
    height: number;
}

/**
 * Validates JPEG, PNG, or WebP up to 10 MB, crops to a square or optional aspect,
 * constrains longest edge to 1024px, and re-encodes via canvas to strip EXIF metadata.
 */
export async function validateAndProcessPhoto(
    file: File,
    cropSquare = true,
): Promise<{ ok: true; data: ProcessedPhoto } | { ok: false; error: string }> {
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
        return { ok: false, error: "Unsupported image format. Please choose a JPEG, PNG, or WebP file." };
    }
    if (file.size <= 0 || file.size > MAX_PHOTO_BYTES) {
        return { ok: false, error: "Image must be between 1 byte and 10 MB." };
    }
    if (typeof document === "undefined") {
        return { ok: false, error: "Image processing requires a browser environment." };
    }

    const objectUrl = URL.createObjectURL(file);
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error("The selected file could not be decoded as an image."));
            el.src = objectUrl;
        });

        const srcW = img.naturalWidth;
        const srcH = img.naturalHeight;
        if (!srcW || !srcH) {
            return { ok: false, error: "The selected image has invalid dimensions." };
        }

        let sx = 0;
        let sy = 0;
        let sw = srcW;
        let sh = srcH;
        if (cropSquare) {
            const side = Math.min(srcW, srcH);
            sx = Math.floor((srcW - side) / 2);
            sy = Math.floor((srcH - side) / 2);
            sw = side;
            sh = side;
        }

        const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(sw, sh));
        const destW = Math.max(1, Math.round(sw * scale));
        const destH = Math.max(1, Math.round(sh * scale));

        const canvas = document.createElement("canvas");
        canvas.width = destW;
        canvas.height = destH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return { ok: false, error: "Could not prepare image canvas." };
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, destW, destH);

        const outType = file.type === "image/png" ? "image/png" : "image/webp";
        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                result => (result ? resolve(result) : reject(new Error("Failed to encode processed image."))),
                outType,
                0.88,
            );
        });

        return {
            ok: true,
            data: { blob, mimeType: outType, width: destW, height: destH },
        };
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : "Could not process image.",
        };
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}
