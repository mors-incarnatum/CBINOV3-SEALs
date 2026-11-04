
"use client";

import { createStore } from "zustand/vanilla";
import { persist } from "zustand/middleware";
import {
  CATEGORY_IDS,
  INITIAL_DICTIONARY,
  type CategoryId,
  type GridSlot,
  type WordTile,
} from "@/lib/board";

export interface BoardState {
  dictionary: Record<CategoryId, (WordTile | null)[]>;
  homeGrid: GridSlot[];
  placeTile: (index: number, tile: WordTile | null) => void;
  addCustomWord: (index: number | null, tile: WordTile) => void;
  removeCategoryWord: (categoryId: CategoryId, tileId: string) => void;
  placeCategoryWord: (
    categoryId: CategoryId,
    slotIndex: number,
    tile: WordTile,
  ) => void;
  addCustomCategoryWord: (slotIndex: number, tile: WordTile) => void;
}

export const createBoardStore = () =>
  createStore<BoardState>()(
    persist(
      (set) => ({
        dictionary: INITIAL_DICTIONARY,

        homeGrid: Array.from({ length: 20 }, (_, slotIndex) => ({
          slotIndex,
          tile:
            INITIAL_DICTIONARY[CATEGORY_IDS[slotIndex % 4]][
              Math.floor(slotIndex / 4)
            ],
        })),

        placeTile: (index, tile) =>
          set((state) => ({
            homeGrid: state.homeGrid.map((slot) =>
              slot.slotIndex === index ? { ...slot, tile } : slot,
            ),
          })),

        addCustomWord: (index, tile) =>
          set((state) => ({
            dictionary: {
              ...state.dictionary,
              [tile.categoryId]: [...state.dictionary[tile.categoryId], tile],
            },
            homeGrid: state.homeGrid.map((slot) =>
              slot.slotIndex === index ? { ...slot, tile } : slot,
            ),
          })),

        removeCategoryWord: (categoryId, tileId) =>
          set((state) => ({
            dictionary: {
              ...state.dictionary,
              [categoryId]: state.dictionary[categoryId].map((tile) =>
                tile?.id === tileId ? null : tile,
              ),
            },
          })),

        placeCategoryWord: (categoryId, slotIndex, tile) =>
          set((state) => {
            const categoryWords = [...state.dictionary[categoryId]];

            const existingIndex = categoryWords.findIndex(
              (word) => word?.id === tile.id,
            );

            while (categoryWords.length <= slotIndex) {
              categoryWords.push(null);
            }

            if (existingIndex !== -1 && existingIndex !== slotIndex) {
              categoryWords[existingIndex] = null;
            }

            categoryWords[slotIndex] = tile;

            return {
              dictionary: {
                ...state.dictionary,
                [categoryId]: categoryWords,
              },
            };
          }),

        addCustomCategoryWord: (slotIndex, tile) =>
          set((state) => {
            const categoryWords = [...state.dictionary[tile.categoryId]];

            while (categoryWords.length <= slotIndex) {
              categoryWords.push(null);
            }

            categoryWords[slotIndex] = tile;

            return {
              dictionary: {
                ...state.dictionary,
                [tile.categoryId]: categoryWords,
              },
            };
          }),
      }),
      {
        name: "wikahon-board-v1",
        version: 1,
        skipHydration: true,
        partialize: (state) => ({
          dictionary: state.dictionary,
          homeGrid: state.homeGrid,
        }),
      },
    ),
  );

export type BoardStore = ReturnType<typeof createBoardStore>;
