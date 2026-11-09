"use client";
/* Animated local symbols intentionally use img to preserve GIF playback offline. */
/* eslint-disable @next/next/no-img-element */
import { iconPath, type Tile, type ColorKey, WORD_COLORS } from "@/lib/board";
import { palette } from "@/app/theme";
import type { BoardData } from "@/store/useBoardStore";
import { useTileInteractionViewModel } from "@/viewmodels/useTileInteractionViewModel";
export function TileVisual({ tile, color = "slate", appearance }: {
    tile: Tile;
    color?: ColorKey;
    appearance?: BoardData["tileAppearance"];
}) {
    const src = iconPath(tile.iconName);
    return <span className={`tile-content label-${appearance?.labelPosition ?? "bottom"} font-${appearance?.fontScale ?? "md"} icon-${appearance?.iconScale ?? "md"}`} style={palette[color]}>
  {tile.kind === "folder" && <span className="folder-badge" aria-hidden="true">▰</span>}
  {appearance?.showIcons !== false && tile.iconName === "speech" && <span aria-hidden="true" className="speech-symbol">💬</span>}
  {appearance?.showIcons !== false && src && <img src={src} alt="" draggable={false}/>}
  <span className={`tile-label ${!src || appearance?.showIcons === false ? "text-only" : ""}`}>{tile.label}</span>
 </span>;
}
export default function TileButton({ tile, hidden, editing, moving, color, appearance, onEdit, onMove }: {
    tile?: Tile;
    hidden: boolean;
    editing: boolean;
    moving: boolean;
    color: ColorKey;
    appearance: BoardData["tileAppearance"];
    onEdit: () => void;
    onMove?: () => void;
}) {
    const events = useTileInteractionViewModel(tile, hidden, onEdit, onMove);
    const actualColor = appearance.colorMode === "wordClass" && tile?.wordClass ? WORD_COLORS[tile.wordClass] : tile?.colorKey ?? color;
    return <button type="button" {...events} className={`aac-tile ${hidden ? "hidden-tile" : ""} ${moving ? "moving-tile" : ""}`} aria-label={hidden && !editing ? "Empty slot" : tile ? `${tile.kind === "folder" ? "Open folder: " : ""}${tile.label}${hidden ? " (hidden)" : ""}${editing ? ", edit tile" : ""}` : editing ? "Add tile" : "Empty slot"} aria-disabled={(!tile || hidden) && !editing && !onMove}>
 {tile && (!hidden || editing) ? <TileVisual tile={tile} color={actualColor} appearance={appearance}/> : <span aria-hidden="true" className="empty-slot">{editing || onMove ? "+" : ""}</span>}
 </button>;
}
