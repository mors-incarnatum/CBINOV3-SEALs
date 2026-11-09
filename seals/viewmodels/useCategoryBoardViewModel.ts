"use client";
import { useState } from "react";
import { useBoardStore } from "@/store/BoardProvider";
export function useCategoryBoardViewModel(categoryId: string) {
    const board = useBoardStore(s => s.boards[categoryId]), [panel, setPanel] = useState<"add" | "manage" | null>(null);
    return { state: { board, panel }, actions: { setPanel } };
}
