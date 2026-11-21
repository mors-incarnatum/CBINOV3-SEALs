import { DEFAULT_GRID, type BoardPage, type CatalogBoard, type GridConfig, type LanguageTag, type Tile } from "@/lib/board";
import { DEFAULT_FEATURE_FLAGS, isValidMediaId, type BoardData, type FeatureFlags } from "../boardData";
import type { Word } from "../word";
import type { BoardRow, Insert, Json, ProfileSettingsRow, TileRow, WordRow } from "./database.types";

export type CloudSettings = Pick<BoardData, "catalogOrder" | "gridConfig" | "layoutMode" | "tileAppearance" | "speechConfig"> & {
    accessConfig: Omit<BoardData["accessConfig"], "editPin" | "pinVerifier">;
    featureFlags?: FeatureFlags;
};

const BOARD_COLORS = ["rose", "emerald", "amber", "blue", "violet", "teal", "orange", "pink", "slate"] as const;
const WORD_CLASSES = [
    "social",
    "question",
    "verb",
    "pronoun",
    "particle",
    "modifier",
    "place",
    "noun",
    "other",
] as const;

function object(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function requireValid(condition: boolean, field: string): asserts condition {
    if (!condition) throw new Error(`Invalid Supabase ${field}`);
}
function oneOf(value: unknown, choices: readonly string[]): boolean {
    return typeof value === "string" && choices.includes(value);
}
function layoutMode(value: unknown): BoardData["layoutMode"] {
    return value === "manual" || value === "automatic" ? value : undefined;
}
function tileDimension(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.min(100, Math.round(value))) : 50;
}
function grid(value: unknown): GridConfig {
    requireValid(
        object(value) &&
            [value.rows, value.cols].every(n => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 16) &&
            (value.layoutMode === undefined || oneOf(value.layoutMode, ["manual", "automatic"])) &&
            (value.inheritGrid === undefined || typeof value.inheritGrid === "boolean"),
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

export function tileToWord(tile: Tile): Word {
    requireValid(tile.kind === "word", "word tile");
    return {
        id: tile.id,
        label: tile.label,
        iconName: tile.iconName,
        categoryId: tile.categoryId,
        ...(tile.spokenText !== undefined ? { spokenText: tile.spokenText } : {}),
        ...(tile.mediaId !== undefined ? { mediaId: tile.mediaId } : {}),
        ...(tile.language !== undefined ? { language: tile.language } : {}),
        ...(tile.colorKey !== undefined ? { colorKey: tile.colorKey } : {}),
        ...(tile.wordClass !== undefined ? { wordClass: tile.wordClass } : {}),
        ...(tile.isCustom !== undefined ? { isCustom: tile.isCustom } : {}),
        ...(tile.isQuickPhrase !== undefined ? { isQuickPhrase: tile.isQuickPhrase } : {}),
    };
}

export function wordToTile(word: Word): Tile {
    return { ...word, kind: "word" };
}

export function boardToRow(profileId: string, board: CatalogBoard): Insert<"boards"> {
    requireValid(
        board.layoutModeOverride === undefined || oneOf(board.layoutModeOverride, ["manual", "automatic"]),
        "board layoutModeOverride",
    );
    // The existing grid constraint requires dimensions even for mode-only overrides.
    const gridOverride = board.layoutModeOverride
        ? {
              ...grid(board.gridOverride ?? DEFAULT_GRID),
              layoutMode: board.layoutModeOverride,
              ...(board.gridOverride ? {} : { inheritGrid: true }),
          }
        : board.gridOverride && grid(board.gridOverride);
    const row: Insert<"boards"> = {
        profile_id: profileId,
        id: board.id,
        name: board.name,
        short_name: board.shortName,
        color_key: board.colorKey,
        icon_name: board.iconName,
        is_built_in: board.isBuiltIn,
        grid_override: gridOverride ? json(gridOverride) : null,
        pages: json(pages(board.pages)),
    };
    boardFromRow(row as BoardRow);
    return row;
}

export function boardFromRow(row: BoardRow): CatalogBoard {
    requireValid(typeof row.id === "string" && row.id.length > 0, "board id");
    requireValid(typeof row.name === "string" && row.name.trim().length > 0, "board name");
    requireValid(typeof row.short_name === "string", "board short_name");
    requireValid(oneOf(row.color_key, BOARD_COLORS), "board color_key");
    requireValid(typeof row.is_built_in === "boolean", "board is_built_in");
    const rawGrid = row.grid_override;
    const parsedGrid = rawGrid === null ? undefined : grid(rawGrid);
    const modeOverride = object(rawGrid) ? layoutMode(rawGrid.layoutMode) : undefined;
    const inheritGrid = modeOverride !== undefined && object(rawGrid) && rawGrid.inheritGrid === true;
    return {
        id: row.id,
        name: row.name,
        shortName: row.short_name,
        colorKey: row.color_key,
        iconName: row.icon_name,
        isBuiltIn: row.is_built_in,
        ...(parsedGrid && !inheritGrid ? { gridOverride: parsedGrid } : {}),
        ...(modeOverride ? { layoutModeOverride: modeOverride } : {}),
        pages: pages(row.pages),
    };
}

export function tileToRow(profileId: string, tile: Tile): Insert<"tiles"> {
    const row: Insert<"tiles"> = {
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
        target_board_id: tile.kind === "folder" ? (tile.targetBoardId ?? null) : null,
        color_key: tile.colorKey ?? null,
        word_class: tile.wordClass ?? null,
        is_custom: tile.isCustom ?? false,
    };
    tileFromRow(row as TileRow);
    return row;
}

export function tileFromRow(row: TileRow): Tile {
    requireValid(typeof row.id === "string" && row.id.length > 0, "tile id");
    requireValid(typeof row.label === "string" && row.label.trim().length > 0, "tile label");
    requireValid(typeof row.category_id === "string" && row.category_id.length > 0, "tile category_id");
    requireValid(
        (row.kind === "folder" && typeof row.target_board_id === "string" && row.target_board_id.length > 0) ||
            (row.kind === "word" && row.target_board_id === null),
        "tile target_board_id",
    );
    requireValid(row.media_id === null || isValidMediaId(row.media_id), "media_id");
    requireValid(row.color_key === null || oneOf(row.color_key, BOARD_COLORS), "tile color_key");
    requireValid(row.word_class === null || oneOf(row.word_class, WORD_CLASSES), "tile word_class");
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
    const row: Insert<"words"> = {
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
    wordFromRow(row as WordRow);
    return row;
}

export function wordFromRow(row: WordRow): Word {
    requireValid(typeof row.id === "string" && row.id.length > 0, "word id");
    requireValid(typeof row.label === "string" && row.label.trim().length > 0, "word label");
    requireValid(typeof row.category_id === "string" && row.category_id.length > 0, "word category_id");
    requireValid(row.media_id === null || isValidMediaId(row.media_id), "media_id");
    requireValid(row.color_key === null || oneOf(row.color_key, BOARD_COLORS), "word color_key");
    requireValid(row.word_class === null || oneOf(row.word_class, WORD_CLASSES), "word word_class");
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
            oneOf(a.colorMode, ["catalog", "wordClass", "neutral"]) &&
            [a.tileWidth, a.tileHeight].every(
                v => v === undefined || (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 100),
            ),
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
            (s.languageTag === undefined || (typeof s.languageTag === "string" && s.languageTag.trim().length > 0)) &&
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
    requireValid(
        object(row.feature_flags) && Object.values(row.feature_flags).every(v => typeof v === "boolean"),
        "feature flags",
    );
    const rawFlags = row.feature_flags;
    const featureFlags: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };
    for (const key of Object.keys(DEFAULT_FEATURE_FLAGS) as (keyof FeatureFlags)[]) {
        if (Object.prototype.hasOwnProperty.call(rawFlags, key)) {
            featureFlags[key] = rawFlags[key] as boolean;
        }
    }
    const rawGrid = row.grid_config;
    return {
        catalogOrder: [...row.catalog_order],
        gridConfig: grid(rawGrid),
        layoutMode: (object(rawGrid) && layoutMode(rawGrid.layoutMode)) || "manual",
        tileAppearance: {
            labelPosition: a.labelPosition as BoardData["tileAppearance"]["labelPosition"],
            fontScale: a.fontScale as BoardData["tileAppearance"]["fontScale"],
            iconScale: a.iconScale as BoardData["tileAppearance"]["iconScale"],
            showIcons: a.showIcons as boolean,
            gridGap: a.gridGap as BoardData["tileAppearance"]["gridGap"],
            colorMode: a.colorMode as BoardData["tileAppearance"]["colorMode"],
            tileWidth: tileDimension(a.tileWidth),
            tileHeight: tileDimension(a.tileHeight),
        },
        speechConfig: {
            volume: s.volume as number,
            speakOnTap: s.speakOnTap as boolean,
            autoClear: s.autoClear as BoardData["speechConfig"]["autoClear"],
            provider: (s.provider ?? "local") as BoardData["speechConfig"]["provider"],
            voiceId: s.voiceId === undefined ? null : (s.voiceId as string | null),
            languageTag: typeof s.languageTag === "string" ? s.languageTag.trim() : "fil-PH",
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
    const rawFlags = data.featureFlags ?? DEFAULT_FEATURE_FLAGS;
    const featureFlags: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };
    for (const key of Object.keys(DEFAULT_FEATURE_FLAGS) as (keyof FeatureFlags)[]) {
        featureFlags[key] = Boolean(rawFlags[key] ?? DEFAULT_FEATURE_FLAGS[key]);
    }
    const volume =
        typeof data.speechConfig.volume === "number" && Number.isFinite(data.speechConfig.volume)
            ? Math.max(0, Math.min(1, data.speechConfig.volume))
            : data.speechConfig.volume;
    const rate =
        data.speechConfig.rate === undefined
            ? 1
            : typeof data.speechConfig.rate === "number" && Number.isFinite(data.speechConfig.rate)
              ? Math.max(0.5, Math.min(2, data.speechConfig.rate))
              : data.speechConfig.rate;
    const languageTag =
        typeof data.speechConfig.languageTag === "string" ? data.speechConfig.languageTag.trim() || "fil-PH" : "fil-PH";

    const row: Insert<"profile_settings"> = {
        profile_id: profileId,
        catalog_order: [...data.catalogOrder],
        grid_config: json({
            ...grid(data.gridConfig),
            ...(data.layoutMode !== undefined ? { layoutMode: data.layoutMode } : {}),
        }),
        tile_appearance: json({
            labelPosition: data.tileAppearance.labelPosition,
            fontScale: data.tileAppearance.fontScale,
            iconScale: data.tileAppearance.iconScale,
            showIcons: data.tileAppearance.showIcons,
            gridGap: data.tileAppearance.gridGap,
            colorMode: data.tileAppearance.colorMode,
            tileWidth: tileDimension(data.tileAppearance.tileWidth),
            tileHeight: tileDimension(data.tileAppearance.tileHeight),
        }),
        speech_config: json({
            volume,
            speakOnTap: data.speechConfig.speakOnTap,
            autoClear: data.speechConfig.autoClear,
            provider: data.speechConfig.provider ?? "local",
            voiceId: data.speechConfig.voiceId ?? null,
            languageTag,
            rate,
        }),
        access_config: json({
            longPressToEdit: data.accessConfig.longPressToEdit,
            holdDurationMs: data.accessConfig.holdDurationMs,
            moveTolerancePx: data.accessConfig.moveTolerancePx,
            swipeThresholdPx: data.accessConfig.swipeThresholdPx,
        }),
        feature_flags: json(featureFlags),
    };
    settingsFromRow(row as ProfileSettingsRow);
    return row;
}
