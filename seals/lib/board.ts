export const CATEGORY_IDS = ["needs", "actions", "people", "feelings"] as const;
export type CategoryId = typeof CATEGORY_IDS[number];
export interface WordTile {
    id: string;
    label: string;
    categoryId: CategoryId;
    iconName: string;
    isCustom?: boolean;
}
export interface GridSlot {
    slotIndex: number;
    tile: WordTile | null;
}
export const CATEGORIES = {
    needs: { label: "Needs / Emergency", wheel: "Needs", background: "#FDF2F4", fill: "#FCE4E8", color: "#7F1D1D" },
    actions: { label: "Actions / Response", wheel: "Actions", background: "#ECFDF5", fill: "#D1FAE5", color: "#064E3B" },
    people: { label: "People", wheel: "People", background: "#FEFCE8", fill: "#FEF3C7", color: "#78350F" },
    feelings: { label: "Feelings", wheel: "Feelings", background: "#EFF6FF", fill: "#DBEAFE", color: "#1E3A8A" },
} as const;
export const isCategoryId = (value: string): value is CategoryId => CATEGORY_IDS.some(id => id === value);
const seeds: Record<CategoryId, [
    string,
    string
][]> = {
    needs: [["Kain", "eat"], ["Inom", "drink"], ["Tubig", "water"], ["Banyo", "toilet"], ["Tulong", "help"]],
    actions: [["Oo", "yes"], ["Hindi", "no"], ["Sandali", "wait"], ["Pakisuyo", "please"], ["Tapos na", "done"]],
    people: [["Nanay", "mother"], ["Tatay", "father"], ["Ate", "sister"], ["Kuya", "brother"], ["Guro", "teacher"]],
    feelings: [["Masaya", "happy"], ["Malungkot", "sad"], ["Galit", "angry"], ["Masakit", "pain"], ["Pagod", "tired"]],
};
export const INITIAL_DICTIONARY = Object.fromEntries(CATEGORY_IDS.map(categoryId => [categoryId, seeds[categoryId].map(([label, iconName], i) => ({ id: `${categoryId[0]}-${i + 1}`, label, categoryId, iconName }))])) as Record<CategoryId, WordTile[]>;
export const ICONS = Object.values(INITIAL_DICTIONARY).flat().map(tile => ({ name: tile.iconName, label: tile.label, path: `/gifs/${tile.label.toLowerCase().replaceAll(" ", "-")}.gif` }));
ICONS.push(...["tigil", "ayoko", "gusto-ko-pa"].map(name => ({ name, label: name.replaceAll("-", " "), path: `/gifs/${name}.gif` })));
export const iconPath = (name: string | null) => ICONS.find(icon => icon.name === name)?.path;
export type ColorKey = "rose" | "emerald" | "amber" | "blue" | "violet" | "teal" | "orange" | "pink" | "slate";
export type WordClass = "social" | "question" | "verb" | "pronoun" | "particle" | "modifier" | "place" | "noun" | "other";
export const WORD_COLORS: Record<WordClass, ColorKey> = { social: "rose", question: "slate", verb: "emerald", pronoun: "amber", particle: "pink", modifier: "blue", place: "violet", noun: "orange", other: "teal" };
export interface Tile {
    id: string;
    kind: "word" | "folder";
    label: string;
    spokenText?: string;
    iconName: string | null;
    categoryId: string;
    targetBoardId?: string;
    colorKey?: ColorKey;
    wordClass?: WordClass;
    isCustom?: boolean;
}
export type CellKey = `${number}:${number}`;
export interface CellPlacement {
    tileId: string;
    hidden?: boolean;
}
export interface BoardPage {
    cells: Partial<Record<CellKey, CellPlacement>>;
}
export interface GridConfig {
    rows: number;
    cols: number;
}
export interface CatalogBoard {
    id: string;
    name: string;
    shortName: string;
    colorKey: ColorKey;
    iconName: string | null;
    isBuiltIn: boolean;
    gridOverride?: GridConfig;
    pages: BoardPage[];
}
export interface SentenceToken {
    instanceId: string;
    tileId: string;
    label: string;
    spokenText: string;
    iconName: string | null;
    colorKey: ColorKey;
}
export const DEFAULT_GRID: GridConfig = { rows: 5, cols: 4 };
export const GRID_LIMITS = { minRows: 1, maxRows: 16, minCols: 1, maxCols: 16 };
export const GRID_PRESETS = [[2, 2], [3, 3], [3, 4], [4, 4], [5, 4], [5, 6], [6, 6], [6, 8], [7, 9], [8, 10], [9, 16]].map(([rows, cols]) => ({ rows, cols }));
export const cellKey = (row: number, col: number): CellKey => `${row}:${col}`;
export const inBounds = (cell: string, grid: GridConfig) => { const [r, c] = cell.split(":").map(Number); return r >= 0 && c >= 0 && r < grid.rows && c < grid.cols; };
export const clampGrid = (grid: GridConfig): GridConfig => ({ rows: Math.max(1, Math.min(16, Math.round(grid.rows) || 1)), cols: Math.max(1, Math.min(16, Math.round(grid.cols) || 1)) });
export const uid = () => crypto.randomUUID();
