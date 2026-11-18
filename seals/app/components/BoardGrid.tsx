
"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { useBoardGridViewModel } from "@/viewmodels/useBoardGridViewModel";
import { useEditContext } from "@/viewmodels/useEditModeViewModel";
import TileButton from "./TileButton";
import TileActionMenu from "./TileActionMenu";
import TileEditor from "./TileEditor";

export default function BoardGrid({ boardId }: {
    boardId: string;
}) {
    const { state: s, actions: a } = useBoardGridViewModel(boardId);
    const edit = useEditContext();
    const scrollRef = useRef<HTMLDivElement>(null);

    const tileWidth = s.appearance.tileWidth ?? 50;
    const tileHeight = s.appearance.tileHeight ?? 50;

    const boardSizeStyle = {
        "--tile-width-scale": tileWidth / 50,
        "--tile-height-scale": tileHeight / 50
    } as CSSProperties;

    // Measure the available grid area so enlarged tiles can reduce
    // the effective number of rows and columns.
    useEffect(() => {
        const container = scrollRef.current;

        if (!container)
            return;

        const measure = () => {
            const grid = container.querySelector<HTMLElement>(".board-grid");

            if (!grid)
                return;

            const rect = grid.getBoundingClientRect();
            const styles = window.getComputedStyle(grid);

            a.setBoardSize({
                width: rect.width,
                height: rect.height,
                gapX: parseFloat(styles.columnGap) || 0,
                gapY: parseFloat(styles.rowGap) || 0
            });
        };

        measure();

        const observer = new ResizeObserver(measure);

        observer.observe(container);

        const grid = container.querySelector<HTMLElement>(".board-grid");

        if (grid)
            observer.observe(grid);

        return () => observer.disconnect();
    }, [s.appearance.gridGap, s.rows, s.cols]);

    return (
        <>
            <div
                ref={scrollRef}
                className="board-scroll"
                role="region"
                aria-label="Scrollable communication board"
                tabIndex={0}
                style={boardSizeStyle}
                onScroll={e => {
                    const viewport = e.currentTarget.getBoundingClientRect();
                    const pages = Array.from(
                        e.currentTarget.querySelectorAll<HTMLElement>(
                            "[data-board-page]"
                        )
                    );

                    let activePage = 0;
                    let maxVisible = 0;

                    pages.forEach(p => {
                        const rect = p.getBoundingClientRect();

                        const visible = Math.max(
                            0,
                            Math.min(rect.bottom, viewport.bottom) -
                            Math.max(rect.top, viewport.top)
                        );

                        if (visible > maxVisible) {
                            maxVisible = visible;
                            activePage = Number(p.dataset.boardPage);
                        }
                    });

                    a.setActivePage(activePage);
                }}
                onKeyDown={e => a.onKeyDown(e)}
            >
                {s.pages.map(p => (
                    <section
                        key={p.page}
                        className="board-page"
                        data-board-page={p.page}
                    >
                        <div
                            className={`board-grid gap-${s.appearance.gridGap}`}
                            role="group"
                            aria-label={`${s.board?.name} page ${p.page + 1} tiles, ${s.rows} rows, ${s.cols} columns`}
                            style={{
                                gridTemplateColumns: `repeat(${s.cols}, minmax(0, 1fr))`,
                                gridTemplateRows: `repeat(${s.rows}, minmax(0, 1fr))`,
                                touchAction: "pan-x pan-y"
                            }}
                        >
                            {p.cells.map(c => (
                                <TileButton
                                    key={c.key}
                                    tile={c.tile}
                                    hidden={!!c.placement?.hidden}
                                    editing={edit.state.isEditMode}
                                    moving={
                                        s.moving === c.key &&
                                        s.movingPage === p.page
                                    }
                                    color={
                                        s.boards[
                                            c.tile?.categoryId ?? ""
                                        ]?.colorKey ?? "slate"
                                    }
                                    appearance={s.appearance}
                                    onEdit={() => a.open(c.key, p.page)}
                                    onMove={
                                        s.moving &&
                                        s.movingPage === p.page &&
                                        edit.state.isEditMode
                                            ? () => a.moveTo(c.key, p.page)
                                            : undefined
                                    }
                                />
                            ))}
                        </div>
                    </section>
                ))}
            </div>

            <div className="board-page-indicator" aria-live="polite">
                Page {s.page + 1} / {s.pageCount}
            </div>

            {s.moving && (
                <p role="status">
                    Choose a destination slot on page {s.movingPage + 1} · Escape to cancel
                </p>
            )}

            {s.overflow > 0 && edit.state.isEditMode && (
                <p>
                    {s.overflow} tiles outside this layout. Enlarge in Settings or{" "}
                    <button onClick={a.reflow}>Reflow</button>
                </p>
            )}

            {s.target && !s.editor && edit.state.isEditMode && (
                <TileActionMenu
                    label={s.targetTile?.label ?? "Tile"}
                    hidden={!!s.placement?.hidden}
                    onClose={a.close}
                    onEdit={() => a.setEditor("edit")}
                    onReplace={() => a.setEditor("replace")}
                    onMove={a.startMove}
                    onHide={a.toggleHidden}
                    onRemove={a.remove}
                />
            )}

            {s.target && s.editor && edit.state.isEditMode && (
                <TileEditor
                    boardId={boardId}
                    page={s.targetPage}
                    cell={s.target}
                    tile={s.editor === "edit" ? s.targetTile : undefined}
                    onClose={a.close}
                />
            )}
        </>
    );
}
