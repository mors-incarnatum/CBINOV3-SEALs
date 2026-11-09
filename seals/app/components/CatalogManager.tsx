"use client";
import Link from "next/link";
import { ICONS, type ColorKey } from "@/lib/board";
import { palette } from "@/app/theme";
import { useCatalogManagerViewModel } from "@/viewmodels/useCatalogManagerViewModel";
import { useEditContext } from "@/viewmodels/useEditModeViewModel";
import Modal from "./Modal";
import TileEditor from "./TileEditor";
export default function CatalogManager({ onClose }: {
    onClose: () => void;
}) {
    const { state: s, actions: a } = useCatalogManagerViewModel(), edit = useEditContext();
    return <Modal label="Catalogs" onClose={onClose} className="editor-modal"><div className="modal-heading"><h2>Catalogs</h2><button onClick={onClose} aria-label="Close catalogs">✕</button></div>{!edit.state.isEditMode && <p>Enable <button onClick={edit.actions.enter}>Edit mode</button> to manage catalogs.</p>}<div className="catalog-list">{s.catalogs.map(b => <div key={b.id} className="catalog-card" style={palette[b.colorKey]}><Link href={`/board/${b.id}`} onClick={onClose}>▰ {b.name}</Link>{edit.state.isEditMode && <div className="filter-pills"><button onClick={() => a.select(b.id)}>Rename / Recolor</button><button onClick={() => a.setAdding(b.id)}>Add words</button><button onClick={() => a.placeFolder(b.id)}>Place folder on Home</button><button aria-label={`Move ${b.name} earlier`} onClick={() => a.reorder(b.id, -1)}>↑</button><button aria-label={`Move ${b.name} later`} onClick={() => a.reorder(b.id, 1)}>↓</button>{!b.isBuiltIn && <button className="danger" onClick={() => a.setDelete(b.id)}>Delete</button>}</div>}</div>)}</div><p role="status">{s.message}</p><fieldset disabled={!edit.state.isEditMode}><legend>{s.selected ? "Edit catalog" : "Create catalog"}</legend><label>Name<input value={s.name} onChange={e => a.setName(e.target.value)}/></label><label>Short wheel label<input value={s.shortName} onChange={e => a.setShortName(e.target.value)}/></label><label>Color<select value={s.colorKey} onChange={e => a.setColor(e.target.value as ColorKey)}>{Object.keys(palette).map(c => <option key={c}>{c}</option>)}</select></label><label>Icon<select value={s.iconName ?? ""} onChange={e => a.setIcon(e.target.value || null)}><option value="">Folder / text only</option>{ICONS.map(i => <option key={i.name} value={i.name}>{i.label}</option>)}</select></label>{!s.selected && <label><input type="checkbox" checked={s.placeOnHome} onChange={e => a.setPlace(e.target.checked)}/> Also place folder on Home</label>}<button className="primary" disabled={!s.name.trim()} onClick={a.save}>Save catalog</button>{s.selected && <button onClick={a.reset}>Create another catalog</button>}</fieldset>
 {s.confirmDelete && <Modal label="Delete catalog" onClose={() => a.setDelete(null)} className="editor-modal small-modal"><h2>Delete this catalog?</h2><p>Folder links will be removed. Words remain in the library.</p><button className="danger" onClick={a.deleteConfirmed}>Delete catalog</button><button onClick={() => a.setDelete(null)}>Cancel</button></Modal>}
 {s.adding && edit.state.isEditMode && <TileEditor boardId={s.adding} multi onClose={() => a.setAdding(null)}/>}</Modal>;
}
