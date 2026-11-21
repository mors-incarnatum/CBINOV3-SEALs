"use client";
import { useRef, useState } from "react";
import { GRID_PRESETS } from "@/lib/board";
import { useBoardSettingsViewModel } from "@/viewmodels/useBoardSettingsViewModel";
import { useEditContext } from "@/viewmodels/useEditModeViewModel";
import type { BoardData, SpeechProviderMode } from "@/models/boardData";
import { isVibrationSupported } from "@/lib/haptics";
import Modal from "./Modal";

function getDimension(value: number | undefined) {
    return value === undefined || !Number.isFinite(value) ? 50 : Math.max(1, Math.min(100, Math.round(value)));
}

export default function BoardSettings({
    boardId,
    onClose,
    initialTab = "speech",
}: {
    boardId: string;
    onClose: () => void;
    initialTab?: "layout" | "speech";
}) {
    const { state: s, actions: a } = useBoardSettingsViewModel(boardId, initialTab);
    const edit = useEditContext();
    const importInputRef = useRef<HTMLInputElement | null>(null);

    const widthUnits = getDimension(s.appearance.tileWidth);
    const heightUnits = getDimension(s.appearance.tileHeight);

    const [widthDraft, setWidthDraft] = useState<string | null>(null);
    const [heightDraft, setHeightDraft] = useState<string | null>(null);

    const widthInput = widthDraft ?? String(widthUnits);
    const heightInput = heightDraft ?? String(heightUnits);

    const updateDimension = (
        dimension: "tileWidth" | "tileHeight",
        value: string,
    ) => {
        if (!/^\d{0,3}$/.test(value)) return;

        if (dimension === "tileWidth") setWidthDraft(value);
        else setHeightDraft(value);

        if (value === "") return;

        const number = Number(value);
        if (number < 1) return;

        a.setAppearance({
            ...s.appearance,
            [dimension]: Math.min(100, number),
        });
    };

    const finishDimensionInput = (dimension: "tileWidth" | "tileHeight") => {
        const value = dimension === "tileWidth" ? widthDraft : heightDraft;
        if (value === null) return;

        const currentValue = dimension === "tileWidth" ? widthUnits : heightUnits;
        const number = Math.max(
            1,
            Math.min(100, value === "" ? currentValue : Number(value)),
        );

        a.setAppearance({
            ...s.appearance,
            [dimension]: number,
        });

        if (dimension === "tileWidth") setWidthDraft(null);
        else setHeightDraft(null);
    };

    const changeDimension = (
        dimension: "tileWidth" | "tileHeight",
        value: number,
    ) => {
        if (dimension === "tileWidth") setWidthDraft(null);
        else setHeightDraft(null);

        a.setAppearance({
            ...s.appearance,
            [dimension]: value,
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
                        : "Guardian settings & profiles"}
                </h2>
                <button type="button" onClick={onClose} aria-label="Close settings">
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
                                <select value={s.scope} onChange={e => a.setScope(e.target.value)}>
                                    <option value="global">All boards using global layout</option>
                                    <option value="board">Specific board</option>
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
                                            onChange={e => a.setUseGlobal(e.target.checked)}
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
                                                disabled={s.scope === "board" && s.useGlobal}
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
                                                disabled={s.scope === "board" && s.useGlobal}
                                                value={s.draft.rows}
                                                onChange={e =>
                                                    a.setDraft({
                                                        ...s.draft,
                                                        rows: Number(e.target.value),
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
                                                disabled={s.scope === "board" && s.useGlobal}
                                                value={s.draft.cols}
                                                onChange={e =>
                                                    a.setDraft({
                                                        ...s.draft,
                                                        cols: Number(e.target.value),
                                                    })
                                                }
                                            />
                                        </label>
                                    </div>

                                    <button
                                        type="button"
                                        disabled={s.scope === "board" && s.useGlobal}
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
                                            gridTemplateColumns: `repeat(${s.draft.cols}, 1fr)`,
                                        }}
                                    >
                                        {s.preview.map((_, i) => (
                                            <span key={i} />
                                        ))}
                                    </div>

                                    <p>
                                        {s.overflow} tiles will be repositioned if they fall outside
                                        the new layout.
                                    </p>
                                </div>
                            </>
                        )}

                        {s.draftMode === "automatic" && (
                            <div className="settings-section">
                                <p>
                                    The board automatically adjusts its rows and columns according
                                    to the available space, tile dimensions, and grid gap.
                                </p>
                            </div>
                        )}
                    </fieldset>

                    <fieldset disabled={!edit.state.isEditMode}>
                        <legend>Tile appearance</legend>

                        <div className="settings-section">
                            <div className="tile-dimension-control">
                                <label htmlFor="tile-width-input">Tile width</label>

                                <div className="tile-dimension-buttons">
                                    <button
                                        type="button"
                                        aria-label="Decrease tile width"
                                        disabled={widthUnits <= 1}
                                        onClick={() => changeDimension("tileWidth", widthUnits - 1)}
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
                                        onChange={e => updateDimension("tileWidth", e.target.value)}
                                        onBlur={() => finishDimensionInput("tileWidth")}
                                        aria-label="Tile width percentage"
                                    />

                                    <span>%</span>

                                    <button
                                        type="button"
                                        aria-label="Increase tile width"
                                        disabled={widthUnits >= 100}
                                        onClick={() => changeDimension("tileWidth", widthUnits + 1)}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            <div className="tile-dimension-control">
                                <label htmlFor="tile-height-input">Tile height</label>

                                <div className="tile-dimension-buttons">
                                    <button
                                        type="button"
                                        aria-label="Decrease tile height"
                                        disabled={heightUnits <= 1}
                                        onClick={() => changeDimension("tileHeight", heightUnits - 1)}
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
                                        onChange={e => updateDimension("tileHeight", e.target.value)}
                                        onBlur={() => finishDimensionInput("tileHeight")}
                                        aria-label="Tile height percentage"
                                    />

                                    <span>%</span>

                                    <button
                                        type="button"
                                        aria-label="Increase tile height"
                                        disabled={heightUnits >= 100}
                                        onClick={() => changeDimension("tileHeight", heightUnits + 1)}
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
                                            labelPosition: e.target.value as "top" | "bottom",
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
                                            fontScale: e.target.value as "sm" | "md" | "lg",
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
                                            iconScale: e.target.value as "sm" | "md" | "lg",
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
                                            gridGap: e.target.value as BoardData["tileAppearance"]["gridGap"],
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
                                            colorMode: e.target.value as BoardData["tileAppearance"]["colorMode"],
                                        })
                                    }
                                >
                                    <option value="catalog">Catalog</option>
                                    <option value="wordClass">Modified word-class palette</option>
                                    <option value="neutral">Neutral (no semantic color)</option>
                                </select>
                            </label>

                            <label>
                                <input
                                    type="checkbox"
                                    checked={s.appearance.showIcons}
                                    onChange={e =>
                                        a.setAppearance({
                                            ...s.appearance,
                                            showIcons: e.target.checked,
                                        })
                                    }
                                />{" "}
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

            {initialTab !== "layout" && (
                <>
                    <div className="tab-row" role="tablist" aria-label="Settings section">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={s.tab === "speech"}
                            onClick={() => a.setTab("speech")}
                        >
                            Speech &amp; access
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={s.tab === "profiles"}
                            onClick={() => a.setTab("profiles")}
                        >
                            Profiles &amp; offline
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={s.tab === "experiments"}
                            onClick={() => a.setTab("experiments")}
                        >
                            Optional prototypes
                        </button>
                    </div>

                    <fieldset hidden={s.tab !== "speech"} disabled={!edit.state.isEditMode}>
                        <legend>Speech &amp; access</legend>
                        <div className="settings-section">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={s.speech.speakOnTap}
                                    onChange={e => a.setSpeech({ speakOnTap: e.target.checked })}
                                />{" "}
                                Speak words on tap
                            </label>
                            <label>
                                Sentence auto-clear
                                <select
                                    value={s.speech.autoClear}
                                    onChange={e =>
                                        a.setSpeech({
                                            autoClear: e.target.value as BoardData["speechConfig"]["autoClear"],
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
                                Speech provider
                                <select
                                    value={s.speech.provider}
                                    onChange={e => a.setSpeechProvider(e.target.value as SpeechProviderMode)}
                                >
                                    <option value="local">On-device speech</option>
                                    <option value="cloud-puter">
                                        Cloud speech — Andres (es-MX)
                                    </option>
                                    <option value="none">
                                        Visual communication only (speech off)
                                    </option>
                                </select>
                            </label>
                            <div className="field-row">
                                <label>
                                    Voice
                                    {s.speech.provider === "local" ? (
                                        <select value={s.voices.some(v => v.id === s.speech.voiceId) ? s.speech.voiceId! : ""}
                                            onChange={e => a.setSpeech({ voiceId: e.target.value || null })}>
                                            <option value="">Automatic voice selection</option>
                                            {s.voices.map(v => <option key={v.id} value={v.id}>{v.name} ({v.lang})</option>)}
                                        </select>
                                    ) : <span>{s.speech.provider === "cloud-puter" ? "Andres (es-MX)" : "Speech off"}</span>}
                                </label>
                                <button type="button" disabled={s.speech.provider === "none"} onClick={() => void a.previewSpeech()}>
                                    🔊 Preview voice
                                </button>
                            </div>
                            {s.speech.provider === "local" && s.voicesLoaded && !s.voices.length && (
                                <p role="status">No installed voice supports {s.speech.languageTag}. The board can still display your message.</p>
                            )}
                            {s.speechPreviewError && <p role="alert">{s.speechPreviewError}</p>}
                            <label>
                                Volume: {Math.round((s.speech.volume ?? 1) * 100)}%
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={s.speech.volume ?? 1}
                                    onChange={e => a.setSpeech({ volume: Number(e.target.value) })}
                                />
                            </label>
                            <label>
                                Speech rate: {(s.speech.rate ?? 1).toFixed(2)}×
                                <input
                                    type="range"
                                    min="0.6"
                                    max="1.5"
                                    step="0.05"
                                    value={s.speech.rate ?? 1}
                                    onChange={e => a.setSpeech({ rate: Number(e.target.value) })}
                                />
                            </label>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={s.access.longPressToEdit}
                                    onChange={e =>
                                        a.setAccess({ longPressToEdit: e.target.checked })
                                    }
                                />{" "}
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
                                        a.setAccess({ holdDurationMs: Number(e.target.value) })
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
                                        a.setAccess({ moveTolerancePx: Number(e.target.value) })
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
                                        a.setAccess({ swipeThresholdPx: Number(e.target.value) })
                                    }
                                />
                            </label>
                            <label>
                                {s.hasPin ? "Change guardian PIN" : "Set guardian PIN"}
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    autoComplete="new-password"
                                    value={s.pin}
                                    onChange={e => a.setPin(e.target.value)}
                                />
                            </label>
                            <button type="button" onClick={() => void a.savePin()}>
                                Save PIN
                            </button>
                            {s.pinStatus && <p role={s.pinStatus.ok ? "status" : "alert"}>{s.pinStatus.message}</p>}
                        </div>
                    </fieldset>

                    <fieldset hidden={s.tab !== "profiles"}>
                        <legend>Child profiles &amp; offline backup</legend>
                        <label>
                            Active profile
                            <select
                                value={s.activeProfileId}
                                onChange={e => a.switchProfile(e.target.value)}
                            >
                                {s.profiles.map(p => (
                                    <option key={p.localProfileId} value={p.localProfileId}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <div className="field-row">
                            <label>
                                New profile name
                                <input
                                    value={s.newProfileName}
                                    onChange={e => a.setNewProfileName(e.target.value)}
                                    placeholder="e.g., Child 2"
                                />
                            </label>
                            <button
                                type="button"
                                disabled={!s.newProfileName.trim()}
                                onClick={a.createProfile}
                            >
                                Create profile
                            </button>
                            {s.profiles.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => a.deleteProfile(s.activeProfileId)}
                                >
                                    Delete active profile
                                </button>
                            )}
                        </div>

                        <h3>Offline readiness (this device)</h3>
                        <ul>
                            <li>
                                App shell cached:{" "}
                                {s.offlineReadiness.appShellCached ? "Yes" : "Not yet"}
                            </li>
                            <li>
                                Local storage healthy:{" "}
                                {s.offlineReadiness.localStorageOk ? "Yes" : "Check storage warning"}
                            </li>
                            <li>Stored profile media: {s.offlineReadiness.mediaCount} item(s)</li>
                            <li>
                                Compatible Filipino local voices:{" "}
                                {s.offlineReadiness.compatibleVoicesCount}
                            </li>
                        </ul>
                        <button type="button" onClick={() => void a.refreshOfflineReadiness()}>
                            Re-check offline readiness
                        </button>

                        <h3>Export / import backup</h3>
                        <div className="field-row">
                            <button type="button" onClick={() => void a.downloadBackupFile()}>
                                Export profile backup (.json)
                            </button>
                            <button
                                type="button"
                                onClick={() => importInputRef.current?.click()}
                            >
                                Import backup as new profile
                            </button>
                            <input
                                ref={importInputRef}
                                type="file"
                                accept="application/json,.json"
                                hidden
                                onChange={e => void a.importBackupFile(e.target.files?.[0])}
                            />
                        </div>
                        {s.backupStatus && <p role="status">{s.backupStatus.message}</p>}

                        <h3>Guardian cloud account &amp; sync (Supabase)</h3>
                        {!s.cloudConfigured ? (
                            <p>
                                Cloud sync is not configured on this build. Local boards and backups
                                continue working offline.
                            </p>
                        ) : !s.cloudUser ? (
                            <>
                                <div className="field-row">
                                    <label>
                                        Guardian email
                                        <input
                                            type="email"
                                            autoComplete="email"
                                            value={s.cloudEmail}
                                            onChange={e => a.setCloudEmail(e.target.value)}
                                        />
                                    </label>
                                    <label>
                                        Password
                                        <input
                                            type="password"
                                            autoComplete="current-password"
                                            value={s.cloudPassword}
                                            onChange={e => a.setCloudPassword(e.target.value)}
                                        />
                                    </label>
                                </div>
                                <div className="field-row">
                                    <button
                                        type="button"
                                        className="primary"
                                        disabled={
                                            s.cloudBusy ||
                                            !s.cloudEmail.trim() ||
                                            !s.cloudPassword
                                        }
                                        onClick={() => void a.cloudSignIn()}
                                    >
                                        Sign in
                                    </button>
                                    <button
                                        type="button"
                                        disabled={
                                            s.cloudBusy ||
                                            !s.cloudEmail.trim() ||
                                            !s.cloudPassword
                                        }
                                        onClick={() => void a.cloudSignUp()}
                                    >
                                        Create guardian account
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p>
                                    Signed in as{" "}
                                    <strong>{s.cloudUser.email ?? s.cloudUser.id}</strong>.{" "}
                                    <button type="button" onClick={() => void a.cloudSignOut()}>
                                        Sign out
                                    </button>
                                </p>
                                <div className="field-row">
                                    <button
                                        type="button"
                                        className="primary"
                                        disabled={s.cloudBusy}
                                        onClick={() => void a.publishActiveProfile()}
                                    >
                                        {s.cloudProfileId
                                            ? `Publish active profile (rev ${s.cloudRevision ?? 1})`
                                            : "Publish active profile to cloud"}
                                    </button>
                                </div>
                                {s.cloudProfiles.length > 0 && (
                                    <>
                                        <h4>Cloud profiles</h4>
                                        <ul>
                                            {s.cloudProfiles.map(cp => (
                                                <li key={cp.id}>
                                                    {cp.name} (rev {cp.revision ?? 1}){" "}
                                                    <button
                                                        type="button"
                                                        disabled={s.cloudBusy}
                                                        onClick={() =>
                                                            void a.downloadCloudProfile(cp)
                                                        }
                                                    >
                                                        Download as local copy
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                            </>
                        )}
                        {s.cloudStatus && <p role="status">{s.cloudStatus.message}</p>}
                    </fieldset>

                    <fieldset hidden={s.tab !== "experiments"}>
                        <legend>Optional feature prototypes (off by default)</legend>
                        <p>
                            Disabling a prototype hides its entry points without deleting saved
                            content.
                        </p>
                        <label>
                            <input
                                type="checkbox"
                                checked={s.featureFlags?.animation ?? false}
                                onChange={e =>
                                    a.setFeatureFlags({ animation: e.target.checked })
                                }
                            />{" "}
                            Animated GIF symbols (suppressed when reduced motion is enabled)
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={s.featureFlags?.vibration ?? false}
                                onChange={e =>
                                    a.setFeatureFlags({ vibration: e.target.checked })
                                }
                            />{" "}
                            Short tap vibration (
                            {isVibrationSupported()
                                ? "supported on this device"
                                : "not supported on this browser"}
                            )
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={s.featureFlags?.categoryWheel ?? false}
                                onChange={e =>
                                    a.setFeatureFlags({ categoryWheel: e.target.checked })
                                }
                            />{" "}
                            Category wheel (right-click / Shift+F10)
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={s.featureFlags?.scribblePractice ?? false}
                                onChange={e =>
                                    a.setFeatureFlags({ scribblePractice: e.target.checked })
                                }
                            />{" "}
                            Scribble &amp; handwriting practice area (Puter / Tesseract / Local OCR)
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={s.featureFlags?.parentChildChat ?? false}
                                onChange={e =>
                                    a.setFeatureFlags({ parentChildChat: e.target.checked })
                                }
                            />{" "}
                            Parent–child chat (local mock prototype)
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={s.featureFlags?.pinnedVocabulary ?? false}
                                onChange={e =>
                                    a.setFeatureFlags({ pinnedVocabulary: e.target.checked })
                                }
                            />{" "}
                            Pinned core vocabulary bar
                        </label>
                    </fieldset>
                </>
            )}

            {!edit.state.isEditMode && (
                <p>
                    Enable{" "}
                    <button type="button" onClick={edit.actions.enter}>
                        Edit mode
                    </button>{" "}
                    to change settings.
                </p>
            )}
        </Modal>
    );
}
