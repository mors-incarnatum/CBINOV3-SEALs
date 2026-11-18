import type { CatalogBoard, Tile } from "@/lib/board";
import { isValidMediaId } from "@/models/boardData";
import type { Word } from "@/models/word";
import type { BoardSupabaseClient } from "./client";
import type { Json, ProfileMemberRole, ProfileMembershipRow, ProfileRow } from "./database.types";
import {
    boardFromRow,
    boardToRow,
    tileFromRow,
    tileToRow,
    wordFromRow,
    wordToRow,
    settingsFromRow,
    settingsToRow,
    type CloudSettings,
} from "./mappers";

async function readPages<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
    const result: T[] = [];
    const size = 500;
    for (let start = 0; ; start += size) {
        const { data } = await read(start, start + size - 1);
        result.push(...(data ?? []));
        if (!data || data.length < size) return result;
    }
}

export const PROFILE_MEDIA_BUCKET = "profile-media";

/** Explicit persistence operations. Callers handle errors and retain their local data. */
export interface IBoardRepository {
    listProfiles(): Promise<ProfileRow[]>;
    createProfile(name: string): Promise<ProfileRow>;
    listMemberships(profileId: string): Promise<ProfileMembershipRow[]>;
    setMembership(profileId: string, userId: string, role: ProfileMemberRole): Promise<void>;
    removeMembership(profileId: string, userId: string): Promise<void>;
    listBoards(profileId: string): Promise<CatalogBoard[]>;
    saveBoard(profileId: string, board: CatalogBoard): Promise<void>;
    listTiles(profileId: string): Promise<Tile[]>;
    saveTile(profileId: string, tile: Tile): Promise<void>;
    listWords(profileId: string): Promise<Word[]>;
    saveWord(profileId: string, word: Word): Promise<void>;
    getSettings(profileId: string): Promise<CloudSettings | null>;
    saveSettings(profileId: string, settings: CloudSettings): Promise<void>;
    publishProfileSnapshot(
        profileId: string,
        expectedRevision: number | null,
        boards: CatalogBoard[],
        tiles: Tile[],
        settings: CloudSettings,
    ): Promise<number>;
    uploadProfileMedia(profileId: string, mediaId: string, blob: Blob, mimeType: string): Promise<void>;
    downloadProfileMedia(profileId: string, mediaId: string): Promise<Blob | null>;
}

export class SupabaseBoardRepository implements IBoardRepository {
    constructor(private readonly client: BoardSupabaseClient) {}

    async listProfiles() {
        return readPages((from, to) =>
            this.client.from("profiles").select("*").order("id").range(from, to).throwOnError(),
        );
    }
    async createProfile(name: string) {
        const { data } = await this.client.from("profiles").insert({ name }).select().single().throwOnError();
        return data!;
    }
    async listMemberships(profileId: string) {
        return readPages((from, to) =>
            this.client
                .from("profile_memberships")
                .select("*")
                .eq("profile_id", profileId)
                .order("user_id")
                .range(from, to)
                .throwOnError(),
        );
    }
    async setMembership(profileId: string, userId: string, role: ProfileMemberRole) {
        await this.client
            .from("profile_memberships")
            .upsert({ profile_id: profileId, user_id: userId, role }, { onConflict: "profile_id,user_id" })
            .throwOnError();
    }
    async removeMembership(profileId: string, userId: string) {
        await this.client
            .from("profile_memberships")
            .delete()
            .eq("profile_id", profileId)
            .eq("user_id", userId)
            .throwOnError();
    }
    async listBoards(profileId: string) {
        return (
            await readPages((from, to) =>
                this.client
                    .from("boards")
                    .select("*")
                    .eq("profile_id", profileId)
                    .order("id")
                    .range(from, to)
                    .throwOnError(),
            )
        ).map(boardFromRow);
    }
    async saveBoard(profileId: string, board: CatalogBoard) {
        await this.client
            .from("boards")
            .upsert(boardToRow(profileId, board), { onConflict: "profile_id,id" })
            .throwOnError();
    }
    async listTiles(profileId: string) {
        return (
            await readPages((from, to) =>
                this.client
                    .from("tiles")
                    .select("*")
                    .eq("profile_id", profileId)
                    .order("id")
                    .range(from, to)
                    .throwOnError(),
            )
        ).map(tileFromRow);
    }
    async saveTile(profileId: string, tile: Tile) {
        await this.client
            .from("tiles")
            .upsert(tileToRow(profileId, tile), { onConflict: "profile_id,id" })
            .throwOnError();
    }
    async listWords(profileId: string) {
        return (
            await readPages((from, to) =>
                this.client
                    .from("words")
                    .select("*")
                    .eq("profile_id", profileId)
                    .order("id")
                    .range(from, to)
                    .throwOnError(),
            )
        ).map(wordFromRow);
    }
    async saveWord(profileId: string, word: Word) {
        await this.client
            .from("words")
            .upsert(wordToRow(profileId, word), { onConflict: "profile_id,id" })
            .throwOnError();
    }
    async getSettings(profileId: string) {
        const { data } = await this.client
            .from("profile_settings")
            .select("*")
            .eq("profile_id", profileId)
            .maybeSingle()
            .throwOnError();
        return data ? settingsFromRow(data) : null;
    }
    async saveSettings(profileId: string, settings: CloudSettings) {
        await this.client
            .from("profile_settings")
            .upsert(settingsToRow(profileId, settings), { onConflict: "profile_id" })
            .throwOnError();
    }
    async publishProfileSnapshot(
        profileId: string,
        expectedRevision: number | null,
        boards: CatalogBoard[],
        tiles: Tile[],
        settings: CloudSettings,
    ): Promise<number> {
        const { data, error } = await this.client.rpc("publish_profile_snapshot", {
            p_profile_id: profileId,
            p_expected_revision: expectedRevision,
            p_boards: boards.map(b => boardToRow(profileId, b)) as unknown as Json,
            p_tiles: tiles.map(t => tileToRow(profileId, t)) as unknown as Json,
            p_settings: settingsToRow(profileId, settings) as unknown as Json,
        });
        if (error) throw error;
        return data as number;
    }
    async uploadProfileMedia(profileId: string, mediaId: string, blob: Blob, mimeType: string) {
        if (!isValidMediaId(mediaId)) throw new Error("Invalid media ID");
        const path = `${profileId}/${mediaId}`;
        const { error } = await this.client.storage
            .from(PROFILE_MEDIA_BUCKET)
            .upload(path, blob, { upsert: true, contentType: mimeType });
        if (error) throw error;
    }
    async downloadProfileMedia(profileId: string, mediaId: string): Promise<Blob | null> {
        if (!isValidMediaId(mediaId)) return null;
        const path = `${profileId}/${mediaId}`;
        const { data, error } = await this.client.storage.from(PROFILE_MEDIA_BUCKET).download(path);
        if (error) return null;
        return data;
    }
}
