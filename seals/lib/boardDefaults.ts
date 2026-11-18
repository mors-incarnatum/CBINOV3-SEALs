import {
    CATEGORY_IDS,
    CATEGORIES,
    INITIAL_DICTIONARY,
    DEFAULT_GRID,
    clampGrid,
    cellKey,
    type Tile,
    type CatalogBoard,
    type ColorKey,
    type WordTile,
    type GridConfig,
    type BoardPage,
    type CellKey,
    type CellPlacement,
} from "@/lib/board";
import { DEFAULT_FEATURE_FLAGS, isValidMediaId, type BoardData } from "@/models/boardData";

export function initialData(): BoardData {
    const tiles: Record<string, Tile> = {};
    const boards: Record<string, CatalogBoard> = {};
    const colors: ColorKey[] = ["rose", "emerald", "amber", "blue"];
    CATEGORY_IDS.forEach((id, n) => {
        const cells: CatalogBoard["pages"][number]["cells"] = {};
        INITIAL_DICTIONARY[id].forEach((word, i) => {
            tiles[word.id] = { ...word, kind: "word", language: "fil" };
            cells[cellKey(Math.floor(i / 4), i % 4)] = { tileId: word.id };
        });
        boards[id] = {
            id,
            name: CATEGORIES[id].label,
            shortName: CATEGORIES[id].wheel,
            colorKey: colors[n],
            iconName: INITIAL_DICTIONARY[id][0].iconName,
            isBuiltIn: true,
            pages: [{ cells }],
        };
    });
    const cells: CatalogBoard["pages"][number]["cells"] = {};
    for (let i = 0; i < 20; i++) {
        cells[cellKey(Math.floor(i / 4), i % 4)] = {
            tileId: INITIAL_DICTIONARY[CATEGORY_IDS[i % 4]][Math.floor(i / 4)].id,
        };
    }
    boards.home = {
        id: "home",
        name: "Home",
        shortName: "Home",
        colorKey: "slate",
        iconName: null,
        isBuiltIn: true,
        pages: [{ cells }],
    };
    return {
        tiles,
        boards,
        catalogOrder: [...CATEGORY_IDS],
        gridConfig: { ...DEFAULT_GRID },
        tileAppearance: {
            labelPosition: "bottom",
            fontScale: "md",
            iconScale: "md",
            showIcons: true,
            gridGap: "normal",
            colorMode: "catalog",
        },
        speechConfig: {
            volume: 1,
            speakOnTap: true,
            autoClear: "off",
            provider: "local",
            voiceId: null,
            languageTag: "fil-PH",
            rate: 1,
        },
        accessConfig: {
            editPin: null,
            pinVerifier: null,
            longPressToEdit: true,
            holdDurationMs: 650,
            moveTolerancePx: 12,
            swipeThresholdPx: 60,
        },
        featureFlags: { ...DEFAULT_FEATURE_FLAGS },
        sentence: [],
    };
}

export function migrateV1(value: unknown): BoardData {
    const data = initialData();
    const old = value as {
        dictionary?: Record<string, (WordTile | null)[]>;
        homeGrid?: {
            slotIndex: number;
            tile: WordTile | null;
        }[];
    };
    if (!old || typeof old !== "object") return data;
    const convert = (word: WordTile) => {
        data.tiles[word.id] = { ...word, kind: "word" };
        return { tileId: word.id };
    };
    for (const id of CATEGORY_IDS) {
        if (Array.isArray(old.dictionary?.[id])) {
            data.boards[id].pages = [{ cells: {} }];
            old.dictionary![id].forEach((word, i) => {
                if (word) {
                    data.boards[id].pages[0].cells[cellKey(Math.floor(i / 4), i % 4)] = convert(word);
                }
            });
        }
    }
    if (Array.isArray(old.homeGrid)) {
        data.boards.home.pages = [{ cells: {} }];
        old.homeGrid.forEach(({ slotIndex: i, tile }) => {
            if (tile) {
                data.boards.home.pages[0].cells[cellKey(Math.floor(i / 4), i % 4)] = convert(tile);
            }
        });
    }
    return data;
}

const VALID_COLOR_KEYS: ReadonlySet<string> = new Set<ColorKey>([
    "rose",
    "emerald",
    "amber",
    "blue",
    "violet",
    "teal",
    "orange",
    "pink",
    "slate",
]);

const CELL_KEY_RE = /^(0|[1-9]|1[0-5]):(0|[1-9]|1[0-5])$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidColorKey(value: unknown): value is ColorKey {
    return typeof value === "string" && VALID_COLOR_KEYS.has(value);
}

function nonNegFinite(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function sanitizeGrid(value: Record<string, unknown>, fallback: GridConfig): GridConfig {
    const rows = typeof value.rows === "number" && Number.isFinite(value.rows) ? value.rows : fallback.rows;
    const cols = typeof value.cols === "number" && Number.isFinite(value.cols) ? value.cols : fallback.cols;
    return clampGrid({ rows, cols });
}

function sanitizePages(rawPages: unknown): BoardPage[] {
    if (!Array.isArray(rawPages) || rawPages.length === 0) {
        return [{ cells: {} }];
    }
    const pages: BoardPage[] = [];
    for (const rawPage of rawPages) {
        if (!isPlainObject(rawPage) || !isPlainObject(rawPage.cells)) continue;
        const cells: Partial<Record<CellKey, CellPlacement>> = {};
        for (const [key, rawCell] of Object.entries(rawPage.cells)) {
            if (
                !CELL_KEY_RE.test(key) ||
                !isPlainObject(rawCell) ||
                typeof rawCell.tileId !== "string" ||
                rawCell.tileId.length === 0
            ) {
                continue;
            }
            cells[key as CellKey] =
                typeof rawCell.hidden === "boolean"
                    ? { tileId: rawCell.tileId, hidden: rawCell.hidden }
                    : { tileId: rawCell.tileId };
        }
        pages.push({ cells });
    }
    return pages.length > 0 ? pages : [{ cells: {} }];
}

function sanitizeBoards(rawBoards: Record<string, unknown>, fallbackGrid: GridConfig): Record<string, CatalogBoard> {
    const boards: Record<string, CatalogBoard> = {};
    for (const [key, rawBoard] of Object.entries(rawBoards)) {
        if (key === "__proto__" || !isPlainObject(rawBoard)) continue;
        if (
            typeof rawBoard.id !== "string" ||
            typeof rawBoard.name !== "string" ||
            typeof rawBoard.shortName !== "string" ||
            typeof rawBoard.isBuiltIn !== "boolean"
        ) {
            continue;
        }
        boards[key] = {
            id: rawBoard.id,
            name: rawBoard.name,
            shortName: rawBoard.shortName,
            colorKey: isValidColorKey(rawBoard.colorKey) ? rawBoard.colorKey : "slate",
            iconName: typeof rawBoard.iconName === "string" ? rawBoard.iconName : null,
            isBuiltIn: rawBoard.isBuiltIn,
            ...(isPlainObject(rawBoard.gridOverride)
                ? { gridOverride: sanitizeGrid(rawBoard.gridOverride, fallbackGrid) }
                : {}),
            pages: sanitizePages(rawBoard.pages),
        };
    }
    return boards;
}

function sanitizeRecordMediaId(entry: Record<string, unknown>): Record<string, unknown> {
    const cloned = structuredClone(entry);
    if ("mediaId" in cloned && cloned.mediaId !== undefined && !isValidMediaId(cloned.mediaId)) {
        cloned.mediaId = null;
    }
    return cloned;
}

function sanitizeTiles(rawTiles: Record<string, unknown>): Record<string, Tile> {
    const tiles: Record<string, Tile> = {};
    for (const [key, rawTile] of Object.entries(rawTiles)) {
        if (key === "__proto__" || !isPlainObject(rawTile)) continue;
        tiles[key] = sanitizeRecordMediaId(rawTile) as unknown as Tile;
    }
    return tiles;
}

function clonePlainObject<T>(value: unknown): Partial<T> {
    return isPlainObject(value) ? (structuredClone(value) as Partial<T>) : {};
}

export function upgradeV2ToV3BoardData(v2State: unknown): BoardData | null {
    if (!isPlainObject(v2State)) return null;
    if (!isPlainObject(v2State.tiles) || !isPlainObject(v2State.boards)) return null;

    const defaults = initialData();
    const rawAccess = isPlainObject(v2State.accessConfig) ? v2State.accessConfig : {};
    const rawPinVerifier = rawAccess.pinVerifier;
    const pinVerifier =
        isPlainObject(rawPinVerifier) &&
        typeof rawPinVerifier.salt === "string" &&
        typeof rawPinVerifier.hash === "string"
            ? { salt: rawPinVerifier.salt, hash: rawPinVerifier.hash }
            : null;

    return {
        tiles: sanitizeTiles(v2State.tiles),
        boards: sanitizeBoards(v2State.boards, defaults.gridConfig),
        catalogOrder: Array.isArray(v2State.catalogOrder)
            ? v2State.catalogOrder.filter((id): id is string => typeof id === "string")
            : defaults.catalogOrder,
        gridConfig: isPlainObject(v2State.gridConfig)
            ? sanitizeGrid(v2State.gridConfig, defaults.gridConfig)
            : defaults.gridConfig,
        tileAppearance: {
            ...defaults.tileAppearance,
            ...clonePlainObject<BoardData["tileAppearance"]>(v2State.tileAppearance),
        },
        speechConfig: {
            ...defaults.speechConfig,
            ...clonePlainObject<BoardData["speechConfig"]>(v2State.speechConfig),
        },
        accessConfig: {
            ...defaults.accessConfig,
            ...clonePlainObject<BoardData["accessConfig"]>(v2State.accessConfig),
            editPin: null,
            pinVerifier,
            longPressToEdit:
                typeof rawAccess.longPressToEdit === "boolean"
                    ? rawAccess.longPressToEdit
                    : defaults.accessConfig.longPressToEdit,
            holdDurationMs: nonNegFinite(rawAccess.holdDurationMs, defaults.accessConfig.holdDurationMs),
            moveTolerancePx: nonNegFinite(rawAccess.moveTolerancePx, defaults.accessConfig.moveTolerancePx),
            swipeThresholdPx: nonNegFinite(rawAccess.swipeThresholdPx, defaults.accessConfig.swipeThresholdPx),
        },
        featureFlags: {
            ...DEFAULT_FEATURE_FLAGS,
            ...clonePlainObject<BoardData["featureFlags"]>(v2State.featureFlags),
        },
        ...(isPlainObject(v2State.experimentalData)
            ? { experimentalData: structuredClone(v2State.experimentalData) as BoardData["experimentalData"] }
            : {}),
        sentence: Array.isArray(v2State.sentence)
            ? v2State.sentence
                  .filter(isPlainObject)
                  .map(token => sanitizeRecordMediaId(token) as unknown as BoardData["sentence"][number])
            : [],
    };
}

export function sanitizeBoardData(raw: unknown): BoardData | null {
    return upgradeV2ToV3BoardData(raw);
}
