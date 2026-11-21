"use client";
import { useEffect, useRef } from "react";
import type { ChatConnectionStatus } from "@/services/chat/chatSocketService";
import { useParentChatViewModel } from "@/viewmodels/useParentChatViewModel";

const CONNECTION_STATUS_META: Record<
    ChatConnectionStatus,
    { label: string; dotClass: string }
> = {
    connected: { label: "Live Socket", dotClass: "bg-emerald-400" },
    connecting: { label: "Connecting…", dotClass: "bg-amber-300 animate-pulse" },
    error: { label: "Offline", dotClass: "bg-rose-400" },
    disconnected: { label: "Offline", dotClass: "bg-rose-400" },
    unconfigured: { label: "Local Mode", dotClass: "bg-slate-300" },
};

export default function ParentChatModal({ onClose }: { onClose: () => void }) {
    const { state: s, actions: a } = useParentChatViewModel();
    const bottomRef = useRef<HTMLDivElement>(null);
    const statusMeta = CONNECTION_STATUS_META[s.connectionStatus];

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [s.messages.length]);

    return (
        <section
            aria-label="Parent-child chat"
            className="flex-1 min-h-0 w-full rounded-xl border border-slate-300 bg-white p-0 shadow-xs overflow-hidden flex flex-col"
        >
            <div className="bg-[#0369a1] text-white px-3.5 py-2.5 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold shrink-0">
                        G
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm font-bold leading-tight truncate">
                            Parent–child chat
                        </h2>
                        <p className="text-[11px] text-sky-100 leading-tight truncate flex items-center gap-1.5">
                            <span
                                aria-hidden="true"
                                className={`inline-block w-2 h-2 rounded-full shrink-0 ${statusMeta.dotClass}`}
                            />
                            <span className="truncate">
                                {statusMeta.label} · {s.senderRole === "guardian" ? "Sending as Guardian" : "Sending as Child"}
                            </span>
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    {(s.connectionStatus === "error" || s.connectionStatus === "disconnected") && (
                        <button
                            type="button"
                            onClick={a.reconnect}
                            className="px-2 py-1 rounded-full bg-white/15 hover:bg-white/25 text-[11px] font-semibold text-white transition-colors cursor-pointer"
                        >
                            Reconnect
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close chat"
                        className="w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center text-white/90 hover:text-white transition-colors shrink-0 cursor-pointer"
                    >
                        ✕
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-slate-50">
                <p className="text-[11px] text-slate-500 text-center bg-slate-200/70 rounded-lg px-2.5 py-1.5">
                    {s.connectionStatus === "unconfigured"
                        ? "Local mode (Supabase is not configured). Composing in the AAC board never sends automatically—tap Send explicitly."
                        : "Real-time socket chat. Composing in the AAC board never sends automatically—tap Send explicitly."}
                </p>

                {s.messages.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">
                        No messages yet.
                    </p>
                ) : (
                    s.messages.map(m => {
                        const isOwn = m.sender === s.senderRole;
                        const otherBadge = m.sender === "guardian" ? "G" : "C";
                        const otherTitle = m.sender === "guardian" ? "Guardian" : "Child";
                        return (
                            <div
                                key={m.id}
                                className={`flex items-end gap-1.5 ${isOwn ? "justify-end" : "justify-start"}`}
                            >
                                {!isOwn && (
                                    <div
                                        className="w-6 h-6 rounded-full bg-slate-300 text-slate-700 text-[11px] font-bold flex items-center justify-center shrink-0"
                                        title={otherTitle}
                                    >
                                        {otherBadge}
                                    </div>
                                )}
                                <div
                                    className={`px-3 py-1.5 max-w-[78%] text-sm leading-snug break-words shadow-xs ${
                                        isOwn
                                            ? "bg-[#0369a1] text-white rounded-2xl rounded-br-sm"
                                            : "bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-bl-sm"
                                    }`}
                                >
                                    {m.text}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={bottomRef} />
            </div>

            <div className="border-t border-slate-200 bg-white px-2.5 py-2 flex items-center gap-1.5 shrink-0">
                <button
                    type="button"
                    onClick={a.copyCurrentSentence}
                    disabled={s.isSentenceEmpty}
                    title="Copy current sentence"
                    aria-label="Copy current sentence"
                    className="w-8 h-8 rounded-full text-sky-700 hover:bg-sky-50 disabled:text-slate-300 disabled:hover:bg-transparent flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                </button>
                <input
                    value={s.draft}
                    onChange={e => a.setDraft(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter" && s.draft.trim()) {
                            e.preventDefault();
                            a.sendMessage();
                        }
                    }}
                    placeholder="Aa"
                    aria-label="Message to send"
                    className="flex-1 min-w-0 bg-slate-100 hover:bg-slate-200/70 focus:bg-white border border-transparent focus:border-sky-500 rounded-full px-3.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition-colors"
                />
                <button
                    type="button"
                    disabled={!s.draft.trim()}
                    onClick={a.sendMessage}
                    title="Send message"
                    aria-label="Send message"
                    className="w-8 h-8 rounded-full bg-[#0369a1] text-white flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-sky-800 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current translate-x-[1px]">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                </button>
            </div>
        </section>
    );
}
