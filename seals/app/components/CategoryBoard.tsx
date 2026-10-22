"use client";
import { useRef, useState } from "react";
import { CATEGORIES, iconPath, type CategoryId } from "@/lib/board";
import { useBoardStore } from "@/store/BoardProvider";
import { useBoardSpeech } from "./BoardShell";
import CategoryBanner from "./CategoryBanner";
import TileButton from "./TileButton";
import WordPicker from "./WordPicker";

export default function CategoryBoard({
  categoryId,
}: {
  categoryId: CategoryId;
}) {
  const words = useBoardStore((state) => state.dictionary[categoryId]);
  const speak = useBoardSpeech();
  const [page, setPage] = useState(0);
  const [adding, setAdding] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const pageCount = Math.ceil(words.length / 20);
  const category = CATEGORIES[categoryId];
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2 relative">
      <div className="flex items-stretch gap-2">
        <div className="flex-1">
          <CategoryBanner categoryId={categoryId} />
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="category-add border px-4 text-sm font-semibold"
          style={{
            background: category.fill,
            borderColor: category.color,
            color: category.color,
          }}
        >
          + Add word
        </button>
      </div>
      <div
        key={page}
        className="board-page-enter grid grid-cols-4 grid-rows-5 grid-flow-col gap-x-3 gap-y-2 flex-1 min-h-[540px]"
        style={{ touchAction: "pan-y" }}
        onTouchStart={(event) => {
          swiped.current = false;
          start.current = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY,
          };
        }}
        onTouchCancel={() => {
          start.current = null;
        }}
        onTouchEnd={(event) => {
          if (!start.current) return;
          const dx = event.changedTouches[0].clientX - start.current.x;
          const dy = event.changedTouches[0].clientY - start.current.y;
          start.current = null;
          if (
            pageCount > 1 &&
            Math.abs(dx) > 60 &&
            Math.abs(dx) > Math.abs(dy)
          ) {
            swiped.current = true;
            setPage((value) =>
              Math.max(0, Math.min(pageCount - 1, value + (dx < 0 ? 1 : -1))),
            );
          }
        }}
      >
        {Array.from({ length: 20 }, (_, index) => {
          const tile = words[page * 20 + index];
          return tile ? (
            <TileButton
              key={tile.id}
              id={tile.id}
              label={tile.label}
              category={category.label}
              gifPath={iconPath(tile.iconName)}
              buttonProps={{
                onPointerDown: (event) => {
                  if (event.pointerType !== "touch") swiped.current = false;
                },
                onKeyDown: () => {
                  swiped.current = false;
                },
              }}
              onPress={(word) => {
                if (!swiped.current) speak(word);
              }}
            />
          ) : (
            <button
              key={`empty-${index}`}
              type="button"
              aria-label={`Add word to ${category.wheel}`}
              onClick={() => {
                if (!swiped.current) setAdding(true);
              }}
              onPointerDown={(event) => {
                if (event.pointerType !== "touch") swiped.current = false;
              }}
              onKeyDown={() => {
                swiped.current = false;
              }}
              className="category-empty border flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                background: category.fill,
                borderColor: category.color,
                color: category.color,
              }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-current/20 bg-white/70 text-2xl">
                +
              </span>
            </button>
          );
        })}
      </div>
      {pageCount > 1 && (
        <nav
          aria-label="Category pages"
          className="sticky bottom-2 self-center flex items-center gap-3 bg-white border border-slate-300 p-2 shadow-lg"
        >
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((value) => value - 1)}
            className="border px-3 py-1 disabled:opacity-40"
          >
            Prev
          </button>
          <span aria-live="polite">
            {page + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={page === pageCount - 1}
            onClick={() => setPage((value) => value + 1)}
            className="border px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      )}
      {adding && (
        <WordPicker
          category={categoryId}
          onCreated={() => {
            setPage(Math.floor(words.length / 20));
            swiped.current = false;
          }}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}
