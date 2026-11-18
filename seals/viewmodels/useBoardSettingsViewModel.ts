"use client";
import { useState } from "react";
import { useBoardStore } from "@/store/BoardProvider";
import { clampGrid, inBounds, type GridConfig } from "@/lib/board";
export function useBoardSettingsViewModel(boardId: string) {
    const boards = useBoardStore(s => s.boards);
    const global = useBoardStore(s => s.gridConfig);
    const globalMode = useBoardStore(s => s.layoutMode);
    const appearance = useBoardStore(s => s.tileAppearance);
    const speech = useBoardStore(s => s.speechConfig);
    const access = useBoardStore(s => s.accessConfig);

    const applyBoardSettings = useBoardStore(s => s.applyBoardSettings);
    const setSpeech = useBoardStore(s => s.setSpeechConfig);
    const setAccess = useBoardStore(s => s.setAccessConfig);

    const [scope, setScope] = useState("global");
    const [selected, setSelected] = useState(boards[boardId] ? boardId : "home");
    const [draft, setDraft] = useState(global);
    const [draftMode, setDraftMode] = useState<"manual" | "automatic">(globalMode);
    const [draftAppearance, setDraftAppearance] = useState(appearance);
    const [useGlobal, setUseGlobal] = useState(false);
    const [pin, setPin] = useState(access.editPin || "");
    const [saved, setSaved] = useState(false);
    const [tab, setTab] = useState<"layout" | "speech">("layout");
    const [pinSaved, setPinSaved] = useState(false);

    const selectedBoard = boards[selected];

    const overflow = Object.values(boards)
        .filter(b =>
            scope === "global"
                ? !b.gridOverride
                : b.id === selected
        )
        .reduce(
            (n, b) =>
                n +
                b.pages.reduce(
                    (m, p) =>
                        m +
                        Object.keys(p.cells).filter(
                            k => !inBounds(k, draft)
                        ).length,
                    0
                ),
            0
        );

    const resetTileDimensions = () => {
        setDraftAppearance(current => ({
            ...current,
            tileWidth: 50,
            tileHeight: 50
        }));
    };

    const resetDrafts = (nextScope: string, nextSelected: string) => {
        const board = boards[nextSelected];

        setDraft(
            nextScope === "global"
                ? global
                : board?.gridOverride ?? global
        );

        setDraftMode(
            nextScope === "global"
                ? globalMode
                : board?.layoutModeOverride ?? globalMode
        );

        setDraftAppearance(appearance);
        setUseGlobal(false);
        setSaved(false);
    };

    return {
        state: {
            tab,
            pinSaved,
            boards,
            scope,
            selected,
            draft,
            draftMode,
            appearance: draftAppearance,
            speech,
            access,
            pin,
            saved,
            useGlobal,
            overflow,
            preview: Array.from({
                length: draft.rows * draft.cols
            })
        },

        actions: {
            setTab,

            setScope: (value: string) => {
                setScope(value);
                resetDrafts(value, selected);
            },

            selectBoard: (id: string) => {
                setSelected(id);
                resetDrafts(scope, id);
            },

            setDraft: (grid: GridConfig) => {
                const nextGrid = clampGrid(grid);

                setDraft(nextGrid);
                resetTileDimensions();
                setSaved(false);
            },

            setDraftMode: (mode: "manual" | "automatic") => {
                if (mode !== draftMode) {
                    resetTileDimensions();
                }

                setDraftMode(mode);
                setSaved(false);
            },

            swapRowsCols: () => {
                setDraft({
                    rows: draft.cols,
                    cols: draft.rows
                });

                resetTileDimensions();
                setSaved(false);
            },

            setAppearance: (value: typeof appearance) => {
                setDraftAppearance(value);
                setSaved(false);
            },

            setUseGlobal: (value: boolean) => {
                setUseGlobal(value);
                setSaved(false);
            },

            apply: () => {
                applyBoardSettings(
                    draft,
                    draftAppearance,
                    draftMode,
                    scope === "global" ? undefined : selected,
                    scope !== "global" && useGlobal
                );

                setSaved(true);
            },

            useGlobal: () => {
                setUseGlobal(true);
                setSaved(false);
            },

            setSpeech,
            setAccess,

            setPin: (value: string) => {
                setPin(value);
                setPinSaved(false);
            },

            savePin: () => {
                setAccess({
                    editPin: pin.trim() || null
                });

                setPinSaved(true);
            }
        }
    };
}