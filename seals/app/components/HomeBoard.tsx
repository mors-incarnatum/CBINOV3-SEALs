"use client";
import { useState } from "react";
import { CATEGORY_IDS } from "@/lib/board";
import { useBoardStore } from "@/store/BoardProvider";
import CategoryBanner from "./CategoryBanner";
import EditableTileSlot from "./EditableTileSlot";
import WordPicker from "./WordPicker";
export default function HomeBoard() {
  const slots = useBoardStore(state => state.homeGrid);
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  return <>
    <div className="grid grid-cols-4 gap-3 shrink-0 mb-2">{CATEGORY_IDS.map(id => <CategoryBanner key={id} categoryId={id} />)}</div>
    <div className="board-page-enter grid grid-cols-4 grid-rows-5 gap-x-3 gap-y-2 flex-1 min-h-[540px]" onKeyDown={event => { if (event.key === "Escape") setEditing(null); }}>
      {slots.map(slot => <EditableTileSlot key={slot.slotIndex} slot={slot} editing={editing === slot.slotIndex} onEdit={() => setEditing(slot.slotIndex)} onDone={() => setEditing(null)} onAdd={() => { setEditing(null); setAdding(slot.slotIndex); }} />)}
    </div>
    {adding !== null && <WordPicker slotIndex={adding} onClose={() => setAdding(null)} />}
  </>;
}
