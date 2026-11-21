"use client";
import Link from "next/link";
import { resolveTileColor } from "@/lib/board";
import { palette } from "@/app/theme";
import { useBoardShellViewModel, SentenceContext } from "@/viewmodels/useBoardShellViewModel";
import { EditContext } from "@/viewmodels/useEditModeViewModel";
import SentenceStrip from "./SentenceStrip";
import BoardSettings from "./BoardSettings";
import CatalogManager from "./CatalogManager";
import CategoryWheel from "./CategoryWheel";
import ScribblePracticeModal from "./ScribblePracticeModal";
import ParentChatModal from "./ParentChatModal";
import LoginView from "./LoginView";
import Modal from "./Modal";

export default function BoardShell({ children }: { children: React.ReactNode }) {
    const vm = useBoardShellViewModel();

    if (!vm.state.currentUser) {
        return <LoginView />;
    }

    return (
        <SentenceContext.Provider value={vm.sentence}>
            <EditContext.Provider value={vm.edit}>
                <div
                    className="board-shell"
                    onPointerDown={vm.edit.actions.touchActivity}
                    onKeyDown={vm.edit.actions.touchActivity}
                >
                    <header className="board-header">
                        <Link href="/board" className="brand" onClick={() => vm.actions.setPanel(null)}>
                            <b>W</b> WiKahon
                        </Link>
                        <SentenceStrip />
                        <div className="header-tools">
                            {vm.state.isGuardian ? (
                                <>
                                    <span
                                        className="profile-badge"
                                        aria-label={`Signed in guardian: ${vm.state.currentUser.name}`}
                                    >
                                        🔑 {vm.state.currentUser.name}
                                    </span>
                                    <label className="volume-control">
                                        Volume
                                        <input
                                            aria-label="Volume"
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.1"
                                            value={vm.sentence.state.volume}
                                            onChange={e => vm.sentence.actions.setVolume(Number(e.target.value))}
                                        />
                                    </label>
                                </>
                            ) : (
                                <span
                                    className="profile-badge"
                                    aria-label={`Signed in child: ${vm.state.currentUser.name}`}
                                >
                                    👶 {vm.state.currentUser.name}
                                </span>
                            )}
                            {vm.state.featureFlags?.scribblePractice && (
                                <button
                                    type="button"
                                    aria-pressed={vm.state.isScribbleOpen}
                                    onClick={vm.actions.toggleScribble}
                                >
                                    ✍ Scribble
                                </button>
                            )}
                            {vm.state.featureFlags?.parentChildChat && (
                                <button
                                    type="button"
                                    aria-pressed={vm.state.isChatOpen}
                                    onClick={vm.actions.toggleChat}
                                >
                                    💬 Chat
                                </button>
                            )}
                            {vm.state.isGuardian && (
                                <>
                                    <button
                                        type="button"
                                        aria-pressed={vm.edit.state.isEditMode}
                                        onClick={vm.edit.actions.toggle}
                                    >
                                        ✎ {vm.edit.state.isEditMode ? "Done editing" : "Edit"}
                                    </button>
                                    <button type="button" onClick={() => vm.actions.setPanel("catalogs")}>
                                        Catalogs
                                    </button>
                                    <button type="button" onClick={() => vm.actions.setPanel("settings")}>
                                        ⚙ Settings
                                    </button>
                                </>
                            )}
                            <button type="button" onClick={vm.actions.logout}>
                                Log out
                            </button>
                        </div>
                    </header>

                    {vm.state.storageError && (
                        <div className="edit-notice" role="alert">
                            <span>{vm.state.storageError}</span>{" "}
                            {vm.state.isGuardian && (
                                <>
                                    <button type="button" onClick={() => vm.actions.setPanel("settings")}>
                                        Open backup &amp; settings
                                    </button>{" "}
                                </>
                            )}
                            <button type="button" onClick={vm.actions.clearStorageError}>
                                Dismiss
                            </button>
                        </div>
                    )}

                    {vm.state.isGuardian && vm.edit.state.isEditMode && (
                        <p className="edit-notice" role="status">
                            Edit mode · Select a tile to customize, move, or hide it. Select an empty slot to add a word or folder.
                        </p>
                    )}

                    {vm.state.featureFlags?.pinnedVocabulary && vm.state.pinnedTiles.length > 0 && (
                        <nav
                            className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 bg-white border border-slate-300 rounded-md shrink-0"
                            aria-label="Pinned core vocabulary"
                        >
                            <span className="text-xs font-semibold text-slate-600 mr-1">Pinned:</span>
                            {vm.state.pinnedTiles.map(tile => {
                                const color = resolveTileColor(
                                    tile,
                                    vm.state.boards,
                                    vm.state.tileAppearance.colorMode,
                                );
                                return (
                                    <button
                                        key={tile.id}
                                        type="button"
                                        style={palette[color]}
                                        className="px-2.5 py-1 text-xs font-semibold border rounded-md"
                                        onClick={() => vm.sentence.actions.onTileActivate(tile)}
                                    >
                                        {tile.label}
                                    </button>
                                );
                            })}
                        </nav>
                    )}

                    <main
                        className={vm.state.isChatOpen || vm.state.isScribbleOpen ? "board-main !pb-0" : "board-main"}
                        aria-label={
                            vm.state.isChatOpen
                                ? "Parent-child chat."
                                : vm.state.isScribbleOpen
                                  ? "Scribble handwriting practice."
                                  : vm.state.wheelEnabled
                                    ? "Communication board. Right-click or press Shift F10 for catalogs."
                                    : "Communication board."
                        }
                        tabIndex={0}
                        onContextMenu={vm.actions.onContextMenu}
                        onKeyDown={vm.actions.onKeyDown}
                    >
                        {vm.state.isChatOpen ? (
                            <ParentChatModal onClose={() => vm.actions.setPanel(null)} />
                        ) : vm.state.isScribbleOpen ? (
                            <ScribblePracticeModal onClose={() => vm.actions.setPanel(null)} />
                        ) : (
                            children
                        )}
                    </main>

                    {vm.state.isGuardian && !vm.state.isChatOpen && !vm.state.isScribbleOpen && (
                        <button
                            type="button"
                            className="board-layout-control"
                            aria-label="Configure board layout"
                            title="Configure board layout"
                            onClick={() => vm.actions.setPanel("layout")}
                        >
                            <svg
                                viewBox="0 0 24 24"
                                width="22"
                                height="22"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <rect x="6" y="6" width="5" height="5" rx="1" />
                                <rect x="13" y="6" width="5" height="5" rx="1" />
                                <rect x="6" y="13" width="5" height="5" rx="1" />
                                <rect x="13" y="13" width="5" height="5" rx="1" />
                            </svg>
                        </button>
                    )}

                    {vm.state.wheelEnabled && vm.state.wheel && (
                        <CategoryWheel
                            coords={vm.state.wheel}
                            onClose={vm.actions.closeWheel}
                            onManage={vm.actions.openCatalogs}
                        />
                    )}
                    {vm.state.isGuardian && vm.state.panel === "settings" && (
                        <BoardSettings boardId={vm.state.boardId} onClose={() => vm.actions.setPanel(null)} />
                    )}
                    {vm.state.isGuardian && vm.state.panel === "layout" && (
                        <BoardSettings
                            boardId={vm.state.boardId}
                            onClose={() => vm.actions.setPanel(null)}
                            initialTab="layout"
                        />
                    )}
                    {vm.state.isGuardian && vm.state.panel === "catalogs" && (
                        <CatalogManager onClose={() => vm.actions.setPanel(null)} />
                    )}
                    {vm.state.isGuardian && vm.edit.state.pinDialog && (
                        <Modal
                            label="Unlock edit mode"
                            onClose={vm.edit.actions.closePin}
                            className="editor-modal small-modal"
                        >
                            <h2>Unlock edit mode</h2>
                            <label>
                                PIN
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    value={vm.edit.state.pin}
                                    onChange={e => vm.edit.actions.setPin(e.target.value)}
                                />
                            </label>
                            <p role="alert">{vm.edit.state.error}</p>
                            <button type="button" onClick={() => void vm.edit.actions.unlock()}>
                                Unlock
                            </button>
                            <button type="button" onClick={vm.edit.actions.closePin}>
                                Cancel
                            </button>
                        </Modal>
                    )}
                </div>
            </EditContext.Provider>
        </SentenceContext.Provider>
    );
}
