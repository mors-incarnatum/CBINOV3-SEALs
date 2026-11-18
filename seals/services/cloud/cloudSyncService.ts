import { uid, type CatalogBoard, type Tile } from "@/lib/board";
import { initialData } from "@/lib/boardDefaults";
import type { BoardData } from "@/models/boardData";
import { PROFILE_SCHEMA_VERSION, type LocalProfileDocument } from "@/models/profile";
import { getSupabaseBrowserClient, type BoardSupabaseClient } from "@/models/supabase/client";
import { SupabaseBoardRepository, type IBoardRepository } from "@/models/supabase/boardRepository";
import type { ProfileRow } from "@/models/supabase/database.types";
import { mediaRepository, type IMediaRepository } from "@/services/storage/mediaRepository";

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
                if (record) {
                    await repo.uploadProfileMedia(targetCloudId, mediaId, record.blob, record.mimeType);
                }
            }

            // 2. Commit boards, tiles, and settings atomically with revision check.
            const boards: CatalogBoard[] = Object.values(params.boardData.boards);
            const tiles: Tile[] = Object.values(params.boardData.tiles);
            const nextRevision = await repo.publishProfileSnapshot(targetCloudId, expectedRev, boards, tiles, {
                catalogOrder: params.boardData.catalogOrder,
                gridConfig: params.boardData.gridConfig,
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
        try {
            const [boards, tiles, settings] = await Promise.all([
                repo.listBoards(cloudProfile.id),
                repo.listTiles(cloudProfile.id),
                repo.getSettings(cloudProfile.id),
            ]);

            const localProfileId = `profile-${uid()}`;
            const defaults = initialData();
            const boardMap: Record<string, CatalogBoard> = {};
            for (const b of boards) boardMap[b.id] = b;
            const tileMap: Record<string, Tile> = {};
            for (const t of tiles) tileMap[t.id] = t;

            // Download referenced media into local IndexedDB under the new localProfileId.
            for (const tile of tiles) {
                if (!tile.mediaId) continue;
                const blob = await repo.downloadProfileMedia(cloudProfile.id, tile.mediaId);
                if (blob) {
                    await this.mediaRepo.saveMedia(localProfileId, tile.mediaId, blob, {
                        mimeType: blob.type || "image/webp",
                        width: 0,
                        height: 0,
                    });
                }
            }

            const boardData: BoardData = {
                ...defaults,
                boards: Object.keys(boardMap).length ? boardMap : defaults.boards,
                tiles: Object.keys(tileMap).length ? tileMap : defaults.tiles,
                ...(settings
                    ? {
                          catalogOrder: settings.catalogOrder,
                          gridConfig: settings.gridConfig,
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
                    lastSavedAt: new Date().toISOString(),
                    boardData,
                },
            };
        } catch (error) {
            return {
                ok: false,
                error: error instanceof Error ? error.message : "Could not download cloud profile.",
            };
        }
    }
}

export const cloudSyncService = new CloudSyncService();
