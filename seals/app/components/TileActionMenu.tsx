"use client";
import Modal from "./Modal";
export default function TileActionMenu({ label, hidden, onClose, onEdit, onReplace, onMove, onHide, onRemove }: {
    label: string;
    hidden: boolean;
    onClose: () => void;
    onEdit: () => void;
    onReplace: () => void;
    onMove: () => void;
    onHide: () => void;
    onRemove: () => void;
}) {
    return <Modal label={`Actions for ${label}`} onClose={onClose} className="editor-modal small-modal"><h2>{label}</h2><div className="action-list"><button onClick={onEdit}>Edit Tile</button><button onClick={onReplace}>Replace</button><button onClick={onMove}>Move / Swap</button><button onClick={onHide}>{hidden ? "Unhide" : "Hide"}</button><button className="danger" onClick={onRemove}>Remove from board</button><button onClick={onClose}>Cancel</button></div></Modal>;
}
