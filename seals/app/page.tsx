"use client";

import { useState, useEffect } from "react";
import { playTTS } from "@/lib/ttsClient";

// Hash Map structure for tile entries
interface TileHashMap {
  id: string;
  label: string;
  category: string;
  gifPath: string;
}

export default function Home() {
  // Hash map / Array list state for tiles. Starts empty so prior to JSON load there is no text.
  const [tiles, setTiles] = useState<TileHashMap[]>([]);
  const [activeWord, setActiveWord] = useState<string>("");
  const [volume, setVolume] = useState<number>(1);

  // Load Words.json once on mount and populate tile hash map array
  useEffect(() => {
    import("@/models/Words.json")
      .then((data) => {
        const parsedTiles: TileHashMap[] = [];
        let count = 1;
        const categories = data.words;

        for (const [categoryName, wordList] of Object.entries(categories)) {
          // Remove duplicates if any to ensure clean mapping
          const uniqueWords = Array.from(new Set(wordList as string[]));
          uniqueWords.forEach((word) => {
            parsedTiles.push({
              id: String(count++),
              label: word,
              category: categoryName,
              // Converts e.g. "I Want" to "/gifs/i-want.gif"
              gifPath: `/gifs/${word.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.gif`,
            });
          });
        }

        setTiles(parsedTiles);
      })
      .catch((err) => {
        console.error("Failed to load Words.json", err);
      });
  }, []);

  // Display pressed tile text in the status bar and play TTS
  const handleTilePress = (word: string) => {
    setActiveWord(word);
    playTTS(word, volume);
  };

  // Define our 4 core categories to render as columns
  const activeCategories = [
    "Needs / Emergency",
    "Actions / Response",
    "People",
    "Feelings"
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-200 text-slate-900 font-sans antialiased select-none p-3 gap-3">
      {/* Header Area */}
      <header className="flex items-center justify-between px-5 py-3 bg-white border border-slate-300 rounded-none shadow-xs shrink-0">
        {/* Top-Left Logo / Title (Lighter/Lower Hue Blue) */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="w-8 h-8 bg-sky-700 text-white font-bold text-lg flex items-center justify-center rounded-none shadow-xs">
            W
          </div>
          <h1 className="text-lg font-bold text-slate-800">
            WiKahon
          </h1>
        </div>

        {/* Center Status / Display Bar (Fuller length) */}
        <div className="flex-1 px-8 flex justify-center">
          <div className="h-11 w-full max-w-4xl bg-slate-50 border border-slate-300 rounded-none flex items-center justify-center px-6 shadow-inner">
            <span className="text-xl font-bold text-sky-900 tracking-wide">
              {activeWord || ""}
            </span>
          </div>
        </div>

        {/* Right Volume Control */}
        <div className="flex items-center space-x-2 shrink-0">
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-24 accent-sky-700 cursor-pointer"
            aria-label="Volume"
          />
        </div>
      </header>

      {/* Main Grid Area: 4 Columns with Category Headers */}
      <main className="flex-1 min-h-0 flex flex-col">
        <div className="w-full h-full grid grid-cols-4 gap-3">
          {activeCategories.map((categoryName) => {
            // Filter tiles for the current column
            const categoryTiles = tiles.filter((t) => t.category === categoryName);
            
            return (
              <div key={categoryName} className="flex flex-col gap-2 h-full">
                {/* Category Header */}
                <div className="text-center font-bold text-sm md:text-base text-slate-700 bg-slate-300/50 py-1.5 border border-slate-300 rounded-none shadow-xs shrink-0">
                  {categoryName}
                </div>
                
                {/* Column Tiles */}
                {categoryTiles.length > 0
                  ? categoryTiles.map((tile) => (
                      <button
                        key={tile.id}
                        onClick={() => handleTilePress(tile.label)}
                        className="bg-white border border-slate-300 rounded-none shadow-xs hover:border-sky-600 hover:bg-sky-50/50 active:bg-sky-100 active:border-sky-700 transition-all duration-100 flex flex-col items-center justify-center p-2 focus:outline-none focus:ring-2 focus:ring-sky-600/40 relative group flex-1"
                      >
                        {/* Icons Temporaryly Hidden
                        <img
                          src={tile.gifPath}
                          alt={tile.label}
                          className="w-12 h-12 md:w-16 md:h-16 object-contain mb-1 md:mb-2 group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        */}
                        <span className="text-lg lg:text-xl font-semibold text-slate-800 text-center leading-tight">
                          {tile.label}
                        </span>
                      </button>
                    ))
                  : // Prior to JSON load, render 5 blank flexible placeholders per column
                    Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={`placeholder-${categoryName}-${index}`}
                        className="bg-white border border-slate-200 rounded-none shadow-xs flex-1"
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