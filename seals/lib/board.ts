export const CATEGORY_IDS = ["needs", "actions", "people", "feelings"] as const;
export type CategoryId = typeof CATEGORY_IDS[number];
export interface WordTile { id: string; label: string; categoryId: CategoryId; iconName: string; isCustom?: boolean }
export interface GridSlot { slotIndex: number; tile: WordTile | null }
export const CATEGORIES = {
  needs: { label: "Needs / Emergency", wheel: "Needs", background: "#FDF2F4", fill: "#FCE4E8", color: "#7F1D1D" },
  actions: { label: "Actions / Response", wheel: "Actions", background: "#ECFDF5", fill: "#D1FAE5", color: "#064E3B" },
  people: { label: "People", wheel: "People", background: "#FEFCE8", fill: "#FEF3C7", color: "#78350F" },
  feelings: { label: "Feelings", wheel: "Feelings", background: "#EFF6FF", fill: "#DBEAFE", color: "#1E3A8A" },
} as const;
export const isCategoryId = (value: string): value is CategoryId => CATEGORY_IDS.some(id => id === value);
const seeds: Record<CategoryId, [string, string][]> = {
  needs: [["Kain", "eat"], ["Inom", "drink"], ["Tubig", "water"], ["Banyo", "toilet"], ["Tulong", "help"]],
  actions: [["Oo", "yes"], ["Hindi", "no"], ["Sandali", "wait"], ["Pakisuyo", "please"], ["Tapos na", "done"]],
  people: [["Nanay", "mother"], ["Tatay", "father"], ["Ate", "sister"], ["Kuya", "brother"], ["Guro", "teacher"]],
  feelings: [["Masaya", "happy"], ["Malungkot", "sad"], ["Galit", "angry"], ["Masakit", "pain"], ["Pagod", "tired"]],
};
export const INITIAL_DICTIONARY = Object.fromEntries(CATEGORY_IDS.map(categoryId => [categoryId, seeds[categoryId].map(([label, iconName], i) => ({ id: `${categoryId[0]}-${i + 1}`, label, categoryId, iconName }))])) as Record<CategoryId, WordTile[]>;
export const ICONS = Object.values(INITIAL_DICTIONARY).flat().map(tile => ({ name: tile.iconName, label: tile.label, path: `/gifs/${tile.label.toLowerCase().replaceAll(" ", "-")}.gif` }));
export const iconPath = (name: string) => ICONS.find(icon => icon.name === name)?.path;
