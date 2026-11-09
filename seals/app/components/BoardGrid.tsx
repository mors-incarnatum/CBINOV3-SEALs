"use client";
import { useBoardGridViewModel } from "@/viewmodels/useBoardGridViewModel";
import { useEditContext } from "@/viewmodels/useEditModeViewModel";
import TileButton from "./TileButton";
import TileActionMenu from "./TileActionMenu";
import TileEditor from "./TileEditor";
export default function BoardGrid({ boardId }: {
    boardId: string;
}) {
    const { state: s, actions: a } = useBoardGridViewModel(boardId), edit = useEditContext();
    return <><div className={`board-grid gap-${s.appearance.gridGap}`} role="group" aria-label={`${s.board?.name} tiles, ${s.rows} rows, ${s.cols} columns`} style={{ gridTemplateColumns: `repeat(${s.cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${s.rows}, minmax(0, 1fr))`, touchAction: "pan-y" }} onTouchStart={a.onTouchStart} onTouchEnd={a.onTouchEnd} onKeyDown={a.onKeyDown}>
  {s.cells.map(c => <TileButton key={c.key} tile={c.tile} hidden={!!c.placement?.hidden} editing={edit.state.isEditMode} moving={s.moving === c.key} color={s.boards[c.tile?.categoryId ?? ""]?.colorKey ?? "slate"} appearance={s.appearance} onEdit={() => a.open(c.key)} onMove={s.moving && edit.state.isEditMode ? () => a.moveTo(c.key) : undefined}/>)}
 </div><nav className="board-pagination" aria-label="Board pages"><button disabled={s.page === 0} onClick={() => a.changePage(s.page - 1)}>← Previous</button><span>Page {s.page + 1} / {s.pageCount}</span><button disabled={s.page + 1 >= s.pageCount} onClick={() => a.changePage(s.page + 1)}>Next →</button>{s.moving && <span role="status">Choose a destination slot · Escape to cancel</span>}{s.overflow > 0 && edit.state.isEditMode && <span>{s.overflow} tiles outside this layout. Enlarge in Settings or <button onClick={a.reflow}>Reflow</button></span>}</nav>
 {s.target && !s.editor && edit.state.isEditMode && <TileActionMenu label={s.targetTile?.label ?? "Tile"} hidden={!!s.placement?.hidden} onClose={a.close} onEdit={() => a.setEditor("edit")} onReplace={() => a.setEditor("replace")} onMove={a.startMove} onHide={a.toggleHidden} onRemove={a.remove}/>}
 {s.target && s.editor && edit.state.isEditMode && <TileEditor boardId={boardId} page={s.page} cell={s.target} tile={s.editor === "edit" ? s.targetTile : undefined} onClose={a.close}/>}
 </>;
}
