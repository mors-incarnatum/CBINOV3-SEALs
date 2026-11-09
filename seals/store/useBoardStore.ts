import { createStore } from "zustand/vanilla";
import { persist, createJSONStorage } from "zustand/middleware";
import { CATEGORY_IDS, CATEGORIES, INITIAL_DICTIONARY, DEFAULT_GRID, cellKey, clampGrid, inBounds, uid, type Tile, type CatalogBoard, type GridConfig, type CellKey, type SentenceToken, type ColorKey, type WordTile } from "@/lib/board";
export interface BoardData {
    tiles: Record<string, Tile>;
    boards: Record<string, CatalogBoard>;
    catalogOrder: string[];
    gridConfig: GridConfig;
    tileAppearance: {
        labelPosition: "top" | "bottom";
        fontScale: "sm" | "md" | "lg";
        iconScale: "sm" | "md" | "lg";
        showIcons: boolean;
        gridGap: "compact" | "normal" | "relaxed";
        colorMode: "catalog" | "wordClass";
    };
    speechConfig: {
        volume: number;
        speakOnTap: boolean;
        autoClear: "off" | "afterSpeak" | "nextTap";
    };
    accessConfig: {
        editPin: string | null;
        longPressToEdit: boolean;
        holdDurationMs: number;
        moveTolerancePx: number;
        swipeThresholdPx: number;
    };
    sentence: SentenceToken[];
}
export interface BoardState extends BoardData {
    setGridConfig: (grid: GridConfig, boardId?: string) => void;
    reflowOutOfBoundsTiles: (boardId: string) => void;
    setTileAppearance: (patch: Partial<BoardData["tileAppearance"]>) => void;
    setSpeechConfig: (patch: Partial<BoardData["speechConfig"]>) => void;
    setAccessConfig: (patch: Partial<BoardData["accessConfig"]>) => void;
    appendSentenceTile: (tile: Tile) => void;
    removeSentenceTokenAt: (index: number) => void;
    popSentenceToken: () => void;
    clearSentence: () => void;
    upsertTile: (tile: Tile) => void;
    assignSlot: (boardId: string, page: number, cell: CellKey, tileId: string | null) => void;
    swapSlots: (boardId: string, page: number, from: CellKey, to: CellKey) => void;
    setSlotHidden: (boardId: string, page: number, cell: CellKey, hidden: boolean) => void;
    createCatalog: (input: {
        name: string;
        shortName?: string;
        colorKey: ColorKey;
        iconName: string | null;
        placeFolderOnHome?: boolean;
    }) => string;
    updateCatalog: (id: string, patch: Partial<Pick<CatalogBoard, "name" | "shortName" | "colorKey" | "iconName" | "gridOverride">>) => void;
    deleteCatalog: (id: string) => void;
    reorderCatalog: (id: string, direction: number) => void;
    addWordsToCatalog: (id: string, tileIds: string[]) => void;
    placeFolderOnHome: (id: string) => void;
}
export function initialData(): BoardData {
    const tiles: Record<string, Tile> = {};
    const boards: Record<string, CatalogBoard> = {};
    const colors: ColorKey[] = ["rose", "emerald", "amber", "blue"];
    CATEGORY_IDS.forEach((id, n) => {
        const cells: CatalogBoard["pages"][number]["cells"] = {};
        INITIAL_DICTIONARY[id].forEach((word, i) => { tiles[word.id] = { ...word, kind: "word" }; cells[cellKey(Math.floor(i / 4), i % 4)] = { tileId: word.id }; });
        boards[id] = { id, name: CATEGORIES[id].label, shortName: CATEGORIES[id].wheel, colorKey: colors[n], iconName: INITIAL_DICTIONARY[id][0].iconName, isBuiltIn: true, pages: [{ cells }] };
    });
    const cells: CatalogBoard["pages"][number]["cells"] = {};
    for (let i = 0; i < 20; i++)
        cells[cellKey(Math.floor(i / 4), i % 4)] = { tileId: INITIAL_DICTIONARY[CATEGORY_IDS[i % 4]][Math.floor(i / 4)].id };
    boards.home = { id: "home", name: "Home", shortName: "Home", colorKey: "slate", iconName: null, isBuiltIn: true, pages: [{ cells }] };
    return { tiles, boards, catalogOrder: [...CATEGORY_IDS], gridConfig: { ...DEFAULT_GRID }, tileAppearance: { labelPosition: "bottom", fontScale: "md", iconScale: "md", showIcons: true, gridGap: "normal", colorMode: "catalog" }, speechConfig: { volume: 1, speakOnTap: true, autoClear: "off" }, accessConfig: { editPin: null, longPressToEdit: true, holdDurationMs: 650, moveTolerancePx: 12, swipeThresholdPx: 60 }, sentence: [] };
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
    if (!old || typeof old !== "object")
        return data;
    const convert = (word: WordTile) => { data.tiles[word.id] = { ...word, kind: "word" }; return { tileId: word.id }; };
    for (const id of CATEGORY_IDS)
        if (Array.isArray(old.dictionary?.[id])) {
            data.boards[id].pages = [{ cells: {} }];
            old.dictionary![id].forEach((word, i) => { if (word)
                data.boards[id].pages[0].cells[cellKey(Math.floor(i / 4), i % 4)] = convert(word); });
        }
    if (Array.isArray(old.homeGrid)) {
        data.boards.home.pages = [{ cells: {} }];
        old.homeGrid.forEach(({ slotIndex: i, tile }) => { if (tile)
            data.boards.home.pages[0].cells[cellKey(Math.floor(i / 4), i % 4)] = convert(tile); });
    }
    return data;
}
function addToBoard(data: BoardData, id: string, tileIds: string[]) {
    const board = data.boards[id];
    if (!board)
        return;
    const grid = board.gridOverride ?? data.gridConfig;
    for (const tileId of tileIds) {
        if (!data.tiles[tileId])
            continue;
        let placed = false;
        for (const page of board.pages) {
            for (let i = 0; i < grid.rows * grid.cols; i++) {
                const key = cellKey(Math.floor(i / grid.cols), i % grid.cols);
                if (!page.cells[key]) {
                    page.cells[key] = { tileId };
                    placed = true;
                    break;
                }
            }
            if (placed)
                break;
        }
        if (!placed)
            board.pages.push({ cells: { "0:0": { tileId } } });
    }
}
export const createBoardStore = () => createStore<BoardState>()(persist((set, get) => {
    const mutate = (fn: (data: BoardData) => void) => set(state => { const data = structuredClone({ tiles: state.tiles, boards: state.boards, catalogOrder: state.catalogOrder, gridConfig: state.gridConfig, tileAppearance: state.tileAppearance, speechConfig: state.speechConfig, accessConfig: state.accessConfig, sentence: state.sentence }); fn(data); return data; });
    return {
        ...initialData(),
        setGridConfig: (grid, id) => mutate(d => { if (id && d.boards[id])
            d.boards[id].gridOverride = clampGrid(grid);
        else if (!id)
            d.gridConfig = clampGrid(grid); }),
        reflowOutOfBoundsTiles: id => mutate(d => { const b = d.boards[id]; if (!b)
            return; const grid = b.gridOverride ?? d.gridConfig; const overflow: {
            tileId: string;
            hidden?: boolean;
        }[] = []; b.pages.forEach(p => Object.entries(p.cells).forEach(([key, placement]) => { if (placement && !inBounds(key, grid)) {
            overflow.push(placement);
            delete p.cells[key as CellKey];
        } })); for (const placement of overflow) {
            const before = new Set(b.pages.flatMap((p, page) => Object.keys(p.cells).map(k => `${page}/${k}`)));
            addToBoard(d, id, [placement.tileId]);
            b.pages.forEach((p, page) => Object.keys(p.cells).forEach(k => { if (!before.has(`${page}/${k}`))
                p.cells[k as CellKey] = placement; }));
        } }),
        setTileAppearance: patch => set(s => ({ tileAppearance: { ...s.tileAppearance, ...patch } })),
        setSpeechConfig: patch => set(s => ({ speechConfig: { ...s.speechConfig, ...patch } })),
        setAccessConfig: patch => set(s => ({ accessConfig: { ...s.accessConfig, ...patch } })),
        appendSentenceTile: tile => set(s => ({ sentence: [...s.sentence, { instanceId: uid(), tileId: tile.id, label: tile.label, spokenText: tile.spokenText || tile.label, iconName: tile.iconName, colorKey: tile.colorKey ?? s.boards[tile.categoryId]?.colorKey ?? "slate" }] })),
        removeSentenceTokenAt: i => set(s => ({ sentence: s.sentence.filter((_, n) => n !== i) })), popSentenceToken: () => set(s => ({ sentence: s.sentence.slice(0, -1) })), clearSentence: () => set({ sentence: [] }),
        upsertTile: tile => set(s => ({ tiles: { ...s.tiles, [tile.id]: tile } })),
        assignSlot: (id, page, key, tileId) => mutate(d => { const b = d.boards[id]; if (!b || (tileId && !d.tiles[tileId]))
            return; while (b.pages.length <= page)
            b.pages.push({ cells: {} }); if (tileId)
            b.pages[page].cells[key] = { tileId };
        else
            delete b.pages[page].cells[key]; }),
        swapSlots: (id, page, from, to) => mutate(d => { const cells = d.boards[id]?.pages[page]?.cells; if (!cells)
            return; const a = cells[from], b = cells[to]; delete cells[from]; delete cells[to]; if (a)
            cells[to] = a; if (b)
            cells[from] = b; }),
        setSlotHidden: (id, page, key, hidden) => mutate(d => { const p = d.boards[id]?.pages[page]?.cells[key]; if (p)
            p.hidden = hidden; }),
        createCatalog: input => { const id = `cat-${uid()}`; mutate(d => { d.boards[id] = { id, name: input.name.trim() || "Catalog", shortName: input.shortName?.trim() || input.name.trim(), colorKey: input.colorKey, iconName: input.iconName, isBuiltIn: false, pages: [{ cells: {} }] }; d.catalogOrder.push(id); }); if (input.placeFolderOnHome)
            get().placeFolderOnHome(id); return id; },
        updateCatalog: (id, patch) => mutate(d => {
            if (!d.boards[id]) return;
            Object.assign(d.boards[id], patch);
            for (const tile of Object.values(d.tiles)) {
                if (tile.kind !== "folder" || tile.targetBoardId !== id) continue;
                if (patch.name !== undefined) tile.label = patch.name;
                if (patch.iconName !== undefined) tile.iconName = patch.iconName;
            }
        }),
        deleteCatalog: id => mutate(d => { if (!d.boards[id] || d.boards[id].isBuiltIn)
            return; delete d.boards[id]; d.catalogOrder = d.catalogOrder.filter(c => c !== id); const folderIds = new Set(Object.values(d.tiles).filter(t => t.kind === "folder" && t.targetBoardId === id).map(t => t.id)); for (const b of Object.values(d.boards))
            b.pages.forEach(p => Object.entries(p.cells).forEach(([k, v]) => { if (v && folderIds.has(v.tileId))
                delete p.cells[k as CellKey]; })); folderIds.forEach(k => delete d.tiles[k]); Object.values(d.tiles).forEach(t => { if (t.categoryId === id)
            t.categoryId = "home"; }); }),
        reorderCatalog: (id, direction) => mutate(d => { const a = d.catalogOrder.indexOf(id), b = a + direction; if (a >= 0 && b >= 0 && b < d.catalogOrder.length)
            [d.catalogOrder[a], d.catalogOrder[b]] = [d.catalogOrder[b], d.catalogOrder[a]]; }),
        addWordsToCatalog: (id, ids) => mutate(d => addToBoard(d, id, ids)),
        placeFolderOnHome: id => mutate(d => { const b = d.boards[id]; if (!b)
            return; const tileId = `folder-${id}`; d.tiles[tileId] = { id: tileId, kind: "folder", label: b.name, categoryId: id, targetBoardId: id, iconName: b.iconName }; addToBoard(d, "home", [tileId]); }),
    };
}, { name: "wikahon-board-v2", version: 2, skipHydration: true,
    storage: createJSONStorage(() => ({ getItem: key => { const current = localStorage.getItem(key); if (current)
            return current; const legacy = localStorage.getItem("wikahon-board-v1"); if (!legacy)
            return null; try {
            return JSON.stringify({ state: migrateV1(JSON.parse(legacy).state), version: 2 });
        }
        catch {
            return null;
        } }, setItem: (key, value) => { try {
            localStorage.setItem(key, value);
        }
        catch { /* Keep the board usable when browser storage is unavailable or full. */ } }, removeItem: key => localStorage.removeItem(key) })),
    migrate: value => migrateV1(value),
    partialize: ({ tiles, boards, catalogOrder, gridConfig, tileAppearance, speechConfig, accessConfig, sentence }) => ({ tiles, boards, catalogOrder, gridConfig, tileAppearance, speechConfig, accessConfig, sentence }),
}));
export type BoardStore = ReturnType<typeof createBoardStore>;
