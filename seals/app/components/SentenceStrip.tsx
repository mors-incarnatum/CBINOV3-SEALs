"use client";
import { useRef } from "react";
import { useSentenceContext } from "@/viewmodels/useBoardShellViewModel";
import { useMediaUrl } from "@/viewmodels/useMediaUrl";
/* eslint-disable @next/next/no-img-element */
import { resolveTokenColor, type SentenceToken, type ColorMode } from "@/lib/board";
import { palette } from "@/app/theme";

function TokenButton({
    token,
    index,
    colorMode,
    buttonRef,
    onRemove,
}: {
    token: SentenceToken;
    index: number;
    colorMode: ColorMode;
    buttonRef: (el: HTMLButtonElement | null) => void;
    onRemove: () => void;
}) {
    const { src } = useMediaUrl(token.iconName, token.mediaId);
    const color = resolveTokenColor(token, colorMode);
    return (
        <button
            ref={buttonRef}
            type="button"
            style={palette[color]}
            onClick={onRemove}
            aria-label={`Remove ${token.label} at position ${index + 1}`}
        >
            {src && <img src={src} alt="" />}
            {token.label}
        </button>
    );
}

export default function SentenceStrip() {
    const { state: s, actions: a } = useSentenceContext();
    const tokenRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const undoRef = useRef<HTMLButtonElement | null>(null);

    const handleRemoveAt = (index: number) => {
        a.removeAt(index);
        queueMicrotask(() => {
            const next = tokenRefs.current[index] ?? tokenRefs.current[index - 1] ?? undoRef.current;
            next?.focus();
        });
    };

    return (
        <section className="sentence-strip" aria-label="Sentence strip">
            <div className="sentence-tokens" aria-live="polite" aria-relevant="additions removals">
                {s.isEmpty && <span className="sentence-placeholder">Tap words to build a sentence</span>}
                {s.tokens.map((t, i) => (
                    <TokenButton
                        key={t.instanceId}
                        token={t}
                        index={i}
                        colorMode={s.colorMode}
                        buttonRef={el => {
                            tokenRefs.current[i] = el;
                        }}
                        onRemove={() => handleRemoveAt(i)}
                    />
                ))}
            </div>
            <div className="sentence-actions">
                <button type="button" className="primary" disabled={s.isEmpty} onClick={a.speakAll} aria-label="Speak sentence">
                    🔊 Speak
                </button>
                {s.isSpeaking && (
                    <button type="button" onClick={a.stopSpeaking}>
                        Stop
                    </button>
                )}
                <button type="button" disabled={s.isEmpty} onClick={a.backspace} aria-label="Backspace">
                    ⌫
                </button>
                <button
                    ref={undoRef}
                    type="button"
                    disabled={!s.canUndo}
                    onClick={a.undo}
                    aria-label="Undo last sentence edit"
                    title="Undo last sentence edit"
                >
                    ↶ Undo
                </button>
                <button type="button" disabled={s.isEmpty} onClick={a.clear} aria-label="Clear sentence">
                    ✕
                </button>
            </div>
            {s.announcement && (
                <span className="sr-only" role="status" aria-live="polite">
                    {s.announcement}
                </span>
            )}
            {s.error && (
                <span role="status" className="speech-error">
                    {s.error}
                </span>
            )}
        </section>
    );
}
