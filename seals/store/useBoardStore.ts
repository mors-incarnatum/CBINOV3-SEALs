"use client";
import { createStore } from "zustand/vanilla";
import { persist } from "zustand/middleware";
import { CATEGORY_IDS, INITIAL_DICTIONARY, type CategoryId, type GridSlot, type WordTile } from "@/lib/board";
export interface BoardState {
  dictionary: Record<CategoryId, WordTile[]>;
  homeGrid: GridSlot[];
  placeTile: (index: number, tile: WordTile | null) => void;
  addCustomWord: (index: number | null, tile: WordTile) => void;
}
export const createBoardStore = () => createStore<BoardState>()(persist((set) => ({
  dictionary: INITIAL_DICTIONARY,
  homeGrid: Array.from({ length: 20 }, (_, slotIndex) => ({ slotIndex, tile: INITIAL_DICTIONARY[CATEGORY_IDS[slotIndex % 4]][Math.floor(slotIndex / 4)] })),
  placeTile: (index, tile) => set(state => ({ homeGrid: state.homeGrid.map(slot => slot.slotIndex === index ? { ...slot, tile } : slot) })),
  addCustomWord: (index, tile) => set(state => ({ dictionary: { ...state.dictionary, [tile.categoryId]: [...state.dictionary[tile.categoryId], tile] }, homeGrid: state.homeGrid.map(slot => slot.slotIndex === index ? { ...slot, tile } : slot) })),
}), { name: "wikahon-board-v1", version: 1, skipHydration: true, partialize: state => ({ dictionary: state.dictionary, homeGrid: state.homeGrid }) }));
export type BoardStore = ReturnType<typeof createBoardStore>;
