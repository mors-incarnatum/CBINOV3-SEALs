"use client";
import { useCategoryWheelViewModel } from "@/viewmodels/useCategoryWheelViewModel";
import { palette } from "@/app/theme";
import Modal from "./Modal";
export default function CategoryWheel({ coords, onClose, onManage }: {
    coords: {
        x: number;
        y: number;
    };
    onClose: () => void;
    onManage: () => void;
}) {
    const { state: s, actions: a } = useCategoryWheelViewModel(onClose);
    return <Modal label="Choose catalog" onClose={onClose} className="category-wheel border-0 p-0 bg-transparent overflow-visible" style={{ position: "fixed", margin: 0, left: `clamp(8px, ${coords.x - 150}px, calc(100vw - 308px))`, top: `clamp(8px, ${coords.y - 150}px, calc(100dvh - 308px))`, width: "min(300px, calc(100vw - 16px), calc(100dvh - 16px))" }}>
 {s.more ? <div className="editor-modal"><h2>All catalogs</h2>{s.catalogs.map(b => <button key={b.id} onClick={() => a.choose(b.id)}>{b.name}</button>)}<button onClick={onManage}>Manage catalogs</button><button onClick={onClose}>Close</button></div> : <><svg viewBox="0 0 300 300" aria-label="Catalog wheel"><circle cx="150" cy="150" r="147" fill="white"/>{s.sectors.map((sector, i) => <g key={sector.id} role="button" tabIndex={0} aria-label={sector.board ? `Open ${sector.board.name}` : "More catalogs"} className="wheel-sector" onClick={() => a.choose(sector.id)} onKeyDown={e => a.onKeyDown(e, i)}><path d={sector.path} fill={palette[sector.board?.colorKey ?? "slate"].background} stroke={palette[sector.board?.colorKey ?? "slate"].borderColor} className="wheel-sector-shape"/><text x={sector.x} y={sector.y} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill={palette[sector.board?.colorKey ?? "slate"].color}>{sector.board?.shortName || "More…"}</text></g>)}</svg><button className="wheel-center absolute inset-0 m-auto h-[36%] w-[36%] rounded-full bg-white text-sm font-bold" onClick={onManage}>+ Catalog</button><button className="wheel-close" onClick={onClose} aria-label="Close catalog wheel">✕</button></>}
 </Modal>;
}
