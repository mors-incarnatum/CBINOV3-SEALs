"use client";
import { useEffect, useRef, useState } from "react";
import { useBoardStore } from "@/store/BoardProvider";
import { ttsService } from "@/services/tts/ttsService";
import { triggerTapVibration } from "@/lib/haptics";
import type { Tile } from "@/lib/board";

export function useSentenceViewModel() {
    const tokens = useBoardStore(s => s.sentence);
    const config = useBoardStore(s => s.speechConfig);
    const appearance = useBoardStore(s => s.tileAppearance);
    const canUndo = useBoardStore(s => s.sentenceHistory.length > 0);
    const sentenceRevision = useBoardStore(s => s.sentenceRevision);
    const vibrationEnabled = useBoardStore(s => s.featureFlags?.vibration ?? false);

    const append = useBoardStore(s => s.appendSentenceTile);
    const clear = useBoardStore(s => s.clearSentence);
    const backspace = useBoardStore(s => s.popSentenceToken);
    const removeAt = useBoardStore(s => s.removeSentenceTokenAt);
    const undoEdit = useBoardStore(s => s.undoSentenceEdit);
    const setConfig = useBoardStore(s => s.setSpeechConfig);

    const [isSpeaking, setSpeaking] = useState(false);
    const [error, setError] = useState("");
    const [announcement, setAnnouncement] = useState("");

    const clearNext = useRef(false);
    const request = useRef(0);
    const revisionRef = useRef(sentenceRevision);

    useEffect(() => {
        // Any external sentence change (including profile switch or undo) invalidates deferred auto-clear.
        revisionRef.current = sentenceRevision;
        clearNext.current = false;
    }, [sentenceRevision]);

    useEffect(() => () => {
        request.current++;
        ttsService.stop();
    }, []);

    const cancelPendingSpeech = () => {
        request.current++;
        ttsService.stop();
        setSpeaking(false);
    };

    const speak = async (text: string, full = false) => {
        const id = ++request.current;
        const startRevision = revisionRef.current;
        setSpeaking(true);
        setError("");
        try {
            await ttsService.speak({
                text,
                languageTag: config.languageTag || "fil-PH",
                provider: config.provider ?? "local",
                voiceId: config.voiceId ?? null,
                rate: config.rate ?? 1,
                volume: config.volume,
            });
            // Never auto-clear if a newer speech request started OR if the sentence was edited/undone during playback.
            if (id === request.current && full && startRevision === revisionRef.current) {
                if (config.autoClear === "afterSpeak") clear(true);
                if (config.autoClear === "nextTap") clearNext.current = true;
            }
        } catch (e) {
            if (id === request.current) {
                setError(e instanceof Error ? e.message : "Speech unavailable");
            }
        } finally {
            if (id === request.current) {
                setSpeaking(false);
            }
        }
    };

    return {
        state: {
            tokens,
            sentenceText: tokens.map(t => t.spokenText).join(" "),
            isEmpty: !tokens.length,
            isSpeaking,
            error,
            canUndo,
            announcement,
            colorMode: appearance.colorMode,
            ...config,
        },
        actions: {
            onTileActivate: (tile: Tile) => {
                cancelPendingSpeech();
                triggerTapVibration(vibrationEnabled);
                if (clearNext.current) {
                    clear(true);
                    clearNext.current = false;
                }
                append(tile);
                setAnnouncement(`Added ${tile.label}`);
                if (config.speakOnTap) {
                    void speak(tile.spokenText || tile.label);
                }
            },
            speakAll: () => void speak(tokens.map(t => t.spokenText).join(" "), true),
            testSpeak: (text: string) => void speak(text),
            stopSpeaking: () => {
                cancelPendingSpeech();
            },
            backspace: () => {
                cancelPendingSpeech();
                clearNext.current = false;
                backspace();
                setAnnouncement("Removed last word");
            },
            removeAt: (index: number) => {
                cancelPendingSpeech();
                clearNext.current = false;
                removeAt(index);
                setAnnouncement("Removed word");
            },
            clear: () => {
                cancelPendingSpeech();
                clearNext.current = false;
                clear(true);
                setAnnouncement("Cleared sentence");
            },
            undo: () => {
                cancelPendingSpeech();
                clearNext.current = false;
                const restored = undoEdit();
                if (restored) {
                    setAnnouncement("Restored previous sentence");
                }
                return restored;
            },
            setVolume: (volume: number) => setConfig({ volume }),
        },
    };
}
