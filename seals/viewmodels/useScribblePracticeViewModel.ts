"use client";

import { useRef, useState, type PointerEvent } from "react";
import { useBoardStore } from "@/store/BoardProvider";
import { useSentenceContext } from "@/viewmodels/useBoardShellViewModel";

const EMPTY_DRAFTS: string[] = [];

/**
 * ViewModel for the Scribble Practice modal, encapsulating canvas drawing state,
 * mock OCR recognition state, draft history, and sentence activation.
 */
export function useScribblePracticeViewModel(onClose: () => void) {
    const sentence = useSentenceContext();
    const drafts = useBoardStore(s => s.experimentalData?.scribbleDrafts) ?? EMPTY_DRAFTS;
    const addScribbleDraft = useBoardStore(s => s.addScribbleDraft);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawing = useRef(false);
    const [recognizedText, setRecognizedText] = useState("");
    const [hasStroke, setHasStroke] = useState(false);

    const getCanvasContext = () => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const ctx = canvas.getContext("2d");
        return ctx ? { canvas, ctx } : null;
    };

    const getPointerPoint = (canvas: HTMLCanvasElement, e: PointerEvent<HTMLCanvasElement>) => {
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    };

    const startDraw = (e: PointerEvent<HTMLCanvasElement>) => {
        const target = getCanvasContext();
        if (!target) return;
        const { x, y } = getPointerPoint(target.canvas, e);
        drawing.current = true;
        target.ctx.beginPath();
        target.ctx.moveTo(x, y);
        setHasStroke(true);
    };

    const moveDraw = (e: PointerEvent<HTMLCanvasElement>) => {
        if (!drawing.current) return;
        const target = getCanvasContext();
        if (!target) return;
        const { x, y } = getPointerPoint(target.canvas, e);
        target.ctx.lineWidth = 3;
        target.ctx.lineCap = "round";
        target.ctx.strokeStyle = "#0f172a";
        target.ctx.lineTo(x, y);
        target.ctx.stroke();
    };

    const endDraw = () => {
        drawing.current = false;
    };

    const clearCanvas = () => {
        const target = getCanvasContext();
        if (!target) return;
        target.ctx.clearRect(0, 0, target.canvas.width, target.canvas.height);
        setHasStroke(false);
    };

    const mockRecognize = () => {
        if (!hasStroke) return;
        if (!recognizedText.trim()) {
            setRecognizedText("tubig");
        }
    };

    const addToSentence = () => {
        const text = recognizedText.trim();
        if (!text) return;
        addScribbleDraft(text);
        sentence.actions.onTileActivate({
            id: `scribble-${Date.now()}`,
            kind: "word",
            label: text,
            spokenText: text,
            iconName: null,
            categoryId: "needs",
            isCustom: true,
        });
        onClose();
    };

    return {
        canvasRef,
        state: {
            drafts,
            recognizedText,
            hasStroke,
        },
        actions: {
            setRecognizedText,
            startDraw,
            moveDraw,
            endDraw,
            clearCanvas,
            mockRecognize,
            addToSentence,
        },
    };
}
