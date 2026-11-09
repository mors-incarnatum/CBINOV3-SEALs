"use client";
import { useState } from "react";
import { useBoardStore } from "@/store/BoardProvider";
import type { ColorKey } from "@/lib/board";
export function useCatalogManagerViewModel() {
    const boards = useBoardStore(s => s.boards), order = useBoardStore(s => s.catalogOrder), create = useBoardStore(s => s.createCatalog), update = useBoardStore(s => s.updateCatalog), remove = useBoardStore(s => s.deleteCatalog), reorder = useBoardStore(s => s.reorderCatalog), folder = useBoardStore(s => s.placeFolderOnHome);
    const [selected, setSelected] = useState<string | null>(null), [name, setName] = useState(""), [shortName, setShortName] = useState(""), [colorKey, setColor] = useState<ColorKey>("teal"), [iconName, setIcon] = useState<string | null>(null), [placeOnHome, setPlace] = useState(true), [confirmDelete, setDelete] = useState<string | null>(null), [adding, setAdding] = useState<string | null>(null), [message, setMessage] = useState("");
    const reset = () => { setSelected(null); setName(""); setShortName(""); setColor("teal"); setIcon(null); };
    return { state: { catalogs: order.map(id => boards[id]).filter(Boolean), selected, name, shortName, colorKey, iconName, placeOnHome, confirmDelete, adding, message }, actions: { setName, setShortName, setColor, setIcon, setPlace, setDelete, setAdding, reset, select: (id: string) => { const b = boards[id]; setSelected(id); setName(b.name); setShortName(b.shortName); setColor(b.colorKey); setIcon(b.iconName); }, save: () => { if (!name.trim())
                return; if (selected)
                update(selected, { name: name.trim(), shortName: shortName.trim() || name.trim(), colorKey, iconName });
            else
                create({ name, shortName, colorKey, iconName, placeFolderOnHome: placeOnHome }); setMessage("Catalog saved"); reset(); }, deleteConfirmed: () => { if (confirmDelete)
                remove(confirmDelete); setDelete(null); reset(); }, reorder, placeFolder: (id: string) => { folder(id); setMessage("Folder placed on Home"); } } };
}
