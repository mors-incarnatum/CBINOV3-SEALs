"use client";
import { useModalViewModel } from "@/viewmodels/useModalViewModel";
export default function Modal({ children, label, onClose, style, className = "" }: {
    children: React.ReactNode;
    label: string;
    onClose: () => void;
    style?: React.CSSProperties;
    className?: string;
}) {
    const vm = useModalViewModel(onClose);
    return <dialog {...vm} aria-label={label} style={style} className={`backdrop:bg-slate-900/30 ${className}`}>{children}</dialog>;
}
