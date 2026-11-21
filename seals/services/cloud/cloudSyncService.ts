import { uid, type CatalogBoard, type Tile } from "@/lib/board";
import { initialData } from "@/lib/boardDefaults";
import type { BoardData } from "@/models/boardData";
import { PROFILE_SCHEMA_VERSION, type LocalProfileDocument } from "@/models/profile";
import { getSupabaseBrowserClient, type BoardSupabaseClient } from "@/models/supabase/client";
import { SupabaseBoardRepository, type IBoardRepository } from "@/models/supabase/boardRepository";
import type { ProfileRow } from "@/models/supabase/database.types";
import { tileToWord, wordToTile } from "@/models/supabase/mappers";
import type { Word } from "@/models/word";
import { discardPreparedMedia, mediaRepository, type IMediaRepository } from "@/services/storage/mediaRepository";

export interface CloudUser {
    id: string;
    email: string | null;
}

export class CloudSyncService {
    constructor(
        private readonly getClient: () => BoardSupabaseClient | null = getSupabaseBrowserClient,
        private readonly makeRepo: (client: BoardSupabaseClient) => IBoardRepository = c =>
            new SupabaseBoardRepository(c),
        private readonly mediaRepo: IMediaRepository = mediaRepository,
    ) {}

    isConfigured(): boolean {
        return this.getClient() !== null;
    }

    async getCurrentUser(): Promise<CloudUser | null> {
        const client = this.getClient();
        if (!client) return null;
        const { data } = await client.auth.getUser();
        if (!data.user) return null;
        return { id: data.user.id, email: data.user.email ?? null };
    }

    async signIn(email: string, password: string): Promise<{ ok: boolean; user?: CloudUser; error?: string }> {
        const client = this.getClient();
        if (!client) return { ok: false, error: "Supabase is not configured in environment variables." };
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error || !data.user) {
            return { ok: false, error: error?.message ?? "Sign in failed." };
        }
        return { ok: true, user: { id: data.user.id, email: data.user.email ?? null } };
    }

    async signUp(email: string, password: string): Promise<{ ok: boolean; user?: CloudUser; error?: string }> {
        const client = this.getClient();
        if (!client) return { ok: false, error: "Supabase is not configured in environment variables." };
        const { data, error } = await client.auth.signUp({ email, password });
        if (error) {
            return { ok: false, error: error.message };
        }
        if (!data.user) {
            return { ok: true };
        }
        return { ok: true, user: { id: data.user.id, email: data.user.email ?? null } };
    }

    async signOut(): Promise<void> {
        const client = this.getClient();
        if (!client) return;
        await client.auth.signOut();
    }

    async listCloudProfiles(): Promise<{ ok: boolean; profiles: ProfileRow[]; error?: string }> {
        const client = this.getClient();
        if (!client) return { ok: false, profiles: [], error: "Supabase is not configured." };
        try {
            const repo = this.makeRepo(client);
            const profiles = await repo.listProfiles();
            return { ok: true, profiles };
        } catch (error) {
            return {
                ok: false,
                profiles: [],
                error: error instanceof Error ? error.message : "Could not list cloud profiles.",
            };
        }
    }

    async publishProfile(params: {
        localProfileId: string;
        profileName: string;
        cloudProfileId: string | null;
        expectedRevision: number | null;
        boardData: BoardData;
    }): Promise<{ ok: boolean; cloudProfileId?: string; revision?: number; error?: string }> {
        const client = this.getClient();
        if (!client) return { ok: false, error: "Supabase is not configured." };
        const user = await this.getCurrentUser();
        if (!user) return { ok: false, error: "Please sign in as a guardian before publishing." };

        const repo = this.makeRepo(client);
        let targetCloudId = params.cloudProfileId;
        let expectedRev = params.expectedRevision;
        try {
            if (!targetCloudId) {
                const created = await repo.createProfile(params.profileName);
                targetCloudId = created.id;
                expectedRev = created.revision ?? 1;
            }

            // 1. Publish referenced media first to the private profile-scoped bucket.
            const mediaIds = new Set<string>();
            for (const tile of Object.values(params.boardData.tiles)) {
                if (tile.mediaId) mediaIds.add(tile.mediaId);
            }
            for (const mediaId of mediaIds) {
                const record = await this.mediaRepo.loadMedia(params.localProfileId, mediaId);
                if (!record) throw new Error(`Cannot publish: missing photo ${mediaId}.`);
                await repo.uploadProfileMedia(targetCloudId, mediaId, record.blob, record.mimeType);
            }

            // 2. Normalize boards, words (public.words), and folder tiles (public.tiles).
            const boards: CatalogBoard[] = Object.values(params.boardData.boards);
            const boardIds = new Set(boards.map(b => b.id));
            const fallbackCategoryId = boardIds.has("home") ? "home" : (boards[0]?.id ?? "home");
            const words: Word[] = [];
            const folderTiles: Tile[] = [];
            for (const tile of Object.values(params.boardData.tiles)) {
                const normalizedCategoryId = boardIds.has(tile.categoryId) ? tile.categoryId : fallbackCategoryId;
                if (tile.kind === "word") {
                    words.push(tileToWord({ ...tile, categoryId: normalizedCategoryId }));
                } else if (tile.kind === "folder" && tile.targetBoardId && boardIds.has(tile.targetBoardId)) {
                    folderTiles.push({ ...tile, categoryId: normalizedCategoryId });
                }
            }

            // 3. Fetch existing remote rows to determine stale IDs.
            const [existingBoards, existingTiles, existingWords] = await Promise.all([
                repo.listBoards(targetCloudId),
                repo.listTiles(targetCloudId),
                repo.listWords(targetCloudId),
            ]);
            const wordIdSet = new Set(words.map(w => w.id));
            const folderIdSet = new Set(folderTiles.map(t => t.id));
            const staleWordIds = existingWords.map(w => w.id).filter(id => !wordIdSet.has(id));
            const staleTileIds = existingTiles.map(t => t.id).filter(id => !folderIdSet.has(id));
            const staleBoardIds = existingBoards.map(b => b.id).filter(id => !boardIds.has(id));

            // 4. Sync tables in foreign-key-safe order.
            await repo.saveBoards(targetCloudId, boards);
            await Promise.all([
                repo.deleteTiles(targetCloudId, staleTileIds),
                repo.deleteWords(targetCloudId, staleWordIds),
            ]);
            await Promise.all([repo.saveWords(targetCloudId, words), repo.saveTiles(targetCloudId, folderTiles)]);
            await repo.deleteBoards(targetCloudId, staleBoardIds);
            await repo.saveSettings(targetCloudId, {
                catalogOrder: params.boardData.catalogOrder,
                gridConfig: params.boardData.gridConfig,
                layoutMode: params.boardData.layoutMode,
                tileAppearance: params.boardData.tileAppearance,
                speechConfig: params.boardData.speechConfig,
                accessConfig: {
                    longPressToEdit: params.boardData.accessConfig.longPressToEdit,
                    holdDurationMs: params.boardData.accessConfig.holdDurationMs,
                    moveTolerancePx: params.boardData.accessConfig.moveTolerancePx,
                    swipeThresholdPx: params.boardData.accessConfig.swipeThresholdPx,
                },
                featureFlags: params.boardData.featureFlags,
            });

            // 5. Clean up orphaned storage objects in profile-media.
            const remoteMediaIds = await repo.listProfileMedia(targetCloudId);
            const orphanedMediaIds = remoteMediaIds.filter(id => !mediaIds.has(id));
            if (orphanedMediaIds.length > 0) {
                await repo.removeProfileMedia(targetCloudId, orphanedMediaIds);
            }

            const nextRevision = params.cloudProfileId ? (expectedRev ?? 1) + 1 : (expectedRev ?? 1);
            return { ok: true, cloudProfileId: targetCloudId, revision: nextRevision };
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Cloud publish failed.";
            let errorMessage = msg;
            if (msg.includes("STALE_REVISION")) {
                errorMessage =
                    "Cloud profile was updated on another device. Download a copy before publishing; your local draft is intact.";
            } else if (msg.includes("PERMISSION_DENIED")) {
                errorMessage = "Read-only viewer accounts cannot publish changes to this cloud profile.";
            }
            return {
                ok: false,
                ...(targetCloudId ? { cloudProfileId: targetCloudId, revision: expectedRev ?? 1 } : {}),
                error: errorMessage,
            };
        }
    }

    async downloadAsLocalCopy(
        cloudProfile: ProfileRow,
    ): Promise<{ ok: boolean; doc?: LocalProfileDocument; error?: string }> {
        const client = this.getClient();
        if (!client) return { ok: false, error: "Supabase is not configured." };
        const user = await this.getCurrentUser();
        if (!user) return { ok: false, error: "Please sign in as a guardian first." };

        const repo = this.makeRepo(client);
        const localProfileId = `profile-${uid()}`;
        try {
            const [boards, folderTiles, words, settings] = await Promise.all([
                repo.listBoards(cloudProfile.id),
                repo.listTiles(cloudProfile.id),
                repo.listWords(cloudProfile.id),
                repo.getSettings(cloudProfile.id),
            ]);

            const defaults = initialData();
            const boardMap: Record<string, CatalogBoard> = {};
            for (const b of boards) boardMap[b.id] = b;
            const tileMap: Record<string, Tile> = {};
            for (const t of words.map(wordToTile)) tileMap[t.id] = t;
            for (const t of folderTiles) tileMap[t.id] = t;

            // Download referenced media into local IndexedDB under the new localProfileId.
            const mediaIds = new Set(Object.values(tileMap).flatMap(tile => (tile.mediaId ? [tile.mediaId] : [])));
            for (const mediaId of mediaIds) {
                const blob = await repo.downloadProfileMedia(cloudProfile.id, mediaId);
                if (!blob) throw new Error(`Could not download photo ${mediaId}.`);
                const saved = await this.mediaRepo.saveMedia(localProfileId, mediaId, blob, {
                    mimeType: blob.type || "image/webp", width: 0, height: 0,
                });
                if (!saved.ok) throw new Error(`Could not save photo ${mediaId}: ${saved.error ?? "storage error"}`);
            }

            const boardData: BoardData = {
                ...defaults,
                boards: Object.keys(boardMap).length ? boardMap : defaults.boards,
                tiles: Object.keys(tileMap).length ? tileMap : defaults.tiles,
                ...(settings
                    ? {
                          catalogOrder: settings.catalogOrder,
                          gridConfig: settings.gridConfig,
                          layoutMode: settings.layoutMode ?? defaults.layoutMode,
                          tileAppearance: settings.tileAppearance,
                          speechConfig: settings.speechConfig,
                          accessConfig: {
                              ...defaults.accessConfig,
                              ...settings.accessConfig,
                          },
                          featureFlags: settings.featureFlags ?? defaults.featureFlags,
                      }
                    : {}),
                sentence: [],
            };

            return {
                ok: true,
                doc: {
                    schemaVersion: PROFILE_SCHEMA_VERSION,
                    localProfileId,
                    name: cloudProfile.name,
                    cloudProfileId: cloudProfile.id,
                    cloudRevision: cloudProfile.revision ?? 1,
                    dirty: false,
                    boardData,
                },
            };
        } catch (error) {
            await discardPreparedMedia(localProfileId, this.mediaRepo);
            return {
                ok: false,
                error: error instanceof Error ? error.message : "Could not download cloud profile.",
            };
        }
    }
}

export const cloudSyncService = new CloudSyncService();
