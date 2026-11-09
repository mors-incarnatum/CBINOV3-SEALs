"use client";
import { useState } from "react";
import { useBoardStore } from "@/store/BoardProvider";
import { clampGrid, inBounds, type GridConfig } from "@/lib/board";
export function useBoardSettingsViewModel(boardId: string) {
    const boards = useBoardStore(s => s.boards), global = useBoardStore(s => s.gridConfig), appearance = useBoardStore(s => s.tileAppearance), speech = useBoardStore(s => s.speechConfig), access = useBoardStore(s => s.accessConfig);
    const setGrid = useBoardStore(s => s.setGridConfig), setAppearance = useBoardStore(s => s.setTileAppearance), setSpeech = useBoardStore(s => s.setSpeechConfig), setAccess = useBoardStore(s => s.setAccessConfig), reflow = useBoardStore(s => s.reflowOutOfBoundsTiles);
    const updater = useBoardStore(s => s.updateCatalog);
    const [scope, setScope] = useState("global"), [selected, setSelected] = useState(boards[boardId] ? boardId : "home"), [draft, setDraft] = useState(global), [pin, setPin] = useState(access.editPin || ""), [saved, setSaved] = useState(false);
    const [tab, setTab] = useState<"layout" | "speech">("layout");
    const [pinSaved, setPinSaved] = useState(false);
    const overflow = Object.values(boards).filter(b => scope === "global" ? !b.gridOverride : b.id === selected).reduce((n, b) => n + b.pages.reduce((m, p) => m + Object.keys(p.cells).filter(k => !inBounds(k, draft)).length, 0), 0);
    return { state: { tab, pinSaved, boards, scope, selected, draft, appearance, speech, access, pin, saved, overflow, preview: Array.from({ length: draft.rows * draft.cols }) }, actions: { setTab, setScope: (value: string) => { setScope(value); setDraft(value === "global" ? global : boards[selected].gridOverride ?? global); setSaved(false); }, selectBoard: (id: string) => { setSelected(id); setDraft(boards[id].gridOverride ?? global); setSaved(false); }, setDraft: (grid: GridConfig) => { setDraft(clampGrid(grid)); setSaved(false); }, swapRowsCols: () => { setDraft({ rows: draft.cols, cols: draft.rows }); setSaved(false); }, apply: () => { setGrid(draft, scope === "global" ? undefined : selected); setSaved(true); }, reflow: () => { setGrid(draft, scope === "global" ? undefined : selected); Object.values(boards).filter(b => scope === "global" ? !b.gridOverride : b.id === selected).forEach(b => reflow(b.id)); setSaved(true); }, useGlobal: () => { updater(selected, { gridOverride: undefined }); setDraft(global); setSaved(true); }, setAppearance, setSpeech, setAccess, setPin: (value: string) => { setPin(value); setPinSaved(false); }, savePin: () => { setAccess({ editPin: pin.trim() || null }); setPinSaved(true); } } };
}

