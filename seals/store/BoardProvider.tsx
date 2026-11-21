"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { ACTIVE_PROFILE_INDEX_KEY, PROFILE_KEY_PREFIX } from "@/services/storage/localProfileService";
import { createBoardStore, type BoardState, type BoardStore } from "./useBoardStore";

const BoardContext = createContext<BoardStore | null>(null);

export function BoardProvider({ children }: { children: React.ReactNode }) {
    const [store] = useState(() => createBoardStore());
    const [ready, setReady] = useState(false);

    useEffect(() => {
        void store
            .getState()
            .hydrateFromStorage()
            .catch(() => undefined)
            .finally(() => setReady(true));

        const handleStorage = (event: StorageEvent) => {
            if (event.key !== null && event.key !== ACTIVE_PROFILE_INDEX_KEY && !event.key.startsWith(PROFILE_KEY_PREFIX)) return;
            void store.getState().hydrateFromStorage().catch(() => undefined);
        };
        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, [store]);

    return (
        <BoardContext.Provider value={store}>
            {ready ? children : <div role="status">Loading board…</div>}
        </BoardContext.Provider>
    );
}

export function useBoardStore<T>(selector: (state: BoardState) => T): T {
    const store = useContext(BoardContext);
    if (!store) throw new Error("BoardProvider is required");
    return useStore(store, selector);
}

export function useBoardSelector<T>(selector: (state: BoardState) => T): T {
    return useBoardStore(useShallow(selector));
}
