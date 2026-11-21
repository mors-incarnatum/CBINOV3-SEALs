export type ScribbleOcrEngine = "puter" | "tesseract" | "local";
export type ScribbleMode = "freehand" | "tracing";

export interface NormalizedGrid {
    width: number;
    height: number;
    data: Uint8Array;
}

export interface VocabularyCandidate {
    id: string;
    label: string;
    spokenText: string;
    categoryId: string;
    grid: NormalizedGrid;
}

export interface ScribbleOcrRequest {
    engine: ScribbleOcrEngine;
    mode: ScribbleMode;
    imageDataUrl: string;
    drawnGrid: NormalizedGrid;
    candidates: VocabularyCandidate[];
    targetCandidate?: VocabularyCandidate | null;
    rawDrawnGrid?: NormalizedGrid;
    rawTargetGrid?: NormalizedGrid | null;
}

export interface ScribbleOcrResult {
    engine: ScribbleOcrEngine;
    text: string;
    suggestions: string[];
    traceScore: number | null;
    fallbackUsed?: boolean;
    notice?: string;
}

export interface IScribbleOcrService {
    recognize(request: ScribbleOcrRequest): Promise<ScribbleOcrResult>;
}

const DEFAULT_GRID_W = 64;
const DEFAULT_GRID_H = 24;

function countActive(grid: NormalizedGrid): number {
    let count = 0;
    for (let i = 0; i < grid.data.length; i++) {
        if (grid.data[i] > 0) count++;
    }
    return count;
}

/**
 * Crops a raw binary ink grid to its active bounding box (with small padding)
 * and resamples it into a fixed-size normalized binary grid.
 */
export function cropAndNormalizeGrid(
    raw: Uint8Array,
    width: number,
    height: number,
    targetW = DEFAULT_GRID_W,
    targetH = DEFAULT_GRID_H,
): NormalizedGrid {
    const out = new Uint8Array(targetW * targetH);
    if (width <= 0 || height <= 0 || raw.length < width * height) {
        return { width: targetW, height: targetH, data: out };
    }

    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
        const rowOffset = y * width;
        for (let x = 0; x < width; x++) {
            if (raw[rowOffset + x] > 0) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (maxX < minX || maxY < minY) {
        return { width: targetW, height: targetH, data: out };
    }

    const spanX = maxX - minX + 1;
    const spanY = maxY - minY + 1;
    const padX = Math.max(1, Math.round(spanX * 0.05));
    const padY = Math.max(1, Math.round(spanY * 0.05));

    const cropX0 = Math.max(0, minX - padX);
    const cropX1 = Math.min(width - 1, maxX + padX);
    const cropY0 = Math.max(0, minY - padY);
    const cropY1 = Math.min(height - 1, maxY + padY);
    const cropW = cropX1 - cropX0 + 1;
    const cropH = cropY1 - cropY0 + 1;

    for (let ty = 0; ty < targetH; ty++) {
        const sy0 = cropY0 + Math.floor((ty * cropH) / targetH);
        const sy1 = Math.max(sy0, cropY0 + Math.floor(((ty + 1) * cropH) / targetH) - 1);
        for (let tx = 0; tx < targetW; tx++) {
            const sx0 = cropX0 + Math.floor((tx * cropW) / targetW);
            const sx1 = Math.max(sx0, cropX0 + Math.floor(((tx + 1) * cropW) / targetW) - 1);

            let active = 0;
            for (let sy = sy0; sy <= sy1 && !active; sy++) {
                const rowOffset = sy * width;
                for (let sx = sx0; sx <= sx1; sx++) {
                    if (raw[rowOffset + sx] > 0) {
                        active = 1;
                        break;
                    }
                }
            }
            out[ty * targetW + tx] = active;
        }
    }

    return { width: targetW, height: targetH, data: out };
}

/**
 * Expands active pixels by `radius` cells in Chebyshev distance so slight
 * stroke shifts remain tolerable during matching.
 */
export function dilateGrid(grid: NormalizedGrid, radius = 1): NormalizedGrid {
    const { width, height, data } = grid;
    const out = new Uint8Array(width * height);
    if (radius <= 0) {
        out.set(data);
        return { width, height, data: out };
    }

    for (let y = 0; y < height; y++) {
        const y0 = Math.max(0, y - radius);
        const y1 = Math.min(height - 1, y + radius);
        for (let x = 0; x < width; x++) {
            if (data[y * width + x] === 0) continue;
            const x0 = Math.max(0, x - radius);
            const x1 = Math.min(width - 1, x + radius);
            for (let ny = y0; ny <= y1; ny++) {
                const rowOffset = ny * width;
                for (let nx = x0; nx <= x1; nx++) {
                    out[rowOffset + nx] = 1;
                }
            }
        }
    }

    return { width, height, data: out };
}

function histogramSimilarity(a: NormalizedGrid, b: NormalizedGrid): number {
    const { width, height } = a;
    const ax = new Float64Array(width);
    const bx = new Float64Array(width);
    const ay = new Float64Array(height);
    const by = new Float64Array(height);
    let sumA = 0;
    let sumB = 0;

    for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
            const va = a.data[row + x] > 0 ? 1 : 0;
            const vb = b.data[row + x] > 0 ? 1 : 0;
            if (va) {
                ax[x]++;
                ay[y]++;
                sumA++;
            }
            if (vb) {
                bx[x]++;
                by[y]++;
                sumB++;
            }
        }
    }

    if (sumA === 0 || sumB === 0) return 0;

    let xDiff = 0;
    for (let x = 0; x < width; x++) {
        xDiff += Math.abs(ax[x] / sumA - bx[x] / sumB);
    }
    let yDiff = 0;
    for (let y = 0; y < height; y++) {
        yDiff += Math.abs(ay[y] / sumA - by[y] / sumB);
    }

    const xSim = Math.max(0, 1 - 0.5 * xDiff);
    const ySim = Math.max(0, 1 - 0.5 * yDiff);
    return (xSim + ySim) / 2;
}

/**
 * Computes similarity (0..100) between a drawn normalized grid and a reference
 * vocabulary grid using dilated Dice/F1 overlap and projection histograms.
 */
export function scoreGridSimilarity(drawn: NormalizedGrid, reference: NormalizedGrid): number {
    if (drawn.width !== reference.width || drawn.height !== reference.height) return 0;

    const drawnCount = countActive(drawn);
    const refCount = countActive(reference);
    if (drawnCount === 0 || refCount === 0) return 0;

    const dilatedRef = dilateGrid(reference, 1);
    const dilatedDrawn = dilateGrid(drawn, 1);

    let drawnHits = 0;
    let refHits = 0;
    for (let i = 0; i < drawn.data.length; i++) {
        if (drawn.data[i] > 0 && dilatedRef.data[i] > 0) drawnHits++;
        if (reference.data[i] > 0 && dilatedDrawn.data[i] > 0) refHits++;
    }

    const precision = drawnHits / drawnCount;
    const recall = refHits / refCount;
    const dice = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const proj = histogramSimilarity(drawn, reference);

    return Math.round(Math.max(0, Math.min(100, (0.72 * dice + 0.28 * proj) * 100)));
}

/**
 * Evaluates spatial overlap (0..100) for Guided Word Tracing without cropping,
 * checking how accurately user strokes trace over the target template.
 */
export function evaluateGuidedTrace(rawDrawn: NormalizedGrid, rawTarget: NormalizedGrid): number {
    if (rawDrawn.width !== rawTarget.width || rawDrawn.height !== rawTarget.height) return 0;

    const drawnCount = countActive(rawDrawn);
    const targetCount = countActive(rawTarget);
    if (drawnCount === 0 || targetCount === 0) return 0;

    const dilatedTarget = dilateGrid(rawTarget, 2);
    const dilatedDrawn = dilateGrid(rawDrawn, 2);

    let drawnHits = 0;
    let targetHits = 0;
    for (let i = 0; i < rawDrawn.data.length; i++) {
        if (rawDrawn.data[i] > 0 && dilatedTarget.data[i] > 0) drawnHits++;
        if (rawTarget.data[i] > 0 && dilatedDrawn.data[i] > 0) targetHits++;
    }

    const precision = drawnHits / drawnCount;
    const coverage = targetHits / targetCount;
    const f1 = coverage + precision > 0 ? (2 * coverage * precision) / (coverage + precision) : 0;
    const combined = 0.6 * coverage + 0.4 * f1;

    return Math.round(Math.max(0, Math.min(100, combined * 100)));
}

function levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    let prev = new Array<number>(n + 1);
    let curr = new Array<number>(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;

    for (let i = 1; i <= m; i++) {
        curr[0] = i;
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        }
        [prev, curr] = [curr, prev];
    }
    return prev[n];
}

function normalizeForMatch(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function textSimilarity(rawText: string, label: string): number {
    const a = normalizeForMatch(rawText);
    const b = normalizeForMatch(label);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (b.startsWith(a) || a.startsWith(b)) return 0.85;
    if (b.includes(a) || a.includes(b)) return 0.75;
    const maxLen = Math.max(a.length, b.length);
    return Math.max(0, 1 - levenshtein(a, b) / maxLen);
}

/**
 * Ranks board vocabulary candidates by combined OCR text similarity and
 * visual grid similarity, returning up to 5 unique candidate labels.
 */
export function rankVocabularyByTextAndGrid(
    rawText: string,
    drawnGrid: NormalizedGrid,
    candidates: VocabularyCandidate[],
): string[] {
    if (!candidates.length) return [];
    const hasText = normalizeForMatch(rawText).length > 0;

    const scored = candidates.map(candidate => {
        const gScore = scoreGridSimilarity(drawnGrid, candidate.grid) / 100;
        const tScore = hasText ? textSimilarity(rawText, candidate.label) : 0;
        const total = hasText ? 0.75 * tScore + 0.25 * gScore : gScore;
        return { label: candidate.label, total };
    });

    scored.sort((a, b) => b.total - a.total);

    const seen = new Set<string>();
    const results: string[] = [];
    for (const item of scored) {
        const key = item.label.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        results.push(item.label);
        if (results.length >= 5) break;
    }
    return results;
}

function cleanOcrText(raw: string): string {
    return raw
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "")
        .trim();
}

async function recognizeWithPuter(imageDataUrl: string): Promise<string> {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw new Error("Offline");
    }
    const { puter } = await import("@heyputer/puter.js");
    return await puter.ai.img2txt(imageDataUrl);
}

async function recognizeWithTesseract(imageDataUrl: string): Promise<string> {
    const mod = await import("tesseract.js");
    const tesseract = typeof mod.recognize === "function" ? mod : mod.default;
    const result = await tesseract.recognize(imageDataUrl, "eng");
    return result?.data?.text ?? "";
}

export class ScribbleOcrService implements IScribbleOcrService {
    constructor(
        private readonly puterRecognize: (imageDataUrl: string) => Promise<string> = recognizeWithPuter,
        private readonly tesseractRecognize: (imageDataUrl: string) => Promise<string> = recognizeWithTesseract,
    ) {}

    private recognizeLocal(
        request: ScribbleOcrRequest,
        traceScore: number | null,
    ): { text: string; suggestions: string[]; confidenceScore: number | null } {
        if (!request.candidates.length) {
            const fallbackLabel =
                request.mode === "tracing" && request.targetCandidate && traceScore !== null && traceScore >= 35
                    ? request.targetCandidate.label
                    : "";
            return {
                text: fallbackLabel,
                suggestions: fallbackLabel ? [fallbackLabel] : [],
                confidenceScore: traceScore,
            };
        }

        const scored = request.candidates.map(candidate => {
            let score = scoreGridSimilarity(request.drawnGrid, candidate.grid);
            if (
                request.mode === "tracing" &&
                request.targetCandidate?.id === candidate.id &&
                traceScore !== null &&
                traceScore >= 35
            ) {
                score = Math.max(score, Math.min(100, traceScore + 20));
            }
            return { candidate, score };
        });

        scored.sort((a, b) => b.score - a.score);

        const seen = new Set<string>();
        const suggestions: string[] = [];
        for (const entry of scored) {
            const key = entry.candidate.label.trim().toLowerCase();
            if (!key || seen.has(key)) continue;
            seen.add(key);
            suggestions.push(entry.candidate.label);
            if (suggestions.length >= 5) break;
        }

        const top = scored[0];
        return {
            text: top?.candidate.label ?? "",
            suggestions,
            confidenceScore: traceScore ?? (top ? top.score : null),
        };
    }

    async recognize(request: ScribbleOcrRequest): Promise<ScribbleOcrResult> {
        const traceScore =
            request.mode === "tracing" && request.targetCandidate
                ? evaluateGuidedTrace(
                      request.rawDrawnGrid ?? request.drawnGrid,
                      request.rawTargetGrid ?? request.targetCandidate.grid,
                  )
                : null;

        if (request.engine === "local") {
            const local = this.recognizeLocal(request, traceScore);
            return {
                engine: "local",
                text: local.text,
                suggestions: local.suggestions,
                traceScore: local.confidenceScore,
                fallbackUsed: false,
                notice: local.text
                    ? "Matched locally against board vocabulary."
                    : "No board vocabulary words available to match.",
            };
        }

        if (request.engine === "puter") {
            try {
                const raw = await this.puterRecognize(request.imageDataUrl);
                const cleaned = cleanOcrText(raw);
                if (cleaned) {
                    const suggestions = rankVocabularyByTextAndGrid(
                        cleaned,
                        request.drawnGrid,
                        request.candidates,
                    );
                    return {
                        engine: "puter",
                        text: cleaned,
                        suggestions,
                        traceScore,
                        fallbackUsed: false,
                        notice: "Recognized via Puter.js Cloud OCR.",
                    };
                }
            } catch {
                // Fall through to local vocabulary matching
            }

            const local = this.recognizeLocal(request, traceScore);
            return {
                engine: "puter",
                text: local.text,
                suggestions: local.suggestions,
                traceScore: traceScore ?? local.confidenceScore,
                fallbackUsed: true,
                notice: local.text
                    ? "Puter.js Cloud OCR unavailable or returned no text — used local vocabulary match."
                    : "Puter.js Cloud OCR unavailable — type or edit the word below.",
            };
        }

        // Tesseract.js offline OCR
        try {
            const raw = await this.tesseractRecognize(request.imageDataUrl);
            const cleaned = cleanOcrText(raw);
            if (cleaned) {
                const suggestions = rankVocabularyByTextAndGrid(
                    cleaned,
                    request.drawnGrid,
                    request.candidates,
                );
                return {
                    engine: "tesseract",
                    text: cleaned,
                    suggestions,
                    traceScore,
                    fallbackUsed: false,
                    notice: "Recognized via Tesseract.js Offline OCR.",
                };
            }
        } catch {
            // Fall through to local vocabulary matching
        }

        const local = this.recognizeLocal(request, traceScore);
        return {
            engine: "tesseract",
            text: local.text,
            suggestions: local.suggestions,
            traceScore: traceScore ?? local.confidenceScore,
            fallbackUsed: true,
            notice: local.text
                ? "Tesseract.js OCR returned no text — used local vocabulary match."
                : "Tesseract.js OCR returned no text — type or edit the word below.",
        };
    }
}

export const scribbleOcrService: IScribbleOcrService = new ScribbleOcrService();
