"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useBoardStore } from "@/store/BoardProvider";
import { useSentenceContext } from "./useBoardShellViewModel";
import { useEditContext } from "./useEditModeViewModel";
import type { Tile } from "@/lib/board";
export function useTileInteractionViewModel(tile: Tile | undefined, hidden: boolean, onEdit: () => void, onMove: (() => void) | undefined) {
    const router = useRouter(), sentence = useSentenceContext(), edit = useEditContext(), config = useBoardStore(s => s.accessConfig);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null), start = useRef<{
        x: number;
        y: number;
    } | null>(null), held = useRef(false);
    const cancel = () => { if (timer.current)
        clearTimeout(timer.current); timer.current = null; };
    useEffect(() => () => { if (timer.current)
        clearTimeout(timer.current); }, []);
    const activate = () => { if (held.current) {
        held.current = false;
        return;
    } if (onMove) {
        onMove();
        return;
    } if (edit.state.isEditMode) {
        onEdit();
        return;
    } if (!tile || hidden)
        return; if (tile.kind === "folder")
        router.push(`/board/${encodeURIComponent(tile.targetBoardId || "")}`);
    else
        sentence.actions.onTileActivate(tile); };
    return { onClick: activate, onPointerDown: (e: React.PointerEvent) => { if (e.button !== 0)
            return; cancel(); held.current = false; start.current = { x: e.clientX, y: e.clientY }; if (config.longPressToEdit)
            timer.current = setTimeout(() => { held.current = true; if (edit.state.isEditMode)
                onEdit();
            else
                edit.actions.enter(); }, config.holdDurationMs); }, onPointerMove: (e: React.PointerEvent) => { if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > config.moveTolerancePx) {
            cancel();
            held.current = true;
        } }, onPointerUp: cancel, onPointerLeave: cancel, onPointerCancel: () => { cancel(); held.current = true; }, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ")
            held.current = false; if (e.key === "F2") {
            e.preventDefault();
            if (edit.state.isEditMode)
                onEdit();
            else
                edit.actions.enter();
        } } };
}
