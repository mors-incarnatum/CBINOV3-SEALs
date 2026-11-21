"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { isGuardianRole } from "@/models/auth";
import type { Tile } from "@/lib/board";
import { chatSocketService } from "@/services/chat/chatSocketService";
import { useBoardStore } from "@/store/BoardProvider";
import { useSentenceViewModel } from "./useSentenceViewModel";
import { useEditModeViewModel } from "./useEditModeViewModel";

export type ShellPanel = "settings" | "catalogs" | "layout" | "scribble" | "chat" | null;

const DEFAULT_PINNED_TILE_IDS = ["n-5", "n-3", "n-1", "p-4", "f-1"] as const;

export const SentenceContext = createContext<ReturnType<typeof useSentenceViewModel> | null>(null);

export function useSentenceContext() {
    const vm = useContext(SentenceContext);
    if (!vm) throw new Error("Sentence provider required");
    return vm;
}

export function useBoardShellViewModel() {
    const sentence = useSentenceViewModel();
    const edit = useEditModeViewModel();
    const pathname = usePathname();

    const currentUser = useBoardStore(s => s.currentUser);
    const activeProfileName = useBoardStore(s => s.activeProfileName);
    const storageStatus = useBoardStore(s => s.storageStatus);
    const storageError = useBoardStore(s => s.storageError);
    const dirty = useBoardStore(s => s.dirty);
    const featureFlags = useBoardStore(s => s.featureFlags);
    const tiles = useBoardStore(s => s.tiles);
    const boards = useBoardStore(s => s.boards);
    const tileAppearance = useBoardStore(s => s.tileAppearance);
    const pinnedTileIds = useBoardStore(s => s.experimentalData?.pinnedTileIds);
    const chatMessages = useBoardStore(s => s.experimentalData?.chatMessages);
    const receiveChatMessages = useBoardStore(s => s.receiveChatMessages);
    const clearStorageError = useBoardStore(s => s.clearStorageError);
    const storeLogout = useBoardStore(s => s.logout);

    const [panel, setPanelState] = useState<ShellPanel>(() => (pathname === "/chat" ? "chat" : null));
    const [wheel, setWheel] = useState<{ x: number; y: number } | null>(null);
    const lastBoardPathRef = useRef(pathname.startsWith("/board") ? pathname : "/board");

    useEffect(() => {
        if (pathname.startsWith("/board")) {
            lastBoardPathRef.current = pathname;
        }
    }, [pathname]);

    useEffect(() => {
        const handlePopState = () => {
            setPanelState(window.location.pathname === "/chat" ? "chat" : null);
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    const isGuardian = isGuardianRole(currentUser?.role);
    const wheelEnabled = featureFlags?.categoryWheel ?? false;
    const pinnedEnabled = featureFlags?.pinnedVocabulary ?? false;

    const effectivePinnedIds =
        pinnedTileIds && pinnedTileIds.length > 0 ? pinnedTileIds : DEFAULT_PINNED_TILE_IDS;
    const pinnedTiles: Tile[] = pinnedEnabled
        ? effectivePinnedIds.map(id => tiles[id]).filter((t): t is Tile => Boolean(t))
        : [];

    const activePanel: ShellPanel =
        !isGuardian && (panel === "settings" || panel === "catalogs" || panel === "layout") ? null : panel;
    const isChatOpen = activePanel === "chat" && (Boolean(featureFlags?.parentChildChat) || pathname === "/chat");

    const chatMessagesRef = useRef(chatMessages);
    useEffect(() => {
        chatMessagesRef.current = chatMessages;
    }, [chatMessages]);

    const chatEnabled = Boolean(currentUser) && (Boolean(featureFlags?.parentChildChat) || isChatOpen);
    useEffect(() => {
        if (!chatEnabled) return;
        return chatSocketService.subscribe({
            onMessages: receiveChatMessages,
            getLocalMessages: () => chatMessagesRef.current ?? [],
        });
    }, [chatEnabled, receiveChatMessages]);

    const setPanel = (next: ShellPanel) => {
        if (!isGuardian && (next === "settings" || next === "catalogs" || next === "layout")) return;
        if (typeof window !== "undefined") {
            if (next === "chat" && window.location.pathname !== "/chat") {
                if (window.location.pathname.startsWith("/board")) {
                    lastBoardPathRef.current = window.location.pathname;
                }
                window.history.pushState(null, "", "/chat");
            } else if (next !== "chat" && window.location.pathname === "/chat") {
                window.history.pushState(null, "", lastBoardPathRef.current || "/board");
            }
        }
        setPanelState(next);
    };

    const toggleChat = () => setPanel(activePanel === "chat" ? null : "chat");

    const logout = () => {
        if (typeof window !== "undefined" && window.location.pathname === "/chat") {
            window.history.pushState(null, "", "/board");
        }
        setPanelState(null);
        setWheel(null);
        edit.actions.lock();
        storeLogout();
    };

    return {
        sentence,
        edit,
        state: {
            currentUser,
            isGuardian,
            panel: activePanel,
            isChatOpen,
            wheel: wheelEnabled ? wheel : null,
            boardId: decodeURIComponent(pathname.split("/")[2] || "home"),
            activeProfileName,
            storageStatus,
            storageError,
            dirty,
            featureFlags,
            wheelEnabled,
            pinnedTiles,
            boards,
            tileAppearance,
        },
        actions: {
            setPanel,
            toggleChat,
            logout,
            closeWheel: () => setWheel(null),
            openCatalogs: () => {
                setWheel(null);
                if (isGuardian) {
                    setPanelState("catalogs");
                }
            },
            clearStorageError,
            onContextMenu: (e: React.MouseEvent) => {
                if (!wheelEnabled || isChatOpen) return;
                e.preventDefault();
                setWheel({ x: e.clientX, y: e.clientY });
            },
            onKeyDown: (e: React.KeyboardEvent) => {
                if (!wheelEnabled || isChatOpen) return;
                if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
                    e.preventDefault();
                    setWheel({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
                }
            },
        },
    };
}
