"use client";

import { useRef, useState } from "react";
import { useBoardSelector } from "@/store/BoardProvider";
import { cellKey, inBounds, type CellKey } from "@/lib/board";

type ArrowKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";
const EMPTY_PINNED_IDS: string[] = [];

/**
 * Finds the next focusable `.aac-tile` button along the same row or column
 * in the given direction, returning null at grid boundaries or if every
 * remaining slot in that direction is disabled (`aria-disabled="true"`).
 */
function findNextEnabledButton(
    buttons: HTMLButtonElement[],
    i: number,
    cols: number,
    key: ArrowKey,
): HTMLButtonElement | null {
    if (cols <= 0) return null;

    if (key === "ArrowLeft" && i % cols === 0) return null;
    if (key === "ArrowRight" && (i + 1) % cols === 0) return null;
    if (key === "ArrowUp" && i - cols < 0) return null;
    if (key === "ArrowDown" && i + cols >= buttons.length) return null;

    const rowStart = i - (i % cols);
    const rowEnd = Math.min(buttons.length - 1, rowStart + cols - 1);

    const bounds: Record<ArrowKey, { step: number; min: number; max: number }> = {
        ArrowLeft: { step: -1, min: rowStart, max: rowEnd },
        ArrowRight: { step: 1, min: rowStart, max: rowEnd },
        ArrowUp: { step: -cols, min: 0, max: buttons.length - 1 },
        ArrowDown: { step: cols, min: 0, max: buttons.length - 1 },
    };

    const { step, min, max } = bounds[key];
    for (let idx = i + step; idx >= min && idx <= max; idx += step) {
        const btn = buttons[idx];
        if (btn.getAttribute("aria-disabled") !== "true") {
            return btn;
        }
    }

    return null;
}

export function useBoardGridViewModel(boardId: string) {
    const {
        board,
        global,
        tiles,
        appearance,
        boards,
        swipeThreshold,
        pinnedTileIds,
        assign,
        swap,
        hide,
        reflow,
        togglePinnedTile,
    } = useBoardSelector(s => ({
        board: s.boards[boardId],
        global: s.gridConfig,
        tiles: s.tiles,
        appearance: s.tileAppearance,
        boards: s.boards,
        swipeThreshold: s.accessConfig.swipeThresholdPx ?? 60,
        pinnedTileIds: s.experimentalData?.pinnedTileIds ?? EMPTY_PINNED_IDS,
        assign: s.assignSlot,
        swap: s.swapSlots,
        hide: s.setSlotHidden,
        reflow: s.reflowOutOfBoundsTiles,
        togglePinnedTile: s.togglePinnedTile,
    }));

    const [page, setPage] = useState(0);
    const [target, setTarget] = useState<CellKey | null>(null);
    const [editor, setEditor] = useState<"edit" | "replace" | null>(null);
    const [moving, setMoving] = useState<CellKey | null>(null);
    const touch = useRef<{ x: number; y: number } | null>(null);

    const grid = board?.gridOverride ?? global;
    const pageCount = board?.pages.length || 1;
    const activePage = Math.min(page, pageCount - 1);

    const cells = Array.from({ length: grid.rows * grid.cols }, (_, i) => {
        const key = cellKey(Math.floor(i / grid.cols), i % grid.cols);
        const placement = board?.pages[activePage]?.cells[key];
        return {
            key,
            placement,
            tile: placement ? tiles[placement.tileId] : undefined,
        };
    });

    const placement = target ? board?.pages[activePage]?.cells[target] : undefined;
    const targetTile = placement ? tiles[placement.tileId] : undefined;

    const close = () => {
        setTarget(null);
        setEditor(null);
    };

    return {
        state: {
            board,
            boards,
            ...grid,
            appearance,
            cells,
            page: activePage,
            pageCount,
            target,
            editor,
            moving,
            placement,
            targetTile,
            isTargetPinned: Boolean(targetTile && pinnedTileIds.includes(targetTile.id)),
            overflow:
                board?.pages.reduce(
                    (n, p) => n + Object.keys(p.cells).filter(k => !inBounds(k, grid)).length,
                    0,
                ) || 0,
        },
        actions: {
            open: (key: CellKey) => {
                setTarget(key);
                if (!board?.pages[activePage]?.cells[key]) {
                    setEditor("replace");
                }
            },
            close,
            setEditor,
            remove: () => {
                if (target) {
                    assign(boardId, activePage, target, null);
                }
                close();
            },
            toggleHidden: () => {
                if (target) {
                    hide(boardId, activePage, target, !placement?.hidden);
                }
                close();
            },
            togglePinTarget: () => {
                if (targetTile) {
                    togglePinnedTile(targetTile.id);
                }
                close();
            },
            startMove: () => {
                setMoving(target);
                close();
            },
            moveTo: (key: CellKey) => {
                if (moving) {
                    swap(boardId, activePage, moving, key);
                }
                setMoving(null);
            },
            changePage: (n: number) => {
                setPage(Math.max(0, Math.min(pageCount - 1, n)));
                setMoving(null);
                close();
            },
            reflow: () => reflow(boardId),
            onTouchStart: (e: React.TouchEvent) => {
                touch.current = {
                    x: e.changedTouches[0].clientX,
                    y: e.changedTouches[0].clientY,
                };
            },
            onTouchEnd: (e: React.TouchEvent) => {
                if (!touch.current) return;
                const dx = e.changedTouches[0].clientX - touch.current.x;
                const dy = e.changedTouches[0].clientY - touch.current.y;
                if (Math.abs(dx) > swipeThreshold && Math.abs(dx) > Math.abs(dy)) {
                    setPage(Math.max(0, Math.min(pageCount - 1, activePage + (dx < 0 ? 1 : -1))));
                    close();
                }
                touch.current = null;
            },
            onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Escape") {
                    close();
                    setMoving(null);
                    return;
                }

                if (e.key === "PageDown" || e.key === "PageUp") {
                    e.preventDefault();
                    setPage(
                        Math.max(
                            0,
                            Math.min(pageCount - 1, activePage + (e.key === "PageDown" ? 1 : -1)),
                        ),
                    );
                    close();
                    return;
                }

                if (
                    e.key === "ArrowLeft" ||
                    e.key === "ArrowRight" ||
                    e.key === "ArrowUp" ||
                    e.key === "ArrowDown"
                ) {
                    const buttons = Array.from(
                        e.currentTarget.querySelectorAll<HTMLButtonElement>(".aac-tile"),
                    );
                    const i = buttons.indexOf(e.target as HTMLButtonElement);
                    if (i < 0) return;

                    const nextButton = findNextEnabledButton(buttons, i, grid.cols, e.key);
                    if (nextButton) {
                        e.preventDefault();
                        nextButton.focus();
                    }
                }
            },
        },
    };
}
