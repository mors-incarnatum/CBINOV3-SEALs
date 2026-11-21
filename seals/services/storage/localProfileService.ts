import { uid } from "@/lib/board";
import { initialData, sanitizeBoardData } from "@/lib/boardDefaults";
import {
    PROFILE_SCHEMA_VERSION,
    type ActiveProfileIndex,
    type LocalProfileDocument,
    type LocalProfileLoadResult,
    type LocalStorageStatus,
} from "@/models/profile";
import type { BoardData } from "@/models/boardData";

export const ACTIVE_PROFILE_INDEX_KEY = "wikahon-active-profile-v3";
export const PROFILE_KEY_PREFIX = "wikahon-board-v3:";

export function profileStorageKey(localProfileId: string): string {
    return `${PROFILE_KEY_PREFIX}${localProfileId}`;
}

export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

function getBrowserStorage(storage?: StorageLike | null): StorageLike | null {
    if (storage !== undefined) return storage;
    try {
        if (typeof window !== "undefined" && window.localStorage) {
            return window.localStorage;
        }
    } catch {
        return null;
    }
    return null;
}

function classifyWriteError(error: unknown): { status: LocalStorageStatus; message: string } {
    const name = error instanceof Error ? error.name : "";
    if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
        return {
            status: "quota-exceeded",
            message: "Device storage is full. Changes remain in memory, but could not be saved. Export a backup.",
        };
    }
    return {
        status: "unavailable",
        message: "Browser storage is unavailable. Changes remain in memory for this session only.",
    };
}

function safeParseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
    try {
        return { ok: true, value: JSON.parse(raw) };
    } catch {
        return { ok: false };
    }
}

// Another tab may have upgraded this key since the active board was loaded.
function savedWithNewerVersion(storage: StorageLike, key: string): boolean {
    const raw = storage.getItem(key);
    if (raw === null) return false;
    const parsed = safeParseJson(raw);
    return parsed.ok && typeof parsed.value === "object" && parsed.value !== null
        && "schemaVersion" in parsed.value && typeof parsed.value.schemaVersion === "number"
        && parsed.value.schemaVersion > PROFILE_SCHEMA_VERSION;
}

export class LocalProfileService {
    private storage: StorageLike | null;

    constructor(storage?: StorageLike | null) {
        this.storage = getBrowserStorage(storage);
    }

    private getStorage(): StorageLike | null {
        return this.storage ?? getBrowserStorage();
    }

    saveProfileDocument(doc: LocalProfileDocument): { ok: boolean; status: LocalStorageStatus; errorMessage?: string } {
        const storage = this.getStorage();
        if (!storage) {
            return {
                ok: false,
                status: "unavailable",
                errorMessage: "Browser storage is unavailable. Changes are kept in memory only.",
            };
        }
        try {
            const key = profileStorageKey(doc.localProfileId);
            if (savedWithNewerVersion(storage, key)) {
                return { ok: false, status: "unsupported-version", errorMessage: "This profile was saved by a newer version. Changes are kept in memory." };
            }
            const payload = JSON.stringify({
                ...doc,
                schemaVersion: PROFILE_SCHEMA_VERSION,
                dirty: false,
            });
            storage.setItem(key, payload);
            return { ok: true, status: "ok" };
        } catch (error) {
            const classified = classifyWriteError(error);
            return { ok: false, status: classified.status, errorMessage: classified.message };
        }
    }

    saveActiveIndex(index: ActiveProfileIndex): { ok: boolean; status: LocalStorageStatus; errorMessage?: string } {
        const storage = this.getStorage();
        if (!storage) {
            return { ok: false, status: "unavailable", errorMessage: "Browser storage is unavailable." };
        }
        try {
            if (savedWithNewerVersion(storage, ACTIVE_PROFILE_INDEX_KEY)) {
                return { ok: false, status: "unsupported-version", errorMessage: "The saved profile list requires a newer version." };
            }
            storage.setItem(ACTIVE_PROFILE_INDEX_KEY, JSON.stringify(index));
            return { ok: true, status: "ok" };
        } catch (error) {
            const classified = classifyWriteError(error);
            return { ok: false, status: classified.status, errorMessage: classified.message };
        }
    }

    loadProfileDocument(localProfileId: string): {
        doc: LocalProfileDocument | null;
        status: LocalStorageStatus;
        errorMessage?: string;
        unsupportedPayload?: unknown;
    } {
        const storage = this.getStorage();
        if (!storage) {
            return { doc: null, status: "unavailable", errorMessage: "Browser storage is unavailable." };
        }
        const raw = storage.getItem(profileStorageKey(localProfileId));
        if (!raw) {
            return { doc: null, status: "corrupt", errorMessage: "Profile data was not found." };
        }
        const parsed = safeParseJson(raw);
        if (!parsed.ok || !parsed.value || typeof parsed.value !== "object") {
            return { doc: null, status: "corrupt", errorMessage: "Profile data is corrupted." };
        }
        const obj = parsed.value as Record<string, unknown>;
        const version = typeof obj.schemaVersion === "number" ? obj.schemaVersion : 0;
        if (version > PROFILE_SCHEMA_VERSION) {
            return {
                doc: null,
                status: "unsupported-version",
                errorMessage: `Profile uses unsupported schema version ${version}. Preserved without overwriting.`,
                unsupportedPayload: obj,
            };
        }
        const validBoard = sanitizeBoardData(obj.boardData);
        if (version !== PROFILE_SCHEMA_VERSION || !validBoard) {
            return { doc: null, status: "corrupt", errorMessage: "Profile data is invalid." };
        }
        return {
            doc: { ...(obj as unknown as LocalProfileDocument), boardData: validBoard },
            status: "ok",
        };
    }

    async loadOrMigrateActiveProfile(): Promise<LocalProfileLoadResult> {
        const storage = this.getStorage();
        const fallbackDoc: LocalProfileDocument = {
            schemaVersion: PROFILE_SCHEMA_VERSION,
            localProfileId: "default",
            name: "Lily's Board",
            cloudProfileId: null,
            cloudRevision: null,
            dirty: false,
            boardData: initialData(),
        };
        const fallbackIndex: ActiveProfileIndex = {
            schemaVersion: PROFILE_SCHEMA_VERSION,
            activeProfileId: fallbackDoc.localProfileId,
            profiles: [{ localProfileId: fallbackDoc.localProfileId, name: fallbackDoc.name, cloudProfileId: null }],
        };

        if (!storage) {
            return {
                index: fallbackIndex,
                activeDocument: fallbackDoc,
                status: "unavailable",
                errorMessage: "Browser storage is unavailable. Using a temporary in-memory board.",
            };
        }

        const rawIndex = storage.getItem(ACTIVE_PROFILE_INDEX_KEY);
        if (rawIndex) {
            const parsedIndex = safeParseJson(rawIndex);
            if (!parsedIndex.ok || !parsedIndex.value || typeof parsedIndex.value !== "object") {
                return {
                    index: fallbackIndex,
                    activeDocument: fallbackDoc,
                    status: "corrupt",
                    errorMessage: "Profile index is corrupted. Using a temporary in-memory board without overwriting saved data.",
                };
            }
            const idxObj = parsedIndex.value as Record<string, unknown>;
            const idxVersion = typeof idxObj.schemaVersion === "number" ? idxObj.schemaVersion : 0;
            if (idxVersion > PROFILE_SCHEMA_VERSION) {
                return {
                    index: fallbackIndex,
                    activeDocument: fallbackDoc,
                    status: "unsupported-version",
                    errorMessage: `Unsupported profile index version ${idxVersion}. Existing data is preserved.`,
                    unsupportedPayload: idxObj,
                };
            }
            const index = idxObj as unknown as ActiveProfileIndex;
            const loaded = this.loadProfileDocument(index.activeProfileId);
            if (loaded.doc) {
                return { index, activeDocument: loaded.doc, status: "ok" };
            }
            return {
                index,
                activeDocument: fallbackDoc,
                status: loaded.status,
                errorMessage: loaded.errorMessage,
                unsupportedPayload: loaded.unsupportedPayload,
            };
        }

        // A failed index write can leave a complete profile at the default key.
        if (storage.getItem(profileStorageKey(fallbackDoc.localProfileId)) !== null) {
            const loaded = this.loadProfileDocument(fallbackDoc.localProfileId);
            if (!loaded.doc) {
                return { ...loaded, index: fallbackIndex, activeDocument: fallbackDoc };
            }
            fallbackIndex.profiles[0] = {
                localProfileId: loaded.doc.localProfileId,
                name: loaded.doc.name,
                cloudProfileId: loaded.doc.cloudProfileId,
            };
            const saved = this.saveActiveIndex(fallbackIndex);
            return { index: fallbackIndex, activeDocument: loaded.doc, status: saved.status, errorMessage: saved.errorMessage };
        }

        const boardData = initialData();
        const localProfileId = fallbackDoc.localProfileId;
        const doc: LocalProfileDocument = {
            schemaVersion: PROFILE_SCHEMA_VERSION,
            localProfileId,
            name: "Lily's Board",
            cloudProfileId: null,
            cloudRevision: null,
            dirty: false,
            boardData,
        };
        const index: ActiveProfileIndex = {
            schemaVersion: PROFILE_SCHEMA_VERSION,
            activeProfileId: localProfileId,
            profiles: [{ localProfileId, name: doc.name, cloudProfileId: null }],
        };

        // Write and verify v3 document before switching active pointer.
        const writeDoc = this.saveProfileDocument(doc);
        if (!writeDoc.ok) {
            return {
                index,
                activeDocument: doc,
                status: writeDoc.status,
                errorMessage: writeDoc.errorMessage,
            };
        }
        const writeIndex = this.saveActiveIndex(index);
        if (!writeIndex.ok) {
            return {
                index,
                activeDocument: doc,
                status: writeIndex.status,
                errorMessage: writeIndex.errorMessage,
            };
        }
        return { index, activeDocument: doc, status: "ok" };
    }

    createProfileDocument(name: string, boardData?: BoardData): LocalProfileDocument {
        return {
            schemaVersion: PROFILE_SCHEMA_VERSION,
            localProfileId: `profile-${uid()}`,
            name: name.trim() || "Child Profile",
            cloudProfileId: null,
            cloudRevision: null,
            dirty: false,
            boardData: boardData ?? initialData(),
        };
    }

    deleteProfileDocument(localProfileId: string): void {
        const storage = this.getStorage();
        if (!storage) return;
        try {
            storage.removeItem(profileStorageKey(localProfileId));
        } catch {
            // Ignore storage removal errors.
        }
    }
}

export const localProfileService = new LocalProfileService();
