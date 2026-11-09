"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { createBoardStore, type BoardState, type BoardStore } from "./useBoardStore";
const BoardContext = createContext<BoardStore | null>(null);
export function BoardProvider({ children }: {
    children: React.ReactNode;
}) {
    const [store] = useState(createBoardStore);
    const [ready, setReady] = useState(false);
    useEffect(() => { void Promise.resolve(store.persist?.rehydrate()).catch(() => undefined).finally(() => setReady(true)); }, [store]);
    return <BoardContext.Provider value={store}>{ready ? children : <div role="status">Loading board…</div>}</BoardContext.Provider>;
}
export function useBoardStore<T>(selector: (state: BoardState) => T): T {
    const store = useContext(BoardContext);
    if (!store)
        throw new Error("BoardProvider is required");
    return useStore(store, selector);
}
export function useBoardSelector<T>(selector: (state: BoardState) => T): T {
    return useBoardStore(useShallow(selector));
}
