"use client";
import Link from "next/link";
import { useCategoryBoardViewModel } from "@/viewmodels/useCategoryBoardViewModel";
import { useEditContext } from "@/viewmodels/useEditModeViewModel";
import BoardGrid from "./BoardGrid";
import CatalogManager from "./CatalogManager";
import TileEditor from "./TileEditor";
export default function CategoryBoard({ categoryId }: {
    categoryId: string;
}) {
    const { state: s, actions: a } = useCategoryBoardViewModel(categoryId), edit = useEditContext();
    if (!s.board)
        return <section role="status"><h2>Catalog not found</h2><p>This catalog may have been deleted or belongs to another device.</p><Link href="/board">← Home</Link></section>;
    return <><div className="catalog-toolbar"><Link href="/board">← Home</Link><h2>{s.board.name}</h2>{edit.state.isEditMode && <><button onClick={() => a.setPanel("add")}>+ Add words</button><button onClick={() => a.setPanel("manage")}>Manage catalogs</button></>}</div><BoardGrid boardId={categoryId}/>{s.panel === "add" && edit.state.isEditMode && <TileEditor boardId={categoryId} multi onClose={() => a.setPanel(null)}/>}{s.panel === "manage" && <CatalogManager onClose={() => a.setPanel(null)}/>}</>;
}
