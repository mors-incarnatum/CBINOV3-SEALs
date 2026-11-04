"use client";
import { useState } from "react";
import { CATEGORIES, CATEGORY_IDS, ICONS, type CategoryId } from "@/lib/board";
import { useBoardStore } from "@/store/BoardProvider";
import Modal from "./Modal";
export default function WordPicker({ slotIndex = null, category: fixedCategory, categorySlotIndex = null, onCreated, onClose }: { slotIndex?: number | null; category?: CategoryId; categorySlotIndex?: number | null; onCreated?: () => void; onClose: () => void }) {
  
  const dictionary = useBoardStore(state => state.dictionary);
  const placeTile = useBoardStore(state => state.placeTile);
  const addCustomWord = useBoardStore(state => state.addCustomWord);
  const placeCategoryWord = useBoardStore(state => state.placeCategoryWord);
  const addCustomCategoryWord = useBoardStore(state => state.addCustomCategoryWord);

  const [categoryId, setCategoryId] = useState<CategoryId>(fixedCategory ?? "needs");
  const [mode, setMode] = useState<"existing" | "custom">(fixedCategory ? "custom" : "existing");
  const [label, setLabel] = useState("");
  const [iconName, setIconName] = useState("default");

  const activeCategory = fixedCategory ?? categoryId;
  const availableWords = dictionary[activeCategory].filter(tile => tile !== null);
  
  const title = fixedCategory
  ? `Add word to ${CATEGORIES[fixedCategory].wheel}`
  : "Customize home slot";

  return <Modal label={title} onClose={onClose} className="board-modal m-auto w-[min(600px,calc(100vw-24px))] max-h-[85dvh] overflow-auto bg-white p-6 text-slate-900 border border-slate-300 shadow-xl">
    <div className="flex items-center justify-between gap-4 mb-5"><h2 className="text-xl font-bold">{title}</h2><button type="button" onClick={onClose} aria-label="Close customization" className="border px-3 py-1">×</button></div>
    <div className="flex gap-2 mb-4">{(["existing", "custom"] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} className={`border p-2 transition-colors ${mode === value ? "bg-sky-100 border-sky-700" : "border-slate-300"}`} onClick={() => setMode(value)}>{value === "existing" ? "Pick existing word" : "Add custom word"}</button>)}</div>
    {!fixedCategory && <label className="block mb-4">Category<select className="block w-full border border-slate-400 p-2 mt-1" value={categoryId} onChange={event => setCategoryId(event.target.value as CategoryId)}>{CATEGORY_IDS.map(id => <option key={id} value={id}>{CATEGORIES[id].label}</option>)}</select></label>}
    {mode === "existing" ? (
      <div className="grid grid-cols-2 gap-2">
        {availableWords.map(tile => (
          <button
            key={tile.id}
            type="button"
            className="border p-3 font-semibold"
            style={{
              background: CATEGORIES[activeCategory].fill,
              color: CATEGORIES[activeCategory].color,
              borderColor: CATEGORIES[activeCategory].color,
            }}
            onClick={() => {
              if (fixedCategory && categorySlotIndex !== null) {
                placeCategoryWord(fixedCategory, categorySlotIndex, tile);
              } else if (slotIndex !== null) {
                placeTile(slotIndex, tile);
              }
              onClose();
            }}
          >
            {tile.label}
          </button>
        ))}
      </div>
    ) :
      <form onSubmit={event => { event.preventDefault(); const trimmed = label.trim(); if (!trimmed) return; const newTile = {
  id: `custom-${crypto.randomUUID()}`,
  label: trimmed,
  categoryId: activeCategory,
  iconName,
  isCustom: true,
};

if (fixedCategory && categorySlotIndex !== null) {
  addCustomCategoryWord(categorySlotIndex, newTile);
} else {
  addCustomWord(slotIndex, newTile);
} onCreated?.(); onClose(); }} className="space-y-4">
        <label className="block" htmlFor="custom-word">Custom word<input id="custom-word" autoFocus value={label} onChange={event => setLabel(event.target.value)} required maxLength={60} className="block border border-slate-400 p-2 w-full mt-1" /></label>
        <label className="block">Icon<select value={iconName} onChange={event => setIconName(event.target.value)} className="block w-full border border-slate-400 p-2 mt-1"><option value="default">Default speech icon</option>{ICONS.map(icon => <option key={icon.name} value={icon.name}>{icon.label}</option>)}</select></label>
        <button type="submit" disabled={!label.trim()} className="bg-sky-800 text-white px-4 py-2 disabled:opacity-50">Save word</button>
      </form>}
  </Modal>;
}
