"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { playTTS } from "@/lib/ttsClient";
import TileButton from "@/app/components/TileButton";
import { theme } from "@/app/theme";

// Hash Map structure for tile entries
interface TileHashMap {
  id: string;
  label: string;
  category: string;
  gifPath: string;
}

function normalizeGifSlug(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[\/]+/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function resolveGifPath(word: string): string {
  return `/gifs/${normalizeGifSlug(word)}.gif`;
}

export default function Home() {
  // Pre-grouped tiles map by category. Starts empty so prior to JSON load there is no text.
  const [tilesByCategory, setTilesByCategory] = useState<Record<string, TileHashMap[]>>({});
  const [activeWord, setActiveWord] = useState<string>("");
  const [volume, setVolume] = useState<number>(1);

  // Volume ref to keep handleTilePress callback stable and prevent re-rendering tiles when slider moves
  const volumeRef = useRef(volume);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  // Load Words.json once on mount and populate tile map grouped by category
  useEffect(() => {
    import("@/models/Words.json")
      .then((data) => {
        const grouped: Record<string, TileHashMap[]> = {};
        let count = 1;
        const categories = data.words;

        for (const [categoryName, wordList] of Object.entries(categories)) {
          if (!grouped[categoryName]) {
            grouped[categoryName] = [];
          }
          // Remove duplicates if any to ensure clean mapping
          const uniqueWords = Array.from(new Set(wordList as string[]));
          uniqueWords.forEach((word) => {
            grouped[categoryName].push({
              id: String(count++),
              label: word,
              category: categoryName,
              // Resolve valid GIF paths and skip missing assets cleanly.
              gifPath: resolveGifPath(word),
            });
          });
        }

        setTilesByCategory(grouped);
      })
      .catch((err) => {
        console.error("Failed to load Words.json", err);
      });
  }, []);

  // Display pressed tile text in the status bar and play TTS (stable callback reference)
  const handleTilePress = useCallback((word: string) => {
    setActiveWord(word);
    playTTS(word, volumeRef.current);
  }, []);

  // Define our 4 core categories to render as columns
  const activeCategories = [
    "Needs / Emergency",
    "Actions / Response",
    "People",
    "Feelings"
  ];

  return (
    <div className={`flex flex-col h-screen ${theme.screenBg} text-slate-900 font-sans antialiased select-none p-3 gap-3`}>
      {/* Header Area */}
      <header className={`flex items-center justify-between px-5 py-3 ${theme.header.bg} border ${theme.header.border} rounded-none shadow-xs shrink-0`}>
        {/* Top-Left Logo / Title (Lighter/Lower Hue Blue) */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className={`w-8 h-8 ${theme.brand.logoBg} ${theme.brand.logoText} font-bold text-lg flex items-center justify-center rounded-none shadow-xs`}>
            W
          </div>
          <h1 className={`text-lg font-bold ${theme.brand.titleText}`}>
            WiKahon
          </h1>
        </div>

        {/* Center Status / Display Bar (Fuller length) */}
        <div className="flex-1 px-8 flex justify-center">
          <div className={`h-11 w-full max-w-4xl ${theme.displayBar.bg} border ${theme.displayBar.border} rounded-none flex items-center justify-center px-6 shadow-inner`}>
            <span className={`text-xl font-bold ${theme.displayBar.text} tracking-wide`}>
              {activeWord || ""}
            </span>
          </div>
        </div>

        {/* Right Volume Control */}
        <div className="flex items-center space-x-2 shrink-0">
          <svg className={`w-5 h-5 ${theme.volume.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className={`w-24 ${theme.volume.accent} cursor-pointer`}
            aria-label="Volume"
          />
        </div>
      </header>

      {/* Main Grid Area: 4 Columns with Category Headers */}
      <main className="flex-1 min-h-0 flex flex-col overflow-y-auto">
        <div className="w-full h-full grid grid-cols-4 gap-3">
          {activeCategories.map((categoryName) => {
            // Direct O(1) lookup of tiles for the current column
            const categoryTiles = tilesByCategory[categoryName] || [];
            const catTheme =
              categoryName in theme.categoryTiles
                ? theme.categoryTiles[categoryName as keyof typeof theme.categoryTiles]
                : null;
            
            return (
              <div key={categoryName} className="flex flex-col gap-2 h-full">
                {/* Category Header */}
                <div
                  className={`text-center font-bold text-sm md:text-base ${
                    catTheme ? catTheme.headerText : theme.categoryHeader.text
                  } ${
                    catTheme ? catTheme.headerBg : theme.categoryHeader.bg
                  } py-1.5 border ${
                    catTheme ? catTheme.headerBorder : theme.categoryHeader.border
                  } rounded-none shadow-xs shrink-0`}
                >
                  {categoryName}
                </div>
                
                {/* Column Tiles */}
                {categoryTiles.length > 0
                  ? categoryTiles.map((tile) => (
                      <TileButton
                        key={tile.id}
                        id={tile.id}
                        label={tile.label}
                        category={categoryName}
                        gifPath={tile.gifPath}
                        onPress={handleTilePress}
                      />
                    ))
                  : // Prior to JSON load, render 5 blank flexible placeholders per column
                    Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={`placeholder-${categoryName}-${index}`}
                        className={`${theme.placeholder.bg} border ${theme.placeholder.border} rounded-none shadow-xs flex-1`}
                      />
                    ))}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}