"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { playTTS } from "@/lib/ttsClient";
import { theme } from "@/app/theme";
import CategoryWheel from "./CategoryWheel";
const SpeechContext = createContext<(word: string) => void>(() => {});
export const useBoardSpeech = () => useContext(SpeechContext);
export default function BoardShell({ children }: { children: React.ReactNode }) {
 const router = useRouter();
 const [activeWord, setActiveWord] = useState("");
 const [volume, setVolume] = useState(1);
 const volumeRef = useRef(1);
 const [wheel, setWheel] = useState<{ x: number; y: number } | null>(null);
 const speak = useCallback((word: string) => { setActiveWord(word); void playTTS(word, volumeRef.current); }, []);
 const setBoardVolume = (value: number) => { volumeRef.current = value; setVolume(value); };
 return <SpeechContext.Provider value={speak}>
 <div className={`flex flex-col h-screen ${theme.screenBg} text-slate-900 font-sans antialiased select-none p-3 gap-3`}>
      {/* Header Area */}
      <header className={`flex items-center justify-between px-5 py-3 ${theme.header.bg} border ${theme.header.border} rounded-none shadow-xs shrink-0`}>
        {/* Top-Left Logo / Title (Lighter/Lower Hue Blue) */}
        <div role="link" tabIndex={0} aria-label="WiKahon home" onClick={() => router.push("/board")} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); router.push("/board"); } }} style={{ cursor: "pointer" }} className="flex items-center space-x-3 shrink-0">
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
            onChange={(e) => setBoardVolume(parseFloat(e.target.value))}
            className={`w-24 ${theme.volume.accent} cursor-pointer`}
            aria-label="Volume"
          />
        </div>
      </header>


 <main className="flex-1 min-h-0 flex flex-col overflow-y-auto" tabIndex={0} aria-label="Communication board. Right-click or press Shift F10 for categories."
 onContextMenu={event => { event.preventDefault(); setWheel({ x: event.clientX, y: event.clientY }); }}
 onKeyDown={event => { if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) { event.preventDefault(); setWheel({ x: window.innerWidth / 2, y: window.innerHeight / 2 }); } }}>
 {children}
 </main>
 {wheel && <CategoryWheel coords={wheel} onClose={() => setWheel(null)} />}
 </div></SpeechContext.Provider>;
}
