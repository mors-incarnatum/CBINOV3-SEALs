import { uid } from "@/lib/board";
import { initialData, migrateV1, sanitizeBoardData, upgradeV2ToV3BoardData } from "@/lib/boardDefaults";
import { createPinVerifier } from "@/lib/pinVerifier";
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
export const LEGACY_V2_KEY = "wikahon-board-v2";
export const LEGACY_V1_KEY = "wikahon-board-v1";

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

async function migratePinIfNeeded(boardData: BoardData): Promise<BoardData> {
    const legacyPin = boardData.accessConfig.editPin;
    if (typeof legacyPin === "string" && legacyPin.trim().length > 0 && !boardData.accessConfig.pinVerifier) {
        const verifier = await createPinVerifier(legacyPin.trim());
        return {
            ...boardData,
            accessConfig: {
                ...boardData.accessConfig,
                editPin: null,
                pinVerifier: verifier,
            },
        };
    }
    if (boardData.accessConfig.editPin !== null) {
        return {
            ...boardData,
            accessConfig: {
                ...boardData.accessConfig,
                editPin: null,
            },
        };
    }
    return boardData;
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
            const payload = JSON.stringify({
                ...doc,
                schemaVersion: PROFILE_SCHEMA_VERSION,
                dirty: false,
                lastSavedAt: new Date().toISOString(),
            });
            storage.setItem(profileStorageKey(doc.localProfileId), payload);
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
            lastSavedAt: null,
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

        // Migrate from v2 first, then v1 fallback. Never pass v2 through migrateV1.
        let migratedBoard: BoardData | null = null;
        const rawV2 = storage.getItem(LEGACY_V2_KEY);
        if (rawV2) {
            const parsedV2 = safeParseJson(rawV2);
            if (!parsedV2.ok || !parsedV2.value || typeof parsedV2.value !== "object") {
                return {
                    index: fallbackIndex,
                    activeDocument: fallbackDoc,
                    status: "corrupt",
                    errorMessage: "Legacy v2 board data is corrupted. Preserved without overwriting.",
                };
            }
            const v2Record = parsedV2.value as Record<string, unknown>;
            const v2Version = typeof v2Record.version === "number" ? v2Record.version : 2;
            if (v2Version > PROFILE_SCHEMA_VERSION) {
                return {
                    index: fallbackIndex,
                    activeDocument: fallbackDoc,
                    status: "unsupported-version",
                    errorMessage: `Unsupported board version ${v2Version}. Existing data is preserved.`,
                    unsupportedPayload: v2Record,
                };
            }
            migratedBoard = upgradeV2ToV3BoardData(v2Record.state ?? v2Record);
        } else {
            const rawV1 = storage.getItem(LEGACY_V1_KEY);
            if (rawV1) {
                const parsedV1 = safeParseJson(rawV1);
                if (!parsedV1.ok || !parsedV1.value || typeof parsedV1.value !== "object") {
                    return {
                        index: fallbackIndex,
                        activeDocument: fallbackDoc,
                        status: "corrupt",
                        errorMessage: "Legacy v1 board data is corrupted. Preserved without overwriting.",
                    };
                }
                const v1Record = parsedV1.value as Record<string, unknown>;
                migratedBoard = migrateV1(v1Record.state ?? v1Record);
            }
        }

        const boardData = await migratePinIfNeeded(migratedBoard ?? initialData());
        const localProfileId = fallbackDoc.localProfileId;
        const doc: LocalProfileDocument = {
            schemaVersion: PROFILE_SCHEMA_VERSION,
            localProfileId,
            name: "Lily's Board",
            cloudProfileId: null,
            cloudRevision: null,
            dirty: false,
            lastSavedAt: new Date().toISOString(),
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
            lastSavedAt: new Date().toISOString(),
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
