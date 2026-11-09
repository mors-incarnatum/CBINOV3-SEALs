"use client";
import { useState } from "react";
import { useBoardStore } from "@/store/BoardProvider";
import { uid, type Tile, type CellKey, type ColorKey, type WordClass } from "@/lib/board";
import { useSentenceContext } from "./useBoardShellViewModel";
export interface TileEditorTarget {
    boardId: string;
    page?: number;
    cell?: CellKey;
    tile?: Tile;
    multi?: boolean;
    onClose: () => void;
}
export function useTileEditorViewModel(target: TileEditorTarget) {
    const tiles = useBoardStore(s => s.tiles), boards = useBoardStore(s => s.boards), order = useBoardStore(s => s.catalogOrder), upsert = useBoardStore(s => s.upsertTile), assign = useBoardStore(s => s.assignSlot), add = useBoardStore(s => s.addWordsToCatalog), createCatalog = useBoardStore(s => s.createCatalog);
    const sentence = useSentenceContext();
    const [tab, setTab] = useState(target.tile?.kind === "folder" ? "folder" : target.tile ? "custom" : "existing"), [query, setQuery] = useState(""), [filter, setFilter] = useState("all"), [picked, setPicked] = useState<string[]>([]), [preview, setPreview] = useState<Tile>(target.tile ?? { id: `custom-${uid()}`, kind: "word", label: "", spokenText: "", categoryId: target.boardId === "home" ? order[0] : target.boardId, iconName: null, isCustom: true }), [folderName, setFolderName] = useState("");
    const patch = (value: Partial<Tile>) => setPreview(p => ({ ...p, ...value }));
    const saveTile = (tile: Tile) => { upsert(tile); if (target.cell)
        assign(target.boardId, target.page ?? 0, target.cell, tile.id);
    else
        add(target.boardId, [tile.id]); target.onClose(); };
    const words = Object.values(tiles).filter(t => t.kind === "word" && t.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && (filter === "all" || t.categoryId === filter || boards[filter]?.pages.some(p => Object.values(p.cells).some(c => c?.tileId === t.id))));
    return { state: { tab, query, filter, picked, preview, folderName, words, catalogs: order.map(id => boards[id]).filter(Boolean), canSave: preview.label.trim().length > 0 }, actions: { setTab, setQuery, setFilter, setFolderName, patch, setColor: (colorKey: ColorKey) => patch({ colorKey }), setWordClass: (wordClass: WordClass) => patch({ wordClass }), chooseWord: (tile: Tile) => { if (target.multi)
                setPicked(ids => ids.includes(tile.id) ? ids.filter(id => id !== tile.id) : [...ids, tile.id]);
            else
                setPreview(tile); }, saveExisting: () => { if (target.multi) {
                add(target.boardId, picked);
                target.onClose();
            }
            else if (preview.label)
                saveTile(preview); }, saveCustom: () => { if (preview.label.trim())
                saveTile({ ...preview, label: preview.label.trim(), kind: "word" }); }, chooseFolder: (id: string) => { const b = boards[id]; setPreview({ id: `folder-${uid()}`, kind: "folder", label: b.name, categoryId: id, targetBoardId: id, iconName: b.iconName }); }, saveFolder: () => { if (preview.kind === "folder")
                saveTile(preview); }, createFolder: () => { if (!folderName.trim())
                return; const id = createCatalog({ name: folderName, colorKey: preview.colorKey ?? "teal", iconName: null }); setPreview({ id: `folder-${uid()}`, kind: "folder", label: folderName.trim(), categoryId: id, targetBoardId: id, iconName: null }); setFolderName(""); }, testSpeak: () => sentence.actions.testSpeak(preview.spokenText || preview.label) } };
}
