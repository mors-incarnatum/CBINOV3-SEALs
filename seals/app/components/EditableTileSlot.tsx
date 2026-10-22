"use client";
import { useEffect, useRef } from "react";
import { CATEGORIES, iconPath, type GridSlot } from "@/lib/board";
import { useBoardStore } from "@/store/BoardProvider";
import { useBoardSpeech } from "./BoardShell";
import TileButton from "./TileButton";
export default function EditableTileSlot({ slot, editing, onEdit, onDone, onAdd }: { slot: GridSlot; editing: boolean; onEdit: () => void; onDone: () => void; onAdd: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const origin = useRef({ x: 0, y: 0 });
  const placeTile = useBoardStore(state => state.placeTile);
  const speak = useBoardSpeech();
  const clearTimer = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const tile = slot.tile;
  if (!tile) return <div className="bg-gray-100 border border-gray-300 flex items-center justify-center"><button type="button" aria-label={`Add word to slot ${slot.slotIndex + 1}`} onClick={onAdd} className="w-10 h-10 rounded-full bg-white border border-gray-300 text-gray-700 text-2xl focus:ring-2 focus:ring-sky-600">+</button></div>;
  return <div className="relative flex min-h-0">
    <TileButton id={tile.id} label={tile.label} gifPath={iconPath(tile.iconName)} category={CATEGORIES[tile.categoryId].label} editing={editing}
      onPress={word => { if (held.current) { held.current = false; return; } if (editing) { onDone(); return; } onDone(); speak(word); }}
      buttonProps={{
        "aria-label": `${tile.label}. Hold to edit, or press F2.`,
        onPointerDown: event => { if (event.button !== 0) return; clearTimer(); held.current = false; origin.current = { x: event.clientX, y: event.clientY }; timer.current = setTimeout(() => { held.current = true; onEdit(); }, 500); },
        onPointerUp: clearTimer, onPointerLeave: clearTimer, onPointerCancel: clearTimer,
        onPointerMove: event => { if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 10) clearTimer(); },
        onKeyDown: event => { if (event.key === "F2") { event.preventDefault(); onEdit(); } },
      }} />
    {editing && <button type="button" aria-label={`Remove ${tile.label} from home`} onClick={() => { placeTile(slot.slotIndex, null); onDone(); }} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-100 border border-red-500 text-red-600 flex items-center justify-center">−</button>}
  </div>;
}
