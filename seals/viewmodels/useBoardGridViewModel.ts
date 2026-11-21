"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useBoardSelector } from "@/store/BoardProvider";
import { cellKey, clampGrid, inBounds, type CellKey } from "@/lib/board";

type ArrowKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";
const EMPTY_PINNED_IDS: string[] = [];

interface BoardSize {
    width: number;
    height: number;
    gapX: number;
    gapY: number;
}

function fitTracks(size: number, gap: number, tileSize: number) {
    return Math.max(1, Math.floor((size + gap) / (tileSize + gap)));
}

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

export function useBoardGridViewModel(boardId: string, editing: boolean) {
    const {
        board,
        global,
        globalMode,
        tiles,
        appearance,
        boards,
        pinnedTileIds,
        assign,
        swap,
        hide,
        reflowBoardToGrid,
        togglePinnedTile,
    } = useBoardSelector(s => ({
        board: s.boards[boardId],
        global: s.gridConfig,
        globalMode: s.layoutMode ?? "manual",
        tiles: s.tiles,
        appearance: s.tileAppearance,
        boards: s.boards,
        pinnedTileIds: s.experimentalData?.pinnedTileIds ?? EMPTY_PINNED_IDS,
        assign: s.assignSlot,
        swap: s.swapSlots,
        hide: s.setSlotHidden,
        reflowBoardToGrid: s.reflowBoardToGrid,
        togglePinnedTile: s.togglePinnedTile,
    }));

    const [page, setPage] = useState(0);
    const [target, setTarget] = useState<CellKey | null>(null);
    const [targetPage, setTargetPage] = useState(0);
    const [editor, setEditor] = useState<"edit" | "replace" | null>(null);
    const [moving, setMoving] = useState<CellKey | null>(null);
    const [movingPage, setMovingPage] = useState(0);

    const [boardSize, setBoardSizeState] = useState<BoardSize>({
        width: 0,
        height: 0,
        gapX: 0,
        gapY: 0,
    });

    const configuredGrid = board?.gridOverride ?? global;
    const layoutMode = board?.layoutModeOverride ?? globalMode;
    const automatic = layoutMode === "automatic";
    const grid = automatic && boardSize.width > 0 && boardSize.height > 0
        ? clampGrid({
            cols: fitTracks(boardSize.width, boardSize.gapX, Math.max(44, (appearance.tileWidth ?? 50) * 1.6)),
            rows: fitTracks(boardSize.height, boardSize.gapY, Math.max(44, (appearance.tileHeight ?? 50) * 1.6)),
        })
        : configuredGrid;
    const { rows, cols } = grid;
    const savedPages = board?.pages;
    const pages = useMemo(() => {
        const slotKeys = Array.from({ length: configuredGrid.rows * configuredGrid.cols }, (_, index) =>
            cellKey(Math.floor(index / configuredGrid.cols), index % configuredGrid.cols),
        );
        const sourcePages = savedPages?.length ? savedPages : [{ cells: {} }];
        const slots = sourcePages.flatMap((page, pageIndex) => {
            const keys = automatic
                ? (Object.keys(page.cells) as CellKey[]).filter(key => page.cells[key]).sort((a, b) => {
                    const [aRow, aCol] = a.split(":").map(Number);
                    const [bRow, bCol] = b.split(":").map(Number);
                    return aRow - bRow || aCol - bCol;
                })
                : slotKeys;
            return keys.map(key => {
                const placement = page.cells[key];
                return {
                    key,
                    sourcePage: pageIndex,
                    placement,
                    tile: placement ? tiles[placement.tileId] : undefined,
                };
            });
        });
        const capacity = rows * cols;
        if (automatic && editing) {
            // An automatic slot always retains the saved address of the tile or empty cell.
            const emptyCount = capacity - (slots.length % capacity);
            const emptySlots = sourcePages.flatMap((page, sourcePage) =>
                slotKeys.filter(key => !page.cells[key]).map(key => ({
                    key, sourcePage, placement: undefined, tile: undefined,
                })),
            );
            for (let index = 0; index < emptyCount; index++) {
                const offset = index - emptySlots.length;
                slots.push(emptySlots[index] ?? {
                    key: slotKeys[offset % slotKeys.length],
                    sourcePage: sourcePages.length + Math.floor(offset / slotKeys.length),
                    placement: undefined,
                    tile: undefined,
                });
            }
        }
        return Array.from({ length: Math.max(1, Math.ceil(slots.length / capacity)) }, (_, page) => ({
            page,
            cells: slots.slice(page * capacity, (page + 1) * capacity),
        }));
    }, [automatic, editing, savedPages, cols, configuredGrid.cols, configuredGrid.rows, rows, tiles]);
    const pageCount = pages.length;
    const activePage = Math.min(page, pageCount - 1);

    const placement = target ? board?.pages[targetPage]?.cells[target] : undefined;
    const targetTile = placement ? tiles[placement.tileId] : undefined;

    const close = () => {
        setTarget(null);
        setEditor(null);
    };

    const setBoardSize = useCallback((size: BoardSize) => {
        setBoardSizeState(current =>
            current.width === size.width &&
            current.height === size.height &&
            current.gapX === size.gapX &&
            current.gapY === size.gapY
                ? current
                : size,
        );
    }, []);

    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const container = scrollRef.current;
        const gridElement = container?.querySelector<HTMLElement>(".board-grid");
        if (!automatic || !container || !gridElement) return;

        const measure = () => {
            const styles = window.getComputedStyle(gridElement);
            setBoardSize({
                width: container.clientWidth,
                height: container.clientHeight,
                gapX: parseFloat(styles.columnGap) || 0,
                gapY: parseFloat(styles.rowGap) || 0,
            });
        };

        measure();
        const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : undefined;
        observer?.observe(container);
        window.addEventListener("resize", measure);
        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", measure);
        };
    }, [automatic, appearance.gridGap, setBoardSize]);

    return {
        scrollRef,
        state: {
            board,
            boards,
            ...grid,
            automatic,
            appearance,
            pages,
            page: activePage,
            pageCount,
            target,
            targetPage,
            editor,
            moving,
            movingPage,
            placement,
            targetTile,
            isTargetPinned: Boolean(targetTile && pinnedTileIds.includes(targetTile.id)),
            overflow: automatic ? 0
                : board?.pages.reduce(
                    (n, p) => n + Object.keys(p.cells).filter(k => !inBounds(k, grid)).length,
                    0,
                ) || 0,
        },
        actions: {
            open: (key: CellKey, pageIndex: number) => {
                setTarget(key);
                setTargetPage(pageIndex);
                if (!board?.pages[pageIndex]?.cells[key]) {
                    setEditor("replace");
                } else {
                    setEditor(null);
                }
            },
            close,
            setEditor,
            remove: () => {
                if (target) {
                    assign(boardId, targetPage, target, null);
                }
                close();
            },
            toggleHidden: () => {
                if (target) {
                    hide(boardId, targetPage, target, !placement?.hidden);
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
                setMovingPage(targetPage);
                close();
            },
            moveTo: (key: CellKey, pageIndex: number) => {
                if (moving && (automatic || movingPage === pageIndex)) {
                    swap(boardId, movingPage, moving, key, pageIndex);
                }
                setMoving(null);
            },
            onScroll: (e: React.UIEvent<HTMLDivElement>) => {
                const { scrollTop, clientHeight } = e.currentTarget;
                if (clientHeight > 0) {
                    setPage(Math.min(pageCount - 1, Math.round(scrollTop / clientHeight)));
                }
            },
            reflow: () => reflowBoardToGrid(boardId, configuredGrid),
            onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Escape") {
                    close();
                    setMoving(null);
                    return;
                }

                if (
                    e.key === "ArrowLeft" ||
                    e.key === "ArrowRight" ||
                    e.key === "ArrowUp" ||
                    e.key === "ArrowDown"
                ) {
                    const target = e.target as HTMLElement;
                    const gridElement = target.closest(".board-grid");
                    if (!gridElement) return;
                    const buttons = Array.from(gridElement.querySelectorAll<HTMLButtonElement>(".aac-tile"));
                    const i = buttons.indexOf(target as HTMLButtonElement);
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
