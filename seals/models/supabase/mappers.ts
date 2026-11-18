import type { BoardPage, CatalogBoard, GridConfig, LanguageTag, Tile } from "@/lib/board";
import { DEFAULT_FEATURE_FLAGS, isValidMediaId, type BoardData, type FeatureFlags } from "../boardData";
import type { Word } from "../word";
import type { BoardRow, Insert, Json, ProfileSettingsRow, TileRow, WordRow } from "./database.types";

export type CloudSettings = Pick<BoardData, "catalogOrder" | "gridConfig" | "tileAppearance" | "speechConfig"> & {
    accessConfig: Omit<BoardData["accessConfig"], "editPin" | "pinVerifier">;
    featureFlags?: FeatureFlags;
};

function object(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function requireValid(condition: boolean, field: string): asserts condition {
    if (!condition) throw new Error(`Invalid Supabase ${field}`);
}
function oneOf(value: unknown, choices: readonly string[]): boolean {
    return typeof value === "string" && choices.includes(value);
}
function grid(value: unknown): GridConfig {
    requireValid(
        object(value) &&
            [value.rows, value.cols].every(n => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 16),
        "grid",
    );
    return { rows: value.rows as number, cols: value.cols as number };
}
function pages(value: unknown): BoardPage[] {
    requireValid(Array.isArray(value) && value.length > 0, "pages");
    for (const page of value) {
        requireValid(object(page) && object(page.cells), "page cells");
        for (const [key, cell] of Object.entries(page.cells)) {
            requireValid(
                /^(0|[1-9]|1[0-5]):(0|[1-9]|1[0-5])$/.test(key) &&
                    object(cell) &&
                    typeof cell.tileId === "string" &&
                    cell.tileId.length > 0 &&
                    (cell.hidden === undefined || typeof cell.hidden === "boolean"),
                "cell placement",
            );
        }
    }
    return structuredClone(value) as BoardPage[];
}
function json(value: unknown): Json {
    // Remove optional undefined properties before passing domain interfaces to PostgREST.
    return JSON.parse(JSON.stringify(value)) as Json;
}

export function boardToRow(profileId: string, board: CatalogBoard): Insert<"boards"> {
    return {
        profile_id: profileId,
        id: board.id,
        name: board.name,
        short_name: board.shortName,
        color_key: board.colorKey,
        icon_name: board.iconName,
        is_built_in: board.isBuiltIn,
        grid_override: board.gridOverride ? json(grid(board.gridOverride)) : null,
        pages: json(pages(board.pages)),
    };
}

export function boardFromRow(row: BoardRow): CatalogBoard {
    return {
        id: row.id,
        name: row.name,
        shortName: row.short_name,
        colorKey: row.color_key,
        iconName: row.icon_name,
        isBuiltIn: row.is_built_in,
        ...(row.grid_override === null ? {} : { gridOverride: grid(row.grid_override) }),
        pages: pages(row.pages),
    };
}

export function tileToRow(profileId: string, tile: Tile): Insert<"tiles"> {
    requireValid(tile.kind !== "folder" || !!tile.targetBoardId, "folder target");
    requireValid(tile.mediaId == null || isValidMediaId(tile.mediaId), "media_id");
    return {
        profile_id: profileId,
        id: tile.id,
        kind: tile.kind,
        label: tile.label,
        spoken_text: tile.spokenText ?? null,
        icon_name: tile.iconName,
        media_id: tile.mediaId ?? null,
        language: tile.language ?? "fil",
        is_quick_phrase: tile.isQuickPhrase ?? false,
        category_id: tile.categoryId,
        // The editor may convert a folder to a word while retaining optional fields.
        target_board_id: tile.kind === "folder" ? tile.targetBoardId! : null,
        color_key: tile.colorKey ?? null,
        word_class: tile.wordClass ?? null,
        is_custom: tile.isCustom ?? false,
    };
}

export function tileFromRow(row: TileRow): Tile {
    requireValid(row.media_id === null || isValidMediaId(row.media_id), "media_id");
    return {
        id: row.id,
        kind: row.kind,
        label: row.label,
        iconName: row.icon_name,
        categoryId: row.category_id,
        isCustom: row.is_custom,
        ...(row.spoken_text === null ? {} : { spokenText: row.spoken_text }),
        ...(row.media_id ? { mediaId: row.media_id } : {}),
        ...(row.language ? { language: row.language as LanguageTag } : {}),
        ...(row.is_quick_phrase ? { isQuickPhrase: row.is_quick_phrase } : {}),
        ...(row.target_board_id === null ? {} : { targetBoardId: row.target_board_id }),
        ...(row.color_key === null ? {} : { colorKey: row.color_key }),
        ...(row.word_class === null ? {} : { wordClass: row.word_class }),
    };
}

export function wordToRow(profileId: string, word: Word): Insert<"words"> {
    requireValid(word.mediaId == null || isValidMediaId(word.mediaId), "media_id");
    return {
        profile_id: profileId,
        id: word.id,
        label: word.label,
        spoken_text: word.spokenText ?? null,
        icon_name: word.iconName,
        media_id: word.mediaId ?? null,
        language: word.language ?? "fil",
        category_id: word.categoryId,
        color_key: word.colorKey ?? null,
        word_class: word.wordClass ?? null,
        is_custom: word.isCustom ?? false,
        is_quick_phrase: word.isQuickPhrase ?? false,
    };
}

export function wordFromRow(row: WordRow): Word {
    requireValid(row.media_id === null || isValidMediaId(row.media_id), "media_id");
    return {
        id: row.id,
        label: row.label,
        iconName: row.icon_name,
        categoryId: row.category_id,
        isCustom: row.is_custom,
        ...(row.spoken_text === null ? {} : { spokenText: row.spoken_text }),
        ...(row.media_id ? { mediaId: row.media_id } : {}),
        ...(row.language ? { language: row.language as LanguageTag } : {}),
        ...(row.is_quick_phrase ? { isQuickPhrase: row.is_quick_phrase } : {}),
        ...(row.color_key === null ? {} : { colorKey: row.color_key }),
        ...(row.word_class === null ? {} : { wordClass: row.word_class }),
    };
}

export function settingsFromRow(row: ProfileSettingsRow): CloudSettings {
    const a = row.tile_appearance,
        s = row.speech_config,
        c = row.access_config;
    requireValid(
        object(a) &&
            oneOf(a.labelPosition, ["top", "bottom"]) &&
            [a.fontScale, a.iconScale].every(v => oneOf(v, ["sm", "md", "lg"])) &&
            typeof a.showIcons === "boolean" &&
            oneOf(a.gridGap, ["compact", "normal", "relaxed"]) &&
            oneOf(a.colorMode, ["catalog", "wordClass", "neutral"]),
        "tile appearance",
    );
    requireValid(
        object(s) &&
            typeof s.volume === "number" &&
            Number.isFinite(s.volume) &&
            s.volume >= 0 &&
            s.volume <= 1 &&
            typeof s.speakOnTap === "boolean" &&
            oneOf(s.autoClear, ["off", "afterSpeak", "nextTap"]) &&
            (s.provider === undefined || oneOf(s.provider, ["local", "cloud-puter", "none"])) &&
            (s.rate === undefined ||
                (typeof s.rate === "number" && Number.isFinite(s.rate) && s.rate >= 0.5 && s.rate <= 2)) &&
            (s.languageTag === undefined || typeof s.languageTag === "string") &&
            (s.voiceId === undefined || s.voiceId === null || typeof s.voiceId === "string"),
        "speech config",
    );
    requireValid(
        object(c) &&
            !("editPin" in c) &&
            !("pinVerifier" in c) &&
            typeof c.longPressToEdit === "boolean" &&
            [c.holdDurationMs, c.moveTolerancePx, c.swipeThresholdPx].every(
                n => typeof n === "number" && Number.isFinite(n) && n >= 0,
            ),
        "access config",
    );
    requireValid(
        Array.isArray(row.catalog_order) && row.catalog_order.every(id => typeof id === "string"),
        "catalog order",
    );
    const rawFlags = object(row.feature_flags) ? row.feature_flags : {};
    const featureFlags: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };
    for (const key of Object.keys(DEFAULT_FEATURE_FLAGS) as (keyof FeatureFlags)[]) {
        if (Object.prototype.hasOwnProperty.call(rawFlags, key)) {
            const value = rawFlags[key];
            if (typeof value === "boolean") {
                featureFlags[key] = value;
            }
        }
    }
    return {
        catalogOrder: [...row.catalog_order],
        gridConfig: grid(row.grid_config),
        tileAppearance: structuredClone(a) as BoardData["tileAppearance"],
        speechConfig: {
            volume: s.volume as number,
            speakOnTap: s.speakOnTap as boolean,
            autoClear: s.autoClear as BoardData["speechConfig"]["autoClear"],
            provider: (s.provider ?? "local") as BoardData["speechConfig"]["provider"],
            voiceId: s.voiceId === undefined ? null : (s.voiceId as string | null),
            languageTag: (s.languageTag ?? "fil-PH") as string,
            rate: (s.rate ?? 1) as number,
        },
        accessConfig: {
            longPressToEdit: c.longPressToEdit,
            holdDurationMs: c.holdDurationMs as number,
            moveTolerancePx: c.moveTolerancePx as number,
            swipeThresholdPx: c.swipeThresholdPx as number,
        },
        featureFlags,
    };
}

export function settingsToRow(profileId: string, data: CloudSettings): Insert<"profile_settings"> {
    // Explicit allowlist keeps editPin, pinVerifier, and sentence local even when a whole store is passed.
    const row = {
        profile_id: profileId,
        catalog_order: [...data.catalogOrder],
        grid_config: json(data.gridConfig),
        tile_appearance: json(data.tileAppearance),
        speech_config: json(data.speechConfig),
        access_config: json({
            longPressToEdit: data.accessConfig.longPressToEdit,
            holdDurationMs: data.accessConfig.holdDurationMs,
            moveTolerancePx: data.accessConfig.moveTolerancePx,
            swipeThresholdPx: data.accessConfig.swipeThresholdPx,
        }),
        feature_flags: json(data.featureFlags ?? DEFAULT_FEATURE_FLAGS),
    };
    settingsFromRow({ ...row, created_at: "", updated_at: "" });
    return row;
}
