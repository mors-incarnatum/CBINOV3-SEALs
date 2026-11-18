
"use client";

import { useEffect, useState } from "react";
import { useBoardStore } from "@/store/BoardProvider";
import { cellKey, inBounds, type CellKey, type GridConfig } from "@/lib/board";

interface BoardSize {
    width: number;
    height: number;
    gapX: number;
    gapY: number;
}

function normalizeDimension(value: number | undefined) {
    if (value === undefined) return 1;
    return Math.max(1, Math.min(2, value / 50));
}

function calculateFit(
    availableSize: number,
    gap: number,
    baseCount: number,
    tileScale: number
) {
    if (availableSize <= 0) return baseCount;

    const baseCellSize =
        (availableSize - gap * (baseCount - 1)) / baseCount;

    const desiredTileSize = baseCellSize * tileScale;

    return Math.max(
        1,
        Math.min(
            baseCount,
            Math.floor(
                (availableSize + gap) / (desiredTileSize + gap)
            )
        )
    );
}

export function useBoardGridViewModel(boardId: string) {
    const board = useBoardStore(s => s.boards[boardId]);
    const global = useBoardStore(s => s.gridConfig);
    const globalMode = useBoardStore(s => s.layoutMode);
    const tiles = useBoardStore(s => s.tiles);
    const appearance = useBoardStore(s => s.tileAppearance);
    const boards = useBoardStore(s => s.boards);

    const assign = useBoardStore(s => s.assignSlot);
    const swap = useBoardStore(s => s.swapSlots);
    const hide = useBoardStore(s => s.setSlotHidden);
    const reflowBoardToGrid = useBoardStore(s => s.reflowBoardToGrid);

    const [page, setPage] = useState(0);
    const [target, setTarget] = useState<CellKey | null>(null);
    const [targetPage, setTargetPage] = useState(0);
    const [editor, setEditor] = useState<"edit" | "replace" | null>(null);
    const [moving, setMoving] = useState<CellKey | null>(null);
    const [movingPage, setMovingPage] = useState(0);

    const [boardSize, setBoardSize] = useState<BoardSize>({
        width: 0,
        height: 0,
        gapX: 0,
        gapY: 0
    });

    const configuredGrid = board?.gridOverride ?? global;
    const layoutMode = board?.layoutModeOverride ?? globalMode;

    const tileWidth = normalizeDimension(appearance.tileWidth);
    const tileHeight = normalizeDimension(appearance.tileHeight);

    const grid: GridConfig = {
        cols: calculateFit(
            boardSize.width,
            boardSize.gapX,
            configuredGrid.cols,
            tileWidth
        ),
        rows: calculateFit(
            boardSize.height,
            boardSize.gapY,
            configuredGrid.rows,
            tileHeight
        )
    };

    // Reflow only when the effective grid dimensions change.
    useEffect(() => {
        if (!board) return;

        reflowBoardToGrid(boardId, grid);
    }, [
        boardId,
        !!board,
        grid.rows,
        grid.cols,
        reflowBoardToGrid
    ]);

    const pageCount = board?.pages.length || 1;
    const activePage = Math.min(page, pageCount - 1);

    useEffect(() => {
        setPage(current => Math.min(current, pageCount - 1));
    }, [pageCount]);

    const pages = Array.from({ length: pageCount }, (_, pageIndex) => ({
        page: pageIndex,
        cells: Array.from({ length: grid.rows * grid.cols }, (_, i) => {
            const key = cellKey(
                Math.floor(i / grid.cols),
                i % grid.cols
            );

            const placement = board?.pages[pageIndex]?.cells[key];

            return {
                key,
                placement,
                tile: placement ? tiles[placement.tileId] : undefined
            };
        })
    }));

    const cells = pages[activePage]?.cells ?? [];

    const placement = target
        ? board?.pages[targetPage]?.cells[target]
        : undefined;

    const close = () => {
        setTarget(null);
        setEditor(null);
    };

    return {
        state: {
            board,
            boards,
            ...grid,
            layoutMode,
            appearance,
            boardSize,
            cells,
            pages,
            page: activePage,
            pageCount,
            target,
            targetPage,
            editor,
            moving,
            movingPage,
            placement,
            targetTile: placement
                ? tiles[placement.tileId]
                : undefined,
            overflow: board?.pages.reduce(
                (n, p) =>
                    n +
                    Object.keys(p.cells).filter(
                        k => !inBounds(k, grid)
                    ).length,
                0
            ) || 0
        },

        actions: {
            setBoardSize: (size: BoardSize) => {
                setBoardSize(current =>
                    current.width === size.width &&
                    current.height === size.height &&
                    current.gapX === size.gapX &&
                    current.gapY === size.gapY
                        ? current
                        : size
                );
            },

            open: (key: CellKey, pageIndex = activePage) => {
                setTarget(key);
                setTargetPage(pageIndex);

                if (!board?.pages[pageIndex]?.cells[key])
                    setEditor("replace");
                else
                    setEditor(null);
            },

            close,
            setEditor,

            remove: () => {
                if (target)
                    assign(boardId, targetPage, target, null);

                close();
            },

            toggleHidden: () => {
                if (target)
                    hide(boardId, targetPage, target, !placement?.hidden);

                close();
            },

            startMove: () => {
                setMoving(target);
                setMovingPage(targetPage);
                close();
            },

            moveTo: (key: CellKey, pageIndex = activePage) => {
                if (moving && movingPage === pageIndex)
                    swap(boardId, pageIndex, moving, key);

                setMoving(null);
            },

            setActivePage: (n: number) => {
                setPage(Math.max(0, Math.min(pageCount - 1, n)));
            },

            changePage: (n: number) => {
                setPage(Math.max(0, Math.min(pageCount - 1, n)));
                setMoving(null);
                close();
            },

            reflow: () => reflowBoardToGrid(boardId, grid),

            onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Escape") {
                    close();
                    setMoving(null);
                }

                const delta: Record<string, number> = {
                    ArrowLeft: -1,
                    ArrowRight: 1,
                    ArrowUp: -grid.cols,
                    ArrowDown: grid.cols
                };

                if (e.key in delta) {
                    const buttons = Array.from(
                        e.currentTarget.querySelectorAll<HTMLButtonElement>(
                            ".aac-tile"
                        )
                    );

                    const i = buttons.indexOf(
                        e.target as HTMLButtonElement
                    );

                    if (i >= 0) {
                        e.preventDefault();

                        buttons[
                            Math.max(
                                0,
                                Math.min(
                                    buttons.length - 1,
                                    i + delta[e.key]
                                )
                            )
                        ]?.focus();
                    }
                }
            }
        }
    };
}
