"use client";

import { useScribblePracticeViewModel } from "@/viewmodels/useScribblePracticeViewModel";
import type { ScribbleOcrEngine } from "@/services/scribble/scribbleOcrService";

const ENGINE_OPTIONS: { value: ScribbleOcrEngine; label: string; shortLabel: string }[] = [
    { value: "puter", label: "Puter.js Cloud OCR", shortLabel: "Puter.js Cloud" },
    { value: "tesseract", label: "Tesseract.js Offline OCR", shortLabel: "Tesseract.js Offline" },
    { value: "local", label: "Local Vocabulary Match", shortLabel: "Local Match" },
];

function traceBadgeTone(score: number | null): { bar: string; pill: string; text: string } {
    if (score === null) {
        return {
            bar: "bg-slate-300",
            pill: "bg-slate-100 text-slate-600 border-slate-200",
            text: "Trace over the word",
        };
    }
    if (score >= 70) {
        return {
            bar: "bg-emerald-500",
            pill: "bg-emerald-50 text-emerald-800 border-emerald-200",
            text: `Great match (${score}%)`,
        };
    }
    if (score >= 40) {
        return {
            bar: "bg-amber-500",
            pill: "bg-amber-50 text-amber-800 border-amber-200",
            text: `Keep going (${score}%)`,
        };
    }
    return {
        bar: "bg-sky-500",
        pill: "bg-sky-50 text-sky-800 border-sky-200",
        text: `Trace accuracy: ${score}%`,
    };
}

export default function ScribblePracticeModal({ onClose }: { onClose: () => void }) {
    const { canvasRef, state: s, actions: a } = useScribblePracticeViewModel(onClose);
    const activeEngine = ENGINE_OPTIONS.find(opt => opt.value === s.engine) ?? ENGINE_OPTIONS[0];
    const recentDrafts = Array.from(new Set(s.drafts.slice().reverse())).slice(0, 6);
    const traceTone = traceBadgeTone(s.traceScore);
    const canSpeak = Boolean(s.recognizedText.trim() || (s.mode === "tracing" && s.targetTile));

    return (
        <section
            aria-label="Scribble handwriting practice"
            className="flex-1 min-h-0 w-full rounded-xl border border-slate-300 bg-white shadow-xs overflow-hidden flex flex-col"
        >
            <div className="bg-[#0369a1] text-white px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold shrink-0">
                        ✍
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm font-bold leading-tight truncate">
                            Scribble &amp; Handwriting Practice
                        </h2>
                        <p className="text-[11px] text-sky-100 leading-tight truncate">
                            {s.mode === "freehand" ? "Freehand Writing" : "Guided Word Tracing"} · {activeEngine.shortLabel}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <div
                        role="group"
                        aria-label="Practice mode"
                        className="inline-flex rounded-lg bg-white/15 p-0.5 text-xs"
                    >
                        <button
                            type="button"
                            aria-pressed={s.mode === "freehand"}
                            onClick={() => a.setMode("freehand")}
                            className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                                s.mode === "freehand"
                                    ? "bg-white text-[#0369a1]"
                                    : "text-white hover:bg-white/15"
                            }`}
                        >
                            Freehand Writing
                        </button>
                        <button
                            type="button"
                            aria-pressed={s.mode === "tracing"}
                            onClick={() => a.setMode("tracing")}
                            className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                                s.mode === "tracing"
                                    ? "bg-white text-[#0369a1]"
                                    : "text-white hover:bg-white/15"
                            }`}
                        >
                            Guided Word Tracing
                        </button>
                    </div>

                    <select
                        aria-label="OCR recognition engine"
                        value={s.engine}
                        onChange={e => a.setEngine(e.target.value as ScribbleOcrEngine)}
                        className="bg-white text-slate-900 text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-sky-200 outline-none cursor-pointer"
                    >
                        {ENGINE_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close scribble practice"
                        className="w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center text-white/90 hover:text-white transition-colors shrink-0 cursor-pointer"
                    >
                        ✕
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-3.5 py-3 space-y-3 bg-slate-50">
                {s.mode === "tracing" && (
                    <div className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-2 shadow-2xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Word category filter">
                                <button
                                    type="button"
                                    aria-pressed={s.categoryFilter === "all"}
                                    onClick={() => a.setCategoryFilter("all")}
                                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                                        s.categoryFilter === "all"
                                            ? "bg-[#0369a1] text-white border-[#0369a1]"
                                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                    }`}
                                >
                                    All
                                </button>
                                {s.categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        aria-pressed={s.categoryFilter === cat.id}
                                        onClick={() => a.setCategoryFilter(cat.id)}
                                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                                            s.categoryFilter === cat.id
                                                ? "bg-[#0369a1] text-white border-[#0369a1]"
                                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                        }`}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>

                            <div className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${traceTone.pill}`}>
                                {traceTone.text}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={a.prevTargetWord}
                                disabled={s.filteredWordTiles.length === 0}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700"
                            >
                                ◀ Prev
                            </button>
                            <select
                                aria-label="Word to trace"
                                value={s.targetWordId}
                                onChange={e => a.selectTargetWord(e.target.value)}
                                className="flex-1 min-w-[140px] bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-900"
                            >
                                {s.filteredWordTiles.map(tile => (
                                    <option key={tile.id} value={tile.id}>
                                        {tile.label}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={a.nextTargetWord}
                                disabled={s.filteredWordTiles.length === 0}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700"
                            >
                                Next ▶
                            </button>
                            <button
                                type="button"
                                disabled={!s.targetTile}
                                onClick={() => a.speakText(s.targetTile?.spokenText || s.targetTile?.label)}
                                className="px-3 py-1.5 rounded-lg border border-sky-200 bg-sky-50 hover:bg-sky-100 text-xs font-semibold text-sky-800"
                            >
                                🔊 Hear Word
                            </button>
                        </div>

                        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                                className={`h-full transition-all duration-200 ${traceTone.bar}`}
                                style={{ width: `${s.traceScore ?? 0}%` }}
                            />
                        </div>
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl p-2 shadow-2xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                            <button
                                type="button"
                                aria-pressed={s.tool === "pen"}
                                onClick={() => a.setTool("pen")}
                                className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                                    s.tool === "pen"
                                        ? "bg-[#0369a1] text-white"
                                        : "text-slate-700 hover:bg-slate-200/70"
                                }`}
                            >
                                ✏ Pen
                            </button>
                            <button
                                type="button"
                                aria-pressed={s.tool === "eraser"}
                                onClick={() => a.setTool("eraser")}
                                className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                                    s.tool === "eraser"
                                        ? "bg-[#0369a1] text-white"
                                        : "text-slate-700 hover:bg-slate-200/70"
                                }`}
                            >
                                ⌫ Eraser
                            </button>
                        </div>

                        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs" role="group" aria-label="Pen size">
                            {(["sm", "md", "lg"] as const).map(size => (
                                <button
                                    key={size}
                                    type="button"
                                    aria-pressed={s.penSize === size}
                                    onClick={() => a.setPenSize(size)}
                                    className={`px-2 py-1 rounded-md font-bold uppercase cursor-pointer ${
                                        s.penSize === size
                                            ? "bg-slate-800 text-white"
                                            : "text-slate-600 hover:bg-slate-200/70"
                                    }`}
                                >
                                    {size === "sm" ? "S" : size === "md" ? "M" : "L"}
                                </button>
                            ))}
                        </div>

                        <label className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={s.showGuides}
                                onChange={e => a.setShowGuides(e.target.checked)}
                            />
                            Lined guides
                        </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            disabled={!s.hasStroke || s.isRecognizing}
                            onClick={a.undoStroke}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700"
                        >
                            ↶ Undo stroke
                        </button>
                        <button
                            type="button"
                            disabled={!s.hasStroke || s.isRecognizing}
                            onClick={a.clearCanvas}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700"
                        >
                            🗑 Clear pad
                        </button>
                        <button
                            type="button"
                            disabled={!s.hasStroke || s.isRecognizing}
                            onClick={() => void a.recognize()}
                            className="px-3.5 py-1.5 rounded-lg bg-[#0369a1] hover:bg-sky-800 text-white text-xs font-bold transition-colors"
                        >
                            {s.isRecognizing ? "Recognizing…" : "✨ Recognize"}
                        </button>
                    </div>
                </div>

                <div className="bg-white border-2 border-slate-300 rounded-xl overflow-hidden shadow-inner">
                    <canvas
                        ref={canvasRef}
                        width={640}
                        height={240}
                        aria-label="Handwriting practice canvas"
                        className="w-full h-48 sm:h-56 block touch-none cursor-crosshair bg-white"
                        onPointerDown={a.startDraw}
                        onPointerMove={a.moveDraw}
                        onPointerUp={a.endDraw}
                        onPointerLeave={a.endDraw}
                        onPointerCancel={a.endDraw}
                    />
                </div>

                {(s.errorMessage || s.statusMessage) && (
                    <p
                        role={s.errorMessage ? "alert" : "status"}
                        className={`text-xs rounded-lg px-3 py-1.5 border ${
                            s.errorMessage
                                ? "bg-rose-50 text-rose-800 border-rose-200"
                                : "bg-sky-50 text-sky-900 border-sky-200"
                        }`}
                    >
                        {s.errorMessage || s.statusMessage}
                    </p>
                )}

                {s.suggestions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-600">Tap a suggestion:</span>
                        {s.suggestions.map(word => (
                            <button
                                key={word}
                                type="button"
                                onClick={() => a.applySuggestion(word)}
                                className="px-2.5 py-1 rounded-full bg-white border border-sky-300 hover:bg-sky-50 text-xs font-semibold text-sky-900 cursor-pointer"
                            >
                                {word}
                            </button>
                        ))}
                    </div>
                )}

                {recentDrafts.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-600">Recent drafts:</span>
                        {recentDrafts.map(draft => (
                            <button
                                key={draft}
                                type="button"
                                onClick={() => a.applySuggestion(draft)}
                                className="px-2.5 py-1 rounded-full bg-slate-200/70 hover:bg-slate-200 text-xs font-medium text-slate-800 cursor-pointer"
                            >
                                {draft}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="border-t border-slate-200 bg-white px-3 py-2.5 flex flex-wrap items-center gap-2 shrink-0">
                <input
                    value={s.recognizedText}
                    onChange={e => a.setRecognizedText(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter" && s.recognizedText.trim()) {
                            e.preventDefault();
                            a.addToSentence();
                        }
                    }}
                    aria-label="Review or edit recognized text"
                    placeholder="Recognized word appears here — review or edit before adding"
                    className="flex-1 min-w-[200px] bg-slate-100 hover:bg-slate-200/70 focus:bg-white border border-slate-300 focus:border-[#0369a1] rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition-colors"
                />
                <button
                    type="button"
                    disabled={!canSpeak}
                    onClick={() => a.speakText()}
                    className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-800"
                >
                    🔊 Speak
                </button>
                <button
                    type="button"
                    disabled={!s.recognizedText.trim()}
                    onClick={a.addToSentence}
                    className="px-4 py-2 rounded-lg bg-[#0369a1] hover:bg-sky-800 text-white text-xs font-bold transition-colors"
                >
                    + Add to sentence
                </button>
            </div>
        </section>
    );
}
