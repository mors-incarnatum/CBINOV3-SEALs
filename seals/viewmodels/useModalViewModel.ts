"use client";
import { useEffect, useRef } from "react";
export function useModalViewModel(onClose: () => void) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => { const dialog = ref.current; if (!dialog)
        return; const previous = document.activeElement as HTMLElement | null; dialog.showModal(); return () => { dialog.close(); previous?.focus(); }; }, []);
    return { ref, onCancel: (event: React.SyntheticEvent) => { event.preventDefault(); onClose(); }, onContextMenu: (event: React.MouseEvent) => event.preventDefault(), onClick: (event: React.MouseEvent<HTMLDialogElement>) => { if (event.target !== event.currentTarget)
            return; const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)
            onClose(); } };
}
