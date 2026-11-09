"use client";
import { createContext, useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { useSentenceViewModel } from "./useSentenceViewModel";
import { useEditModeViewModel } from "./useEditModeViewModel";
export const SentenceContext = createContext<ReturnType<typeof useSentenceViewModel> | null>(null);
export function useSentenceContext() { const vm = useContext(SentenceContext); if (!vm)
    throw new Error("Sentence provider required"); return vm; }
export function useBoardShellViewModel() {
    const sentence = useSentenceViewModel(), edit = useEditModeViewModel(), pathname = usePathname();
    const [panel, setPanel] = useState<"settings" | "catalogs" | null>(null), [wheel, setWheel] = useState<{
        x: number;
        y: number;
    } | null>(null);
    return { sentence, edit, state: { panel, wheel, boardId: decodeURIComponent(pathname.split("/")[2] || "home") }, actions: { setPanel, closeWheel: () => setWheel(null), openCatalogs: () => { setWheel(null); setPanel("catalogs"); }, onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); setWheel({ x: e.clientX, y: e.clientY }); }, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
                e.preventDefault();
                setWheel({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
            } } } };
}
