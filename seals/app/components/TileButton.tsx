"use client";
/* Animated local symbols intentionally use img to preserve GIF playback when explicitly enabled. */
/* eslint-disable @next/next/no-img-element */
import { resolveTileColor, type Tile, type ColorKey, type CatalogBoard } from "@/lib/board";
import { palette } from "@/app/theme";
import type { BoardData } from "@/store/useBoardStore";
import { useTileInteractionViewModel } from "@/viewmodels/useTileInteractionViewModel";
import { useMediaUrl } from "@/viewmodels/useMediaUrl";

export function TileVisual({
    tile,
    color = "slate",
    appearance,
}: {
    tile: Tile;
    color?: ColorKey;
    appearance?: BoardData["tileAppearance"];
}) {
    const { src, missingMedia } = useMediaUrl(tile.iconName, tile.mediaId);
    return (
        <span
            className={`tile-content label-${appearance?.labelPosition ?? "bottom"} font-${appearance?.fontScale ?? "md"} icon-${appearance?.iconScale ?? "md"}`}
            style={palette[color]}
        >
            {tile.kind === "folder" && (
                <span className="folder-badge" aria-hidden="true">
                    ▰
                </span>
            )}
            {appearance?.showIcons !== false && tile.iconName === "speech" && !tile.mediaId && (
                <span aria-hidden="true" className="speech-symbol">
                    💬
                </span>
            )}
            {appearance?.showIcons !== false && src && <img src={src} alt="" draggable={false} />}
            <span className={`tile-label ${!src || appearance?.showIcons === false ? "text-only" : ""}`}>
                {tile.label}
                {missingMedia && <span className="sr-only"> (photo unavailable)</span>}
            </span>
        </span>
    );
}

export default function TileButton({
    tile,
    hidden,
    editing,
    moving,
    color,
    boards,
    appearance,
    onEdit,
    onMove,
}: {
    tile?: Tile;
    hidden: boolean;
    editing: boolean;
    moving: boolean;
    color: ColorKey;
    boards?: Record<string, Pick<CatalogBoard, "colorKey">>;
    appearance: BoardData["tileAppearance"];
    onEdit: () => void;
    onMove?: () => void;
}) {
    const events = useTileInteractionViewModel(tile, hidden, onEdit, onMove);
    const actualColor = boards
        ? resolveTileColor(tile, boards, appearance.colorMode)
        : appearance.colorMode === "neutral"
          ? "slate"
          : tile?.colorKey ?? color;

    return (
        <button
            type="button"
            {...events}
            className={`aac-tile ${hidden ? "hidden-tile" : ""} ${moving ? "moving-tile" : ""}`}
            aria-label={
                hidden && !editing
                    ? "Empty slot"
                    : tile
                      ? `${tile.kind === "folder" ? "Open folder: " : ""}${tile.label}${hidden ? " (hidden)" : ""}${editing ? ", edit tile" : ""}`
                      : editing
                        ? "Add tile"
                        : "Empty slot"
            }
            aria-disabled={(!tile || hidden) && !editing && !onMove}
        >
            {tile && (!hidden || editing) ? (
                <TileVisual tile={tile} color={actualColor} appearance={appearance} />
            ) : (
                <span aria-hidden="true" className="empty-slot">
                    {editing || onMove ? "+" : ""}
                </span>
            )}
        </button>
    );
}
