"use client";
import { useRef, useState } from "react";
import { useBoardStore } from "@/store/BoardProvider";
import { cellKey, inBounds, type CellKey } from "@/lib/board";
export function useBoardGridViewModel(boardId: string) {
    const board = useBoardStore(s => s.boards[boardId]), global = useBoardStore(s => s.gridConfig), tiles = useBoardStore(s => s.tiles), appearance = useBoardStore(s => s.tileAppearance), boards = useBoardStore(s => s.boards);
    const swipeThreshold = useBoardStore(s => s.accessConfig.swipeThresholdPx ?? 60);
    const assign = useBoardStore(s => s.assignSlot), swap = useBoardStore(s => s.swapSlots), hide = useBoardStore(s => s.setSlotHidden), reflow = useBoardStore(s => s.reflowOutOfBoundsTiles);
    const [page, setPage] = useState(0), [target, setTarget] = useState<CellKey | null>(null), [editor, setEditor] = useState<"edit" | "replace" | null>(null), [moving, setMoving] = useState<CellKey | null>(null);
    const touch = useRef<{
        x: number;
        y: number;
    } | null>(null);
    const grid = board?.gridOverride ?? global, pageCount = board?.pages.length || 1, activePage = Math.min(page, pageCount - 1);
    const cells = Array.from({ length: grid.rows * grid.cols }, (_, i) => { const key = cellKey(Math.floor(i / grid.cols), i % grid.cols), placement = board?.pages[activePage]?.cells[key]; return { key, placement, tile: placement ? tiles[placement.tileId] : undefined }; });
    const placement = target ? board?.pages[activePage]?.cells[target] : undefined;
    const close = () => { setTarget(null); setEditor(null); };
    return { state: { board, boards, ...grid, appearance, cells, page: activePage, pageCount, target, editor, moving, placement, targetTile: placement ? tiles[placement.tileId] : undefined, overflow: board?.pages.reduce((n, p) => n + Object.keys(p.cells).filter(k => !inBounds(k, grid)).length, 0) || 0 }, actions: { open: (key: CellKey) => { setTarget(key); if (!board?.pages[activePage]?.cells[key])
                setEditor("replace"); }, close, setEditor, remove: () => { if (target)
                assign(boardId, activePage, target, null); close(); }, toggleHidden: () => { if (target)
                hide(boardId, activePage, target, !placement?.hidden); close(); }, startMove: () => { setMoving(target); close(); }, moveTo: (key: CellKey) => { if (moving)
                swap(boardId, activePage, moving, key); setMoving(null); }, changePage: (n: number) => { setPage(Math.max(0, Math.min(pageCount - 1, n))); setMoving(null); close(); }, reflow: () => reflow(boardId), onTouchStart: (e: React.TouchEvent) => { touch.current = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }; }, onTouchEnd: (e: React.TouchEvent) => { if (!touch.current)
                return; const dx = e.changedTouches[0].clientX - touch.current.x, dy = e.changedTouches[0].clientY - touch.current.y; if (Math.abs(dx) > swipeThreshold && Math.abs(dx) > Math.abs(dy)) {
                setPage(Math.max(0, Math.min(pageCount - 1, activePage + (dx < 0 ? 1 : -1))));
                close();
            } touch.current = null; }, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Escape") {
                close();
                setMoving(null);
            } if (e.key === "PageDown" || e.key === "PageUp") {
                e.preventDefault();
                setPage(Math.max(0, Math.min(pageCount - 1, activePage + (e.key === "PageDown" ? 1 : -1))));
                close();
            } const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -grid.cols, ArrowDown: grid.cols }; if (e.key in delta) {
                const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>(".aac-tile")), i = buttons.indexOf(e.target as HTMLButtonElement);
                if (i >= 0) {
                    e.preventDefault();
                    buttons[Math.max(0, Math.min(buttons.length - 1, i + delta[e.key]))]?.focus();
                }
            } } } };
}
