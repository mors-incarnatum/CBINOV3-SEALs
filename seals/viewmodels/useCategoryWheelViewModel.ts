"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBoardStore } from "@/store/BoardProvider";
function point(radius: number, angle: number) { const a = angle * Math.PI / 180; return `${150 + radius * Math.cos(a)} ${150 + radius * Math.sin(a)}`; }
function ring(start: number, end: number) { const a = start + 2, b = end - 2, large = b - a > 180 ? 1 : 0; return `M${point(140, a)} A140 140 0 ${large} 1 ${point(140, b)} L${point(64, b)} A64 64 0 ${large} 0 ${point(64, a)}Z`; }
export function useCategoryWheelViewModel(onClose: () => void) {
    const boards = useBoardStore(s => s.boards), order = useBoardStore(s => s.catalogOrder), router = useRouter(), [more, setMore] = useState(false);
    const ids = order.length > 8 ? [...order.slice(0, 7), "more"] : order;
    const sectors = ids.map((id, i) => { const start = -90 + i * 360 / ids.length, end = start + 360 / ids.length, mid = (start + end) / 2 * Math.PI / 180; return { id, board: boards[id], path: ring(start, end), x: 150 + 103 * Math.cos(mid), y: 150 + 103 * Math.sin(mid) }; });
    const choose = (id: string) => { if (id === "more")
        setMore(true);
    else {
        router.push(`/board/${encodeURIComponent(id)}`);
        onClose();
    } };
    return { state: { sectors, more, catalogs: order.map(id => boards[id]) }, actions: { choose, onKeyDown: (e: React.KeyboardEvent, i: number) => { if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                choose(ids[i]);
            } const delta = ["ArrowRight", "ArrowDown"].includes(e.key) ? 1 : ["ArrowLeft", "ArrowUp"].includes(e.key) ? -1 : 0; if (delta || e.key === "Home" || e.key === "End") {
                e.preventDefault();
                const next = e.key === "Home" ? 0 : e.key === "End" ? ids.length - 1 : (i + delta + ids.length) % ids.length;
                e.currentTarget.parentElement?.querySelectorAll<SVGGElement>(".wheel-sector")[next]?.focus();
            } } } };
}
