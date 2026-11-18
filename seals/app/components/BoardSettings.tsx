"use client";
import { useEffect, useState } from "react";
import { GRID_PRESETS } from "@/lib/board";
import { useBoardSettingsViewModel } from "@/viewmodels/useBoardSettingsViewModel";
import { useEditContext } from "@/viewmodels/useEditModeViewModel";
import type { BoardData } from "@/store/useBoardStore";
import Modal from "./Modal";

function getDimension(value: number | undefined) {
    if (value === undefined || value === 1) return 50;
    if (value > 1) return Math.max(1, Math.min(100, Math.round(value)));
    return Math.max(1, Math.min(100, Math.round(value * 100)));
}

export default function BoardSettings({
    boardId,
    onClose,
    initialTab = "speech"
}: {
    boardId: string;
    onClose: () => void;
    initialTab?: "layout" | "speech";
}) {
    const { state: s, actions: a } = useBoardSettingsViewModel(boardId);
    const edit = useEditContext();

    const widthUnits = getDimension(s.appearance.tileWidth);
    const heightUnits = getDimension(s.appearance.tileHeight);

    const [widthInput, setWidthInput] = useState(String(widthUnits));
    const [heightInput, setHeightInput] = useState(String(heightUnits));

    useEffect(() => {
        setWidthInput(String(widthUnits));
    }, [widthUnits]);

    useEffect(() => {
        setHeightInput(String(heightUnits));
    }, [heightUnits]);

    const updateDimension = (
        dimension: "tileWidth" | "tileHeight",
        value: string
    ) => {
        if (!/^\d{0,3}$/.test(value)) return;

        if (dimension === "tileWidth") setWidthInput(value);
        else setHeightInput(value);

        if (value === "") return;

        const number = Number(value);
        if (number < 1) return;

        a.setAppearance({
            ...s.appearance,
            [dimension]: Math.min(100, number)
        });
    };

    const finishDimensionInput = (
        dimension: "tileWidth" | "tileHeight"
    ) => {
        const value = dimension === "tileWidth" ? widthInput : heightInput;
        const currentValue = dimension === "tileWidth" ? widthUnits : heightUnits;
        const number = Math.max(
            1,
            Math.min(100, value === "" ? currentValue : Number(value))
        );

        a.setAppearance({
            ...s.appearance,
            [dimension]: number
        });

        if (dimension === "tileWidth") setWidthInput(String(number));
        else setHeightInput(String(number));
    };

    const changeDimension = (
        dimension: "tileWidth" | "tileHeight",
        value: number
    ) => {
        a.setAppearance({
            ...s.appearance,
            [dimension]: value
        });
    };

    return (
        <Modal
            label={initialTab === "layout" ? "Board layout" : "Board settings"}
            onClose={onClose}
            className="editor-modal"
        >
            <div className="modal-heading">
                <h2>
                    {initialTab === "layout"
                        ? "Board size & appearance"
                        : "Speech & access"}
                </h2>
                <button onClick={onClose} aria-label="Close settings">
                    ✕
                </button>
            </div>

            {initialTab === "layout" && (
                <>
                    <fieldset disabled={!edit.state.isEditMode}>
                        <legend>Board size</legend>

                        <div className="settings-section">
                            <label>
                                Apply to
                                <select
                                    value={s.scope}
                                    onChange={e => a.setScope(e.target.value)}
                                >
                                    <option value="global">
                                        All boards using global layout
                                    </option>
                                    <option value="board">
                                        Specific board
                                    </option>
                                </select>
                            </label>

                            {s.scope === "board" && (
                                <div className="settings-section">
                                    <label>
                                        Board
                                        <select
                                            value={s.selected}
                                            onChange={e => a.selectBoard(e.target.value)}
                                        >
                                            {Object.values(s.boards).map(b => (
                                                <option key={b.id} value={b.id}>
                                                    {b.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={s.useGlobal}
                                            onChange={e =>
                                                a.setUseGlobal(e.target.checked)
                                            }
                                        />
                                        Use global layout for this board
                                    </label>
                                </div>
                            )}
                        </div>

                        <div className="settings-section">
                            <label>Layout mode</label>

                            <div className="filter-pills">
                                <button
                                    type="button"
                                    aria-pressed={s.draftMode === "manual"}
                                    disabled={s.scope === "board" && s.useGlobal}
                                    onClick={() => a.setDraftMode("manual")}
                                >
                                    Manual
                                </button>

                                <button
                                    type="button"
                                    aria-pressed={s.draftMode === "automatic"}
                                    disabled={s.scope === "board" && s.useGlobal}
                                    onClick={() => a.setDraftMode("automatic")}
                                >
                                    Automatic
                                </button>
                            </div>
                        </div>

                        {s.draftMode === "manual" && (
                            <>
                                <div className="settings-section">
                                    <label>Grid presets</label>

                                    <div className="filter-pills">
                                        {GRID_PRESETS.map(g => (
                                            <button
                                                type="button"
                                                key={`${g.rows}:${g.cols}`}
                                                aria-pressed={
                                                    g.rows === s.draft.rows &&
                                                    g.cols === s.draft.cols
                                                }
                                                disabled={
                                                    s.scope === "board" &&
                                                    s.useGlobal
                                                }
                                                title={
                                                    g.rows <= 3
                                                        ? "Emergent"
                                                        : g.rows >= 8
                                                            ? "Independent"
                                                            : "Context-dependent / transitional"
                                                }
                                                onClick={() => a.setDraft(g)}
                                            >
                                                {g.rows}×{g.cols}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="settings-section">
                                    <div className="field-row">
                                        <label>
                                            Rows
                                            <input
                                                type="number"
                                                min="1"
                                                max="16"
                                                disabled={
                                                    s.scope === "board" &&
                                                    s.useGlobal
                                                }
                                                value={s.draft.rows}
                                                onChange={e =>
                                                    a.setDraft({
                                                        ...s.draft,
                                                        rows: Number(e.target.value)
                                                    })
                                                }
                                            />
                                        </label>

                                        <label>
                                            Columns
                                            <input
                                                type="number"
                                                min="1"
                                                max="16"
                                                disabled={
                                                    s.scope === "board" &&
                                                    s.useGlobal
                                                }
                                                value={s.draft.cols}
                                                onChange={e =>
                                                    a.setDraft({
                                                        ...s.draft,
                                                        cols: Number(e.target.value)
                                                    })
                                                }
                                            />
                                        </label>
                                    </div>

                                    <button
                                        type="button"
                                        disabled={
                                            s.scope === "board" && s.useGlobal
                                        }
                                        onClick={a.swapRowsCols}
                                    >
                                        ⇄ Swap orientation
                                    </button>
                                </div>

                                <div className="settings-section">
                                    <div
                                        className="grid-preview"
                                        aria-label={`${s.draft.rows} by ${s.draft.cols} layout preview`}
                                        style={{
                                            gridTemplateColumns:
                                                `repeat(${s.draft.cols}, 1fr)`
                                        }}
                                    >
                                        {s.preview.map((_, i) => (
                                            <span key={i} />
                                        ))}
                                    </div>

                                    <p>
                                        {s.overflow} tiles will be repositioned if they fall
                                        outside the new layout.
                                    </p>
                                </div>
                            </>
                        )}

                        {s.draftMode === "automatic" && (
                            <div className="settings-section">
                                <p>
                                    The board automatically adjusts its rows and columns
                                    according to the available space, tile dimensions,
                                    and grid gap.
                                </p>
                            </div>
                        )}
                    </fieldset>

                    <fieldset disabled={!edit.state.isEditMode}>
                        <legend>Tile appearance</legend>

                        <div className="settings-section">
                            <div className="tile-dimension-control">
                                <label htmlFor="tile-width-input">
                                    Tile width
                                </label>

                                <div className="tile-dimension-buttons">
                                    <button
                                        type="button"
                                        aria-label="Decrease tile width"
                                        disabled={widthUnits <= 1}
                                        onClick={() =>
                                            changeDimension("tileWidth", widthUnits - 1)
                                        }
                                    >
                                        −
                                    </button>

                                    <input
                                        id="tile-width-input"
                                        className="tile-size-input"
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={3}
                                        value={widthInput}
                                        onChange={e =>
                                            updateDimension(
                                                "tileWidth",
                                                e.target.value
                                            )
                                        }
                                        onBlur={() =>
                                            finishDimensionInput("tileWidth")
                                        }
                                        aria-label="Tile width percentage"
                                    />

                                    <span>%</span>

                                    <button
                                        type="button"
                                        aria-label="Increase tile width"
                                        disabled={widthUnits >= 100}
                                        onClick={() =>
                                            changeDimension("tileWidth", widthUnits + 1)
                                        }
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            <div className="tile-dimension-control">
                                <label htmlFor="tile-height-input">
                                    Tile height
                                </label>

                                <div className="tile-dimension-buttons">
                                    <button
                                        type="button"
                                        aria-label="Decrease tile height"
                                        disabled={heightUnits <= 1}
                                        onClick={() =>
                                            changeDimension("tileHeight", heightUnits - 1)
                                        }
                                    >
                                        −
                                    </button>

                                    <input
                                        id="tile-height-input"
                                        className="tile-size-input"
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={3}
                                        value={heightInput}
                                        onChange={e =>
                                            updateDimension(
                                                "tileHeight",
                                                e.target.value
                                            )
                                        }
                                        onBlur={() =>
                                            finishDimensionInput("tileHeight")
                                        }
                                        aria-label="Tile height percentage"
                                    />

                                    <span>%</span>

                                    <button
                                        type="button"
                                        aria-label="Increase tile height"
                                        disabled={heightUnits >= 100}
                                        onClick={() =>
                                            changeDimension("tileHeight", heightUnits + 1)
                                        }
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            <label>
                                Label position
                                <select
                                    value={s.appearance.labelPosition}
                                    onChange={e =>
                                        a.setAppearance({
                                            ...s.appearance,
                                            labelPosition: e.target.value as "top" | "bottom"
                                        })
                                    }
                                >
                                    <option value="top">top</option>
                                    <option value="bottom">bottom</option>
                                </select>
                            </label>

                            <label>
                                Label size
                                <select
                                    value={s.appearance.fontScale}
                                    onChange={e =>
                                        a.setAppearance({
                                            ...s.appearance,
                                            fontScale: e.target.value as "sm" | "md" | "lg"
                                        })
                                    }
                                >
                                    <option value="sm">sm</option>
                                    <option value="md">md</option>
                                    <option value="lg">lg</option>
                                </select>
                            </label>

                            <label>
                                Icon size
                                <select
                                    value={s.appearance.iconScale}
                                    onChange={e =>
                                        a.setAppearance({
                                            ...s.appearance,
                                            iconScale: e.target.value as "sm" | "md" | "lg"
                                        })
                                    }
                                >
                                    <option value="sm">sm</option>
                                    <option value="md">md</option>
                                    <option value="lg">lg</option>
                                </select>
                            </label>

                            <label>
                                Grid gap
                                <select
                                    value={s.appearance.gridGap}
                                    onChange={e =>
                                        a.setAppearance({
                                            ...s.appearance,
                                            gridGap: e.target.value as BoardData["tileAppearance"]["gridGap"]
                                        })
                                    }
                                >
                                    <option value="compact">compact</option>
                                    <option value="normal">normal</option>
                                    <option value="relaxed">relaxed</option>
                                </select>
                            </label>

                            <label>
                                Colors
                                <select
                                    value={s.appearance.colorMode}
                                    onChange={e =>
                                        a.setAppearance({
                                            ...s.appearance,
                                            colorMode: e.target.value as "catalog" | "wordClass"
                                        })
                                    }
                                >
                                    <option value="catalog">Catalog</option>
                                    <option value="wordClass">Fitzgerald word class</option>
                                </select>
                            </label>

                            <label>
                                <input
                                    type="checkbox"
                                    checked={s.appearance.showIcons}
                                    onChange={e =>
                                        a.setAppearance({
                                            ...s.appearance,
                                            showIcons: e.target.checked
                                        })
                                    }
                                />
                                Show icons
                            </label>
                        </div>
                    </fieldset>

                    <div className="settings-section">
                        <button
                            type="button"
                            className="primary"
                            disabled={!edit.state.isEditMode}
                            onClick={a.apply}
                        >
                            Apply Changes
                        </button>

                        {s.saved && <p role="status">Changes saved</p>}
                    </div>
                </>
            )}

            {initialTab === "speech" && (
                <fieldset disabled={!edit.state.isEditMode}>
                    <legend>Speech & access</legend>

                    <div className="settings-section">
                        <label>
                            <input
                                type="checkbox"
                                checked={s.speech.speakOnTap}
                                onChange={e =>
                                    a.setSpeech({ speakOnTap: e.target.checked })
                                }
                            />
                            Speak words on tap
                        </label>

                        <label>
                            Sentence auto-clear
                            <select
                                value={s.speech.autoClear}
                                onChange={e =>
                                    a.setSpeech({
                                        autoClear: e.target.value as BoardData["speechConfig"]["autoClear"]
                                    })
                                }
                            >
                                <option value="off">Keep until cleared</option>
                                <option value="afterSpeak">Clear after speaking</option>
                                <option value="nextTap">
                                    Clear on next activation after speaking
                                </option>
                            </select>
                        </label>

                        <label>
                            <input
                                type="checkbox"
                                checked={s.access.longPressToEdit}
                                onChange={e =>
                                    a.setAccess({ longPressToEdit: e.target.checked })
                                }
                            />
                            Long press to edit
                        </label>

                        <label>
                            Hold duration: {s.access.holdDurationMs} ms
                            <input
                                type="range"
                                min="300"
                                max="2000"
                                step="50"
                                value={s.access.holdDurationMs}
                                onChange={e =>
                                    a.setAccess({
                                        holdDurationMs: Number(e.target.value)
                                    })
                                }
                            />
                        </label>

                        <label>
                            Movement tolerance: {s.access.moveTolerancePx} px
                            <input
                                type="range"
                                min="4"
                                max="50"
                                value={s.access.moveTolerancePx}
                                onChange={e =>
                                    a.setAccess({
                                        moveTolerancePx: Number(e.target.value)
                                    })
                                }
                            />
                        </label>

                        <label>
                            Swipe threshold: {s.access.swipeThresholdPx ?? 60} px
                            <input
                                type="range"
                                min="30"
                                max="160"
                                value={s.access.swipeThresholdPx ?? 60}
                                onChange={e =>
                                    a.setAccess({
                                        swipeThresholdPx: Number(e.target.value)
                                    })
                                }
                            />
                        </label>

                        <label>
                            Edit PIN (empty disables lock)
                            <input
                                type="password"
                                autoComplete="new-password"
                                value={s.pin}
                                onChange={e => a.setPin(e.target.value)}
                            />
                        </label>

                        <button type="button" onClick={a.savePin}>
                            Save PIN
                        </button>

                        {s.pinSaved && <p role="status">PIN settings saved</p>}
                    </div>
                </fieldset>
            )}

            {!edit.state.isEditMode && (
                <p>
                    Enable{" "}
                    <button onClick={edit.actions.enter}>Edit mode</button>{" "}
                    to change settings.
                </p>
            )}
        </Modal>
    );
}