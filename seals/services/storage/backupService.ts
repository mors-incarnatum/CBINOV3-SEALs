import { uid } from "@/lib/board";
import { sanitizeBoardData } from "@/lib/boardDefaults";
import { isValidMediaId, type BoardData } from "@/models/boardData";
import { PROFILE_SCHEMA_VERSION, type LocalProfileDocument } from "@/models/profile";
import {
    ALLOWED_PHOTO_TYPES,
    computeBlobChecksum,
    discardPreparedMedia,
    mediaRepository,
    readBlobArrayBuffer,
    type IMediaRepository,
} from "@/services/storage/mediaRepository";

export interface BackupMediaManifestEntry {
    mediaId: string;
    mimeType: string;
    width: number;
    height: number;
    checksum: string;
}

export interface BackupMediaPayload extends BackupMediaManifestEntry {
    dataBase64: string;
}

export interface ProfileBackupPackage {
    format: "wikahon-profile-backup-v1";
    schemaVersion: typeof PROFILE_SCHEMA_VERSION;
    profileName: string;
    boardData: BoardData;
    manifest: BackupMediaManifestEntry[];
    media: BackupMediaPayload[];
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToBlob(base64: string, mimeType: string): Blob {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
}

export async function exportProfilePackage(
    profileId: string,
    profileName: string,
    boardData: BoardData,
    repo: IMediaRepository = mediaRepository,
): Promise<ProfileBackupPackage> {
    const sanitized: BoardData = structuredClone({
        tiles: boardData.tiles,
        boards: boardData.boards,
        catalogOrder: boardData.catalogOrder,
        gridConfig: boardData.gridConfig,
        layoutMode: boardData.layoutMode,
        tileAppearance: boardData.tileAppearance,
        speechConfig: boardData.speechConfig,
        accessConfig: boardData.accessConfig,
        featureFlags: boardData.featureFlags,
        ...(boardData.experimentalData ? { experimentalData: boardData.experimentalData } : {}),
        sentence: boardData.sentence,
    });
    // Never export unlock credentials or account tokens.
    sanitized.accessConfig.editPin = null;
    sanitized.accessConfig.pinVerifier = null;

    const referencedIds = new Set<string>();
    for (const tile of Object.values(sanitized.tiles)) {
        if (tile.mediaId) referencedIds.add(tile.mediaId);
    }
    for (const token of sanitized.sentence) {
        if (token.mediaId) referencedIds.add(token.mediaId);
    }

    const manifest: BackupMediaManifestEntry[] = [];
    const media: BackupMediaPayload[] = [];
    for (const mediaId of referencedIds) {
        const record = await repo.loadMedia(profileId, mediaId);
        if (!record) throw new Error(`Cannot export: missing photo ${mediaId}.`);
        const buf = await readBlobArrayBuffer(record.blob);
        const checksum = record.checksum || (await computeBlobChecksum(record.blob));
        const entry: BackupMediaManifestEntry = {
            mediaId,
            mimeType: record.mimeType,
            width: record.width,
            height: record.height,
            checksum,
        };
        manifest.push(entry);
        media.push({
            ...entry,
            dataBase64: arrayBufferToBase64(buf),
        });
    }

    return {
        format: "wikahon-profile-backup-v1",
        schemaVersion: PROFILE_SCHEMA_VERSION,
        profileName,
        boardData: sanitized,
        manifest,
        media,
    };
}

export async function validateAndPrepareImport(
    rawJson: string,
    repo: IMediaRepository = mediaRepository,
): Promise<{ ok: true; doc: LocalProfileDocument } | { ok: false; error: string }> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(rawJson);
    } catch {
        return { ok: false, error: "Backup file is not valid JSON." };
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, error: "Backup file format is invalid." };
    }

    const pkg = parsed as Partial<ProfileBackupPackage>;
    if (pkg.format !== "wikahon-profile-backup-v1") {
        return { ok: false, error: "Unsupported backup format." };
    }
    if (typeof pkg.schemaVersion !== "number" || pkg.schemaVersion > PROFILE_SCHEMA_VERSION) {
        return {
            ok: false,
            error: `Backup uses unsupported schema version ${String(pkg.schemaVersion)}.`,
        };
    }
    const sanitizedBoard = sanitizeBoardData(pkg.boardData);
    if (!sanitizedBoard) {
        return { ok: false, error: "Backup board data is incomplete or corrupted." };
    }
    if (!Array.isArray(pkg.manifest) || !Array.isArray(pkg.media)) {
        return { ok: false, error: "Backup media manifest is missing or corrupted." };
    }

    // Verify all media items & checksums before writing anything.
    const mediaMap = new Map<string, { blob: Blob; entry: BackupMediaManifestEntry }>();
    for (const item of pkg.media) {
        if (
            !item ||
            !isValidMediaId(item.mediaId) ||
            typeof item.dataBase64 !== "string" ||
            typeof item.mimeType !== "string" ||
            !ALLOWED_PHOTO_TYPES.has(item.mimeType)
        ) {
            return { ok: false, error: "Backup contains an invalid or unsupported media entry." };
        }
        try {
            const blob = base64ToBlob(item.dataBase64, item.mimeType);
            const actualChecksum = await computeBlobChecksum(blob);
            if (actualChecksum !== item.checksum) {
                return { ok: false, error: `Media checksum mismatch for ${item.mediaId}.` };
            }
            mediaMap.set(item.mediaId, { blob, entry: item });
        } catch {
            return { ok: false, error: `Could not decode media ${item.mediaId}.` };
        }
    }

    for (const expected of pkg.manifest) {
        if (!expected || !isValidMediaId(expected.mediaId)) {
            return { ok: false, error: "Backup contains an invalid manifest entry." };
        }
        if (!mediaMap.has(expected.mediaId)) {
            return { ok: false, error: `Missing media ${expected.mediaId} listed in manifest.` };
        }
    }

    const manifestIds = new Set(pkg.manifest.map(item => item.mediaId));
    const referencedIds = new Set<string>();
    for (const tile of Object.values(sanitizedBoard.tiles)) if (tile.mediaId) referencedIds.add(tile.mediaId);
    for (const token of sanitizedBoard.sentence) if (token.mediaId) referencedIds.add(token.mediaId);
    for (const id of referencedIds) {
        if (!manifestIds.has(id) || !mediaMap.has(id)) return { ok: false, error: `Backup is missing photo ${id}.` };
    }

    const newProfileId = `profile-${uid()}`;
    try {
        for (const [mediaId, { blob, entry }] of mediaMap) {
            const res = await repo.saveMedia(newProfileId, mediaId, blob, {
                mimeType: entry.mimeType,
                width: entry.width,
                height: entry.height,
                checksum: entry.checksum,
            });
            if (!res.ok) throw new Error(res.error ?? `Failed to store photo ${mediaId}.`);
        }
    } catch (error) {
        await discardPreparedMedia(newProfileId, repo);
        return { ok: false, error: error instanceof Error ? error.message : "Failed to store imported media." };
    }

    sanitizedBoard.accessConfig.editPin = null;
    sanitizedBoard.accessConfig.pinVerifier = null;

    return {
        ok: true,
        doc: {
            schemaVersion: PROFILE_SCHEMA_VERSION,
            localProfileId: newProfileId,
            name: `${(typeof pkg.profileName === "string" && pkg.profileName.trim()) || "Imported Profile"} (Imported)`,
            cloudProfileId: null,
            cloudRevision: null,
            dirty: false,
            boardData: sanitizedBoard,
        },
    };
}
