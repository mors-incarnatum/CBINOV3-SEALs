"use client";
import Modal from "./Modal";

export default function TileActionMenu({
    label,
    hidden,
    canPin,
    pinned,
    onClose,
    onEdit,
    onReplace,
    onMove,
    onHide,
    onTogglePin,
    onRemove,
}: {
    label: string;
    hidden: boolean;
    canPin?: boolean;
    pinned?: boolean;
    onClose: () => void;
    onEdit: () => void;
    onReplace: () => void;
    onMove: () => void;
    onHide: () => void;
    onTogglePin?: () => void;
    onRemove: () => void;
}) {
    return (
        <Modal label={`Actions for ${label}`} onClose={onClose} className="editor-modal small-modal">
            <h2>{label}</h2>
            <div className="action-list">
                <button onClick={onEdit}>Edit Tile</button>
                <button onClick={onReplace}>Replace</button>
                <button onClick={onMove}>Move / Swap</button>
                <button onClick={onHide}>{hidden ? "Unhide" : "Hide"}</button>
                {canPin && onTogglePin && (
                    <button onClick={onTogglePin}>{pinned ? "Unpin word" : "Pin word"}</button>
                )}
                <button className="danger" onClick={onRemove}>
                    Remove from board
                </button>
                <button onClick={onClose}>Cancel</button>
            </div>
        </Modal>
    );
}
