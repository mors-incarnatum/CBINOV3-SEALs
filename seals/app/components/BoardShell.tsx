"use client";
import Link from "next/link";
import { useBoardShellViewModel, SentenceContext } from "@/viewmodels/useBoardShellViewModel";
import { EditContext } from "@/viewmodels/useEditModeViewModel";
import SentenceStrip from "./SentenceStrip";
import BoardSettings from "./BoardSettings";
import CatalogManager from "./CatalogManager";
import CategoryWheel from "./CategoryWheel";
import Modal from "./Modal";
export default function BoardShell({ children }: {
    children: React.ReactNode;
}) {
    const vm = useBoardShellViewModel();
    return <SentenceContext.Provider value={vm.sentence}><EditContext.Provider value={vm.edit}>
  <div className="board-shell"><header className="board-header"><Link href="/board" className="brand"><b>W</b> WiKahon</Link><SentenceStrip /><div className="header-tools"><label className="volume-control">Volume<input aria-label="Volume" type="range" min="0" max="1" step="0.1" value={vm.sentence.state.volume} onChange={e => vm.sentence.actions.setVolume(Number(e.target.value))}/></label><button aria-pressed={vm.edit.state.isEditMode} onClick={vm.edit.actions.toggle}>✎ {vm.edit.state.isEditMode ? "Done editing" : "Edit"}</button><button onClick={() => vm.actions.setPanel("catalogs")}>Catalogs</button><button onClick={() => vm.actions.setPanel("settings")}>⚙ Settings</button></div></header>
  {vm.edit.state.isEditMode && <p className="edit-notice" role="status">Edit mode · Select a tile to customize, move, or hide it. Select an empty slot to add a word or folder.</p>}
  <main className="board-main" aria-label="Communication board. Right-click or press Shift F10 for catalogs." tabIndex={0} onContextMenu={vm.actions.onContextMenu} onKeyDown={vm.actions.onKeyDown}>{children}</main>
  <button className="board-layout-control" aria-label="Configure board layout" title="Configure board layout" onClick={() => vm.actions.setPanel("layout")}>
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="6" y="6" width="5" height="5" rx="1"/><rect x="13" y="6" width="5" height="5" rx="1"/><rect x="6" y="13" width="5" height="5" rx="1"/><rect x="13" y="13" width="5" height="5" rx="1"/></svg>
  </button>
  {vm.state.wheel && <CategoryWheel coords={vm.state.wheel} onClose={vm.actions.closeWheel} onManage={vm.actions.openCatalogs}/>}
  {vm.state.panel === "settings" && <BoardSettings boardId={vm.state.boardId} onClose={() => vm.actions.setPanel(null)}/>}
  {vm.state.panel === "layout" && <BoardSettings boardId={vm.state.boardId} onClose={() => vm.actions.setPanel(null)} initialTab="layout"/>}
  {vm.state.panel === "catalogs" && <CatalogManager onClose={() => vm.actions.setPanel(null)}/>}
  {vm.edit.state.pinDialog && <Modal label="Unlock edit mode" onClose={vm.edit.actions.closePin} className="editor-modal small-modal"><h2>Unlock edit mode</h2><label>PIN<input type="password" inputMode="numeric" value={vm.edit.state.pin} onChange={e => vm.edit.actions.setPin(e.target.value)}/></label><p role="alert">{vm.edit.state.error}</p><button onClick={vm.edit.actions.unlock}>Unlock</button><button onClick={vm.edit.actions.closePin}>Cancel</button></Modal>}
  </div>
 </EditContext.Provider></SentenceContext.Provider>;
}
