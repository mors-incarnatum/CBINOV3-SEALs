"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { Tile } from "@/lib/board";
import {
    cropAndNormalizeGrid,
    evaluateGuidedTrace,
    scribbleOcrService,
    type IScribbleOcrService,
    type NormalizedGrid,
    type ScribbleMode,
    type ScribbleOcrEngine,
    type VocabularyCandidate,
} from "@/services/scribble/scribbleOcrService";
import { useBoardStore } from "@/store/BoardProvider";
import { useSentenceContext } from "@/viewmodels/useBoardShellViewModel";

export type ScribblePenSize = "sm" | "md" | "lg";
export type ScribbleTool = "pen" | "eraser";

export interface ScribbleStroke {
    points: { x: number; y: number }[];
    width: number;
    isEraser?: boolean;
}

const EMPTY_DRAFTS: string[] = [];
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 240;
const GRID_W = 64;
const GRID_H = 24;

const PEN_WIDTHS: Record<ScribblePenSize, number> = {
    sm: 3,
    md: 5,
    lg: 8,
};

const ERASER_MULTIPLIER = 2.6;

function fitLabelFontSize(ctx: CanvasRenderingContext2D, label: string, maxWidth: number): number {
    let size = 88;
    while (size > 28) {
        ctx.font = `700 ${size}px Arial, sans-serif`;
        if (ctx.measureText(label).width <= maxWidth) return size;
        size -= 4;
    }
    return size;
}

function drawTracingTemplate(
    ctx: CanvasRenderingContext2D,
    label: string,
    width: number,
    height: number,
    style: "watermark" | "mask",
) {
    const size = fitLabelFontSize(ctx, label, width - 64);
    ctx.save();
    ctx.font = `700 ${size}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const centerX = width / 2;
    const centerY = height / 2 + 4;

    if (style === "watermark") {
        ctx.fillStyle = "rgba(14, 116, 144, 0.14)";
        ctx.fillText(label, centerX, centerY);
        ctx.strokeStyle = "rgba(14, 116, 144, 0.45)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.strokeText(label, centerX, centerY);
    } else {
        ctx.fillStyle = "#000000";
        ctx.fillText(label, centerX, centerY);
    }
    ctx.restore();
}

function drawGuideLines(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.save();
    const topY = Math.round(height * 0.22);
    const midY = Math.round(height * 0.5);
    const baseY = Math.round(height * 0.74);
    const descY = Math.round(height * 0.88);

    ctx.lineWidth = 1;
    ctx.strokeStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(16, topY);
    ctx.lineTo(width - 16, topY);
    ctx.moveTo(16, descY);
    ctx.lineTo(width - 16, descY);
    ctx.stroke();

    ctx.strokeStyle = "#bae6fd";
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(16, midY);
    ctx.lineTo(width - 16, midY);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(16, baseY);
    ctx.lineTo(width - 16, baseY);
    ctx.stroke();
    ctx.restore();
}

function paintStroke(ctx: CanvasRenderingContext2D, stroke: ScribbleStroke) {
    if (stroke.points.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = stroke.isEraser ? "destination-out" : "source-over";
    ctx.strokeStyle = "#0f172a";
    ctx.fillStyle = "#0f172a";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.width;

    if (stroke.points.length === 1) {
        const p = stroke.points[0];
        ctx.beginPath();
        ctx.arc(p.x, p.y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
    }

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
}

function downsampleRawGrid(alphaOrLuminance: Uint8ClampedArray, width: number, height: number): NormalizedGrid {
    const data = new Uint8Array(GRID_W * GRID_H);
    for (let gy = 0; gy < GRID_H; gy++) {
        const sy0 = Math.floor((gy * height) / GRID_H);
        const sy1 = Math.max(sy0, Math.floor(((gy + 1) * height) / GRID_H) - 1);
        for (let gx = 0; gx < GRID_W; gx++) {
            const sx0 = Math.floor((gx * width) / GRID_W);
            const sx1 = Math.max(sx0, Math.floor(((gx + 1) * width) / GRID_W) - 1);
            let active = 0;
            for (let sy = sy0; sy <= sy1 && !active; sy++) {
                for (let sx = sx0; sx <= sx1; sx++) {
                    if (alphaOrLuminance[(sy * width + sx) * 4 + 3] > 64) {
                        active = 1;
                        break;
                    }
                }
            }
            data[gy * GRID_W + gx] = active;
        }
    }
    return { width: GRID_W, height: GRID_H, data };
}

function buildBinaryMask(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < mask.length; i++) {
        if (rgba[i * 4 + 3] > 64) mask[i] = 1;
    }
    return mask;
}

/**
 * ViewModel for the Scribble Practice workspace, encapsulating multi-engine OCR
 * (Puter.js Cloud, Tesseract.js Offline, and Local Vocabulary Match),
 * Freehand & Guided Word Tracing modes, drawing tools, and sentence integration.
 */
export function useScribblePracticeViewModel(
    onClose: () => void,
    ocrService: IScribbleOcrService = scribbleOcrService,
) {
    const sentence = useSentenceContext();
    const tiles = useBoardStore(s => s.tiles);
    const boards = useBoardStore(s => s.boards);
    const catalogOrder = useBoardStore(s => s.catalogOrder);
    const drafts = useBoardStore(s => s.experimentalData?.scribbleDrafts) ?? EMPTY_DRAFTS;
    const addScribbleDraft = useBoardStore(s => s.addScribbleDraft);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const inkCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const activeStrokeRef = useRef<ScribbleStroke | null>(null);
    const recognizeRequestRef = useRef(0);
    const wordGridCacheRef = useRef<Map<string, { raw: NormalizedGrid; cropped: NormalizedGrid }>>(new Map());

    const [mode, setModeState] = useState<ScribbleMode>("freehand");
    const [engine, setEngineState] = useState<ScribbleOcrEngine>("puter");
    const [penSize, setPenSize] = useState<ScribblePenSize>("md");
    const [tool, setTool] = useState<ScribbleTool>("pen");
    const [showGuides, setShowGuides] = useState(true);
    const [strokes, setStrokes] = useState<ScribbleStroke[]>([]);
    const [categoryFilter, setCategoryFilterState] = useState<string>("all");
    const [targetWordId, setTargetWordId] = useState<string>("n-3");
    const [recognizedText, setRecognizedText] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [traceScore, setTraceScore] = useState<number | null>(null);
    const [isRecognizing, setIsRecognizing] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const wordTiles = useMemo(
        () =>
            Object.values(tiles)
                .filter((t): t is Tile => t.kind === "word" && t.label.trim().length > 0)
                .sort((a, b) => a.categoryId.localeCompare(b.categoryId) || a.label.localeCompare(b.label)),
        [tiles],
    );

    const categories = useMemo(() => {
        const seen = new Set<string>();
        const list: { id: string; label: string }[] = [];
        for (const id of catalogOrder) {
            if (id === "home" || seen.has(id)) continue;
            seen.add(id);
            const board = boards[id];
            list.push({ id, label: board?.shortName || board?.name || id });
        }
        for (const t of wordTiles) {
            if (!seen.has(t.categoryId)) {
                seen.add(t.categoryId);
                const board = boards[t.categoryId];
                list.push({ id: t.categoryId, label: board?.shortName || board?.name || t.categoryId });
            }
        }
        return list;
    }, [catalogOrder, boards, wordTiles]);

    const filteredWordTiles = useMemo(
        () =>
            categoryFilter === "all"
                ? wordTiles
                : wordTiles.filter(t => t.categoryId === categoryFilter),
        [wordTiles, categoryFilter],
    );

    const targetTile = useMemo(
        () => filteredWordTiles.find(t => t.id === targetWordId) ?? filteredWordTiles[0] ?? null,
        [filteredWordTiles, targetWordId],
    );

    const ensureInkCanvas = useCallback((): HTMLCanvasElement | null => {
        if (typeof document === "undefined") return null;
        if (!inkCanvasRef.current) {
            const off = document.createElement("canvas");
            off.width = CANVAS_WIDTH;
            off.height = CANVAS_HEIGHT;
            inkCanvasRef.current = off;
        }
        return inkCanvasRef.current;
    }, []);

    const getWordGrids = useCallback((label: string): { raw: NormalizedGrid; cropped: NormalizedGrid } => {
        const cached = wordGridCacheRef.current.get(label);
        if (cached) return cached;

        if (typeof document === "undefined") {
            const empty: NormalizedGrid = {
                width: GRID_W,
                height: GRID_H,
                data: new Uint8Array(GRID_W * GRID_H),
            };
            return { raw: empty, cropped: empty };
        }

        const off = document.createElement("canvas");
        off.width = CANVAS_WIDTH;
        off.height = CANVAS_HEIGHT;
        const ctx = off.getContext("2d");
        if (!ctx) {
            const empty: NormalizedGrid = {
                width: GRID_W,
                height: GRID_H,
                data: new Uint8Array(GRID_W * GRID_H),
            };
            return { raw: empty, cropped: empty };
        }

        drawTracingTemplate(ctx, label, CANVAS_WIDTH, CANVAS_HEIGHT, "mask");
        const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).data;
        const raw = downsampleRawGrid(imageData, CANVAS_WIDTH, CANVAS_HEIGHT);
        const mask = buildBinaryMask(imageData, CANVAS_WIDTH, CANVAS_HEIGHT);
        const cropped = cropAndNormalizeGrid(mask, CANVAS_WIDTH, CANVAS_HEIGHT, GRID_W, GRID_H);
        const result = { raw, cropped };
        wordGridCacheRef.current.set(label, result);
        return result;
    }, []);

    const renderInkLayer = useCallback(
        (strokeList: ScribbleStroke[], extraStroke?: ScribbleStroke | null) => {
            const inkCanvas = ensureInkCanvas();
            if (!inkCanvas) return null;
            const inkCtx = inkCanvas.getContext("2d");
            if (!inkCtx) return null;
            inkCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            for (const stroke of strokeList) {
                paintStroke(inkCtx, stroke);
            }
            if (extraStroke) {
                paintStroke(inkCtx, extraStroke);
            }
            return inkCanvas;
        },
        [ensureInkCanvas],
    );

    const redrawCanvas = useCallback(
        (strokeList: ScribbleStroke[], extraStroke?: ScribbleStroke | null) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            if (showGuides) {
                drawGuideLines(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
            }
            if (mode === "tracing" && targetTile) {
                drawTracingTemplate(ctx, targetTile.label, CANVAS_WIDTH, CANVAS_HEIGHT, "watermark");
            }

            const inkCanvas = renderInkLayer(strokeList, extraStroke);
            if (inkCanvas) {
                ctx.drawImage(inkCanvas, 0, 0);
            }
        },
        [mode, renderInkLayer, showGuides, targetTile],
    );

    useEffect(() => {
        redrawCanvas(strokes, activeStrokeRef.current);
    }, [strokes, redrawCanvas]);

    const extractDrawingPayload = useCallback(
        (strokeList: ScribbleStroke[]) => {
            const inkCanvas = renderInkLayer(strokeList);
            if (!inkCanvas || typeof document === "undefined") return null;
            const inkCtx = inkCanvas.getContext("2d");
            if (!inkCtx) return null;

            const inkData = inkCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).data;
            const mask = buildBinaryMask(inkData, CANVAS_WIDTH, CANVAS_HEIGHT);
            let hasVisibleInk = false;
            for (let i = 0; i < mask.length; i++) {
                if (mask[i] > 0) {
                    hasVisibleInk = true;
                    break;
                }
            }
            if (!hasVisibleInk) return null;

            const rawDrawnGrid = downsampleRawGrid(inkData, CANVAS_WIDTH, CANVAS_HEIGHT);
            const drawnGrid = cropAndNormalizeGrid(mask, CANVAS_WIDTH, CANVAS_HEIGHT, GRID_W, GRID_H);

            const exportCanvas = document.createElement("canvas");
            exportCanvas.width = CANVAS_WIDTH;
            exportCanvas.height = CANVAS_HEIGHT;
            const exportCtx = exportCanvas.getContext("2d");
            if (!exportCtx) return null;
            exportCtx.fillStyle = "#ffffff";
            exportCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            exportCtx.drawImage(inkCanvas, 0, 0);

            return {
                imageDataUrl: exportCanvas.toDataURL("image/png"),
                drawnGrid,
                rawDrawnGrid,
            };
        },
        [renderInkLayer],
    );

    const getPointerPoint = (canvas: HTMLCanvasElement, e: PointerEvent<HTMLCanvasElement>) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
        const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    };

    const startDraw = (e: PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (typeof canvas.setPointerCapture === "function") {
            try {
                canvas.setPointerCapture(e.pointerId);
            } catch {
                // Ignore synthetic events without active pointerId
            }
        }
        const point = getPointerPoint(canvas, e);
        const baseWidth = PEN_WIDTHS[penSize];
        const newStroke: ScribbleStroke = {
            points: [point],
            width: tool === "eraser" ? baseWidth * ERASER_MULTIPLIER : baseWidth,
            isEraser: tool === "eraser",
        };
        activeStrokeRef.current = newStroke;
        setErrorMessage(null);
        redrawCanvas(strokes, newStroke);
    };

    const moveDraw = (e: PointerEvent<HTMLCanvasElement>) => {
        const current = activeStrokeRef.current;
        const canvas = canvasRef.current;
        if (!current || !canvas) return;
        current.points.push(getPointerPoint(canvas, e));
        redrawCanvas(strokes, current);
    };

    const updateLiveTraceScore = useCallback(
        (strokeList: ScribbleStroke[]) => {
            if (mode !== "tracing" || !targetTile || strokeList.length === 0) {
                setTraceScore(null);
                return;
            }
            const payload = extractDrawingPayload(strokeList);
            if (!payload) {
                setTraceScore(null);
                return;
            }
            const targetGrids = getWordGrids(targetTile.label);
            const score = evaluateGuidedTrace(payload.rawDrawnGrid, targetGrids.raw);
            setTraceScore(score);
        },
        [extractDrawingPayload, getWordGrids, mode, targetTile],
    );

    const endDraw = () => {
        const current = activeStrokeRef.current;
        if (!current) return;
        activeStrokeRef.current = null;
        const nextStrokes = [...strokes, current];
        setStrokes(nextStrokes);
        updateLiveTraceScore(nextStrokes);
    };

    const undoStroke = () => {
        if (strokes.length === 0) return;
        const nextStrokes = strokes.slice(0, -1);
        setStrokes(nextStrokes);
        updateLiveTraceScore(nextStrokes);
        setStatusMessage(null);
        setErrorMessage(null);
    };

    const clearCanvas = () => {
        recognizeRequestRef.current++;
        activeStrokeRef.current = null;
        setStrokes([]);
        setRecognizedText("");
        setSuggestions([]);
        setTraceScore(null);
        setIsRecognizing(false);
        setStatusMessage(null);
        setErrorMessage(null);
    };

    const recognize = async () => {
        if (strokes.length === 0) return;
        const payload = extractDrawingPayload(strokes);
        if (!payload) {
            setErrorMessage("Draw a word before recognizing.");
            return;
        }

        const requestId = ++recognizeRequestRef.current;
        setIsRecognizing(true);
        setErrorMessage(null);
        setStatusMessage(
            engine === "tesseract"
                ? "Running Tesseract.js offline OCR…"
                : engine === "puter"
                  ? "Recognizing with Puter.js Cloud OCR…"
                  : "Matching locally against board vocabulary…",
        );

        try {
            const candidates: VocabularyCandidate[] = wordTiles.map(tile => {
                const grids = getWordGrids(tile.label);
                return {
                    id: tile.id,
                    label: tile.label,
                    spokenText: tile.spokenText || tile.label,
                    categoryId: tile.categoryId,
                    grid: grids.cropped,
                };
            });

            const targetGrids = targetTile ? getWordGrids(targetTile.label) : null;
            const targetCandidate: VocabularyCandidate | null =
                targetTile && targetGrids
                    ? {
                          id: targetTile.id,
                          label: targetTile.label,
                          spokenText: targetTile.spokenText || targetTile.label,
                          categoryId: targetTile.categoryId,
                          grid: targetGrids.cropped,
                      }
                    : null;

            const result = await ocrService.recognize({
                engine,
                mode,
                imageDataUrl: payload.imageDataUrl,
                drawnGrid: payload.drawnGrid,
                rawDrawnGrid: payload.rawDrawnGrid,
                rawTargetGrid: targetGrids?.raw ?? null,
                candidates,
                targetCandidate,
            });

            if (requestId !== recognizeRequestRef.current) return;

            setRecognizedText(result.text);
            setSuggestions(result.suggestions);
            if (result.traceScore !== null) {
                setTraceScore(result.traceScore);
            }
            setStatusMessage(result.notice ?? null);
        } catch (err) {
            if (requestId !== recognizeRequestRef.current) return;
            setErrorMessage(err instanceof Error ? err.message : "Recognition failed.");
            setStatusMessage(null);
        } finally {
            if (requestId === recognizeRequestRef.current) {
                setIsRecognizing(false);
            }
        }
    };

    const setMode = (nextMode: ScribbleMode) => {
        setModeState(nextMode);
        setStatusMessage(null);
        setErrorMessage(null);
        if (nextMode === "tracing") {
            updateLiveTraceScore(strokes);
        } else {
            setTraceScore(null);
        }
    };

    const setEngine = (nextEngine: ScribbleOcrEngine) => {
        setEngineState(nextEngine);
        setStatusMessage(null);
        setErrorMessage(null);
    };

    const setCategoryFilter = (nextCategory: string) => {
        setCategoryFilterState(nextCategory);
        const matching =
            nextCategory === "all"
                ? wordTiles
                : wordTiles.filter(t => t.categoryId === nextCategory);
        if (matching.length > 0 && !matching.some(t => t.id === targetWordId)) {
            setTargetWordId(matching[0].id);
            setTraceScore(null);
        }
    };

    const selectTargetWord = (id: string) => {
        setTargetWordId(id);
        setRecognizedText("");
        setSuggestions([]);
        setStatusMessage(null);
        setErrorMessage(null);
        if (mode === "tracing" && strokes.length > 0) {
            const tile = filteredWordTiles.find(t => t.id === id);
            const payload = extractDrawingPayload(strokes);
            if (tile && payload) {
                const targetGrids = getWordGrids(tile.label);
                setTraceScore(evaluateGuidedTrace(payload.rawDrawnGrid, targetGrids.raw));
                return;
            }
        }
        setTraceScore(null);
    };

    const stepTargetWord = (delta: number) => {
        if (filteredWordTiles.length === 0) return;
        const currentIndex = filteredWordTiles.findIndex(t => t.id === targetTile?.id);
        const start = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex = (start + delta + filteredWordTiles.length) % filteredWordTiles.length;
        selectTargetWord(filteredWordTiles[nextIndex].id);
    };

    const applySuggestion = (word: string) => {
        setRecognizedText(word);
        setStatusMessage(`Selected "${word}".`);
    };

    const speakText = (text?: string) => {
        const phrase =
            (text ?? recognizedText).trim() ||
            (mode === "tracing" ? targetTile?.spokenText || targetTile?.label || "" : "");
        if (!phrase) return;
        sentence.actions.testSpeak(phrase);
    };

    const addToSentence = () => {
        const text = recognizedText.trim();
        if (!text) return;
        addScribbleDraft(text);

        const normalized = text.toLowerCase();
        const existingMatch = wordTiles.find(
            t =>
                t.label.trim().toLowerCase() === normalized ||
                (t.spokenText ?? "").trim().toLowerCase() === normalized,
        );

        const tileToActivate: Tile = existingMatch ?? {
            id: `scribble-${Date.now()}`,
            kind: "word",
            label: text,
            spokenText: text,
            iconName: null,
            categoryId: targetTile?.categoryId ?? "needs",
            isCustom: true,
        };

        sentence.actions.onTileActivate(tileToActivate);
        setStatusMessage(`Added "${text}" to sentence.`);
    };

    return {
        canvasRef,
        state: {
            mode,
            engine,
            penSize,
            tool,
            showGuides,
            hasStroke: strokes.length > 0,
            strokeCount: strokes.length,
            categoryFilter,
            categories,
            wordTiles,
            filteredWordTiles,
            targetWordId: targetTile?.id ?? "",
            targetTile,
            recognizedText,
            suggestions,
            traceScore,
            isRecognizing,
            statusMessage,
            errorMessage,
            drafts,
            isSpeaking: sentence.state.isSpeaking,
        },
        actions: {
            onClose,
            setMode,
            setEngine,
            setPenSize,
            setTool,
            setShowGuides,
            setCategoryFilter,
            selectTargetWord,
            nextTargetWord: () => stepTargetWord(1),
            prevTargetWord: () => stepTargetWord(-1),
            startDraw,
            moveDraw,
            endDraw,
            undoStroke,
            clearCanvas,
            recognize,
            mockRecognize: recognize,
            setRecognizedText,
            applySuggestion,
            speakText,
            addToSentence,
        },
    };
}
