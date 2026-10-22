"use client";
import { useEffect, useRef } from "react";
export default function Modal({ children, label, onClose, style, className = "" }: { children: React.ReactNode; label: string; onClose: () => void; style?: React.CSSProperties; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; const previous = document.activeElement as HTMLElement | null; dialog.showModal(); return () => { dialog.close(); previous?.focus(); }; }, []);
  return <dialog ref={ref} aria-label={label} style={style} className={`backdrop:bg-slate-900/30 ${className}`} onContextMenu={event => event.preventDefault()} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>{children}</dialog>;
}
