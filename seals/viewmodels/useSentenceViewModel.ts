"use client";
import { useEffect, useRef, useState } from "react";
import { useBoardStore } from "@/store/BoardProvider";
import { ttsService } from "@/services/tts/ttsService";
import type { Tile } from "@/lib/board";
export function useSentenceViewModel() {
    const tokens = useBoardStore(s => s.sentence), config = useBoardStore(s => s.speechConfig);
    const append = useBoardStore(s => s.appendSentenceTile), clear = useBoardStore(s => s.clearSentence), backspace = useBoardStore(s => s.popSentenceToken), removeAt = useBoardStore(s => s.removeSentenceTokenAt), setConfig = useBoardStore(s => s.setSpeechConfig);
    const [isSpeaking, setSpeaking] = useState(false), [error, setError] = useState("");
    const clearNext = useRef(false), request = useRef(0);
    useEffect(() => () => { request.current++; ttsService.stop(); }, []);
    const speak = async (text: string, full = false) => { const id = ++request.current; setSpeaking(true); setError(""); try {
        await ttsService.speak(text, config.volume);
        if (id === request.current && full) {
            if (config.autoClear === "afterSpeak")
                clear();
            if (config.autoClear === "nextTap")
                clearNext.current = true;
        }
    }
    catch (e) {
        if (id === request.current)
            setError(e instanceof Error ? e.message : "Speech unavailable");
    }
    finally {
        if (id === request.current)
            setSpeaking(false);
    } };
    return { state: { tokens, sentenceText: tokens.map(t => t.spokenText).join(" "), isEmpty: !tokens.length, isSpeaking, error, ...config }, actions: { onTileActivate: (tile: Tile) => { request.current++; ttsService.stop(); setSpeaking(false); if (clearNext.current) {
                clear();
                clearNext.current = false;
            } append(tile); if (config.speakOnTap)
                void speak(tile.spokenText || tile.label); }, speakAll: () => void speak(tokens.map(t => t.spokenText).join(" "), true), testSpeak: (text: string) => void speak(text), stopSpeaking: () => { request.current++; ttsService.stop(); setSpeaking(false); }, backspace, removeAt, clear: () => { clearNext.current = false; clear(); }, setVolume: (volume: number) => setConfig({ volume }) } };
}
