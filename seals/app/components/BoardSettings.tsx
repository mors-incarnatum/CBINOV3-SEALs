"use client";
import { useRef } from "react";
import { GRID_PRESETS } from "@/lib/board";
import { useBoardSettingsViewModel } from "@/viewmodels/useBoardSettingsViewModel";
import type { BoardData, SpeechProviderMode } from "@/models/boardData";
import { isVibrationSupported } from "@/lib/haptics";
import Modal from "./Modal";

export default function BoardSettings({
    boardId,
    onClose,
}: {
    boardId: string;
    onClose: () => void;
}) {
    const { state: s, actions: a } = useBoardSettingsViewModel(boardId);
    const importInputRef = useRef<HTMLInputElement | null>(null);

    return (
        <Modal label="Board settings" onClose={onClose} className="editor-modal">
            <div className="modal-heading">
                <h2>Guardian settings &amp; profiles</h2>
                <button type="button" onClick={onClose} aria-label="Close settings">
                    ✕
                </button>
            </div>

            <div className="tab-row" role="tablist" aria-label="Settings section">
                <button type="button" role="tab" aria-selected={s.tab === "layout"} onClick={() => a.setTab("layout")}>
                    Board size &amp; appearance
                </button>
                <button type="button" role="tab" aria-selected={s.tab === "speech"} onClick={() => a.setTab("speech")}>
                    Speech &amp; access
                </button>
                <button type="button" role="tab" aria-selected={s.tab === "profiles"} onClick={() => a.setTab("profiles")}>
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

            <fieldset hidden={s.tab !== "layout"}>
                <legend>Board size</legend>
                <div className="editor-columns">
                    <div>
                        <label>
                            Apply to
                            <select value={s.scope} onChange={e => a.setScope(e.target.value)}>
                                <option value="global">All boards using global layout</option>
                                <option value="board">Specific board</option>
                            </select>
                        </label>
                        {s.scope === "board" && (
                            <>
                                <label>
                                    Board
                                    <select value={s.selected} onChange={e => a.selectBoard(e.target.value)}>
                                        {Object.values(s.boards).map(b => (
                                            <option key={b.id} value={b.id}>
                                                {b.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <button type="button" onClick={a.useGlobal}>
                                    Use global layout for this board
                                </button>
                            </>
                        )}
                        <div className="filter-pills">
                            {GRID_PRESETS.map(g => (
                                <button
                                    key={`${g.rows}:${g.cols}`}
                                    type="button"
                                    aria-pressed={g.rows === s.draft.rows && g.cols === s.draft.cols}
                                    onClick={() => a.setDraft(g)}
                                >
                                    {g.cols} col × {g.rows} row
                                </button>
                            ))}
                        </div>
                        <div className="field-row">
                            <label>
                                Rows
                                <input
                                    type="number"
                                    min="1"
                                    max="16"
                                    value={s.draft.rows}
                                    onChange={e => a.setDraft({ ...s.draft, rows: Number(e.target.value) })}
                                />
                            </label>
                            <label>
                                Columns
                                <input
                                    type="number"
                                    min="1"
                                    max="16"
                                    value={s.draft.cols}
                                    onChange={e => a.setDraft({ ...s.draft, cols: Number(e.target.value) })}
                                />
                            </label>
                            <button type="button" onClick={a.swapRowsCols}>
                                ⇄ Swap orientation
                            </button>
                        </div>
                        <p>
                            {s.overflow} tiles outside the proposed layout. Their coordinates are preserved until you reflow.
                        </p>
                        {s.overflowDetails.length > 0 && (
                            <ul>
                                {s.overflowDetails.map(d => (
                                    <li key={d.id}>
                                        {d.name}: {d.count} off-grid
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="field-row">
                            <button type="button" className="primary" onClick={a.apply}>
                                Apply layout
                            </button>
                            <button type="button" onClick={a.reflow}>
                                Apply &amp; reflow out-of-bounds tiles
                            </button>
                            {s.canRollbackReflow && (
                                <button type="button" onClick={a.rollbackReflow}>
                                    Undo last reflow
                                </button>
                            )}
                        </div>
                        {s.saved && <p role="status">Layout saved</p>}
                    </div>
                    <aside className="preview-panel">
                        <h3>Preview</h3>
                        <div
                            className="grid-preview"
                            aria-label={`${s.draft.cols} columns by ${s.draft.rows} rows layout preview`}
                            style={{ gridTemplateColumns: `repeat(${s.draft.cols}, 1fr)` }}
                        >
                            {s.preview.map((_, i) => (
                                <span key={i} />
                            ))}
                        </div>
                    </aside>
                </div>
            </fieldset>

            <fieldset hidden={s.tab !== "layout"}>
                <legend>Tile appearance</legend>
                <div className="field-row">
                    <label>
                        Label position
                        <select
                            value={s.appearance.labelPosition}
                            onChange={e => a.setAppearance({ labelPosition: e.target.value as "top" | "bottom" })}
                        >
                            <option value="top">top</option>
                            <option value="bottom">bottom</option>
                        </select>
                    </label>
                    <label>
                        Label size
                        <select
                            value={s.appearance.fontScale}
                            onChange={e => a.setAppearance({ fontScale: e.target.value as "sm" | "md" | "lg" })}
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
                            onChange={e => a.setAppearance({ iconScale: e.target.value as "sm" | "md" | "lg" })}
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
                                a.setAppearance({ gridGap: e.target.value as BoardData["tileAppearance"]["gridGap"] })
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
                                a.setAppearance({ colorMode: e.target.value as BoardData["tileAppearance"]["colorMode"] })
                            }
                        >
                            <option value="catalog">Catalog colors</option>
                            <option value="wordClass">Modified word-class palette</option>
                            <option value="neutral">Neutral (no semantic color)</option>
                        </select>
                    </label>
                </div>
                <label>
                    <input
                        type="checkbox"
                        checked={s.appearance.showIcons}
                        onChange={e => a.setAppearance({ showIcons: e.target.checked })}
                    />{" "}
                    Show icons
                </label>
            </fieldset>

            <fieldset hidden={s.tab !== "speech"}>
                <legend>Speech &amp; access</legend>
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
                            a.setSpeech({ autoClear: e.target.value as BoardData["speechConfig"]["autoClear"] })
                        }
                    >
                        <option value="off">Keep until cleared</option>
                        <option value="afterSpeak">Clear after speaking</option>
                        <option value="nextTap">Clear on next activation after speaking</option>
                    </select>
                </label>
                <label>
                    Speech provider
                    <select
                        value={s.speech.provider ?? "local"}
                        onChange={e => a.setSpeech({ provider: e.target.value as SpeechProviderMode })}
                    >
                        <option value="local">Local device speech (recommended)</option>
                        <option value="cloud-puter">Cloud speech (gated / requires verified voice)</option>
                        <option value="none">Visual communication only (speech off)</option>
                    </select>
                </label>
                <label>
                    Language tag
                    <select
                        value={s.speech.languageTag || "fil-PH"}
                        onChange={e => a.setSpeech({ languageTag: e.target.value })}
                    >
                        <option value="fil-PH">Filipino (fil-PH)</option>
                        <option value="tl-PH">Tagalog (tl-PH)</option>
                        <option value="en-PH">English PH (en-PH)</option>
                        <option value="en-US">English US (en-US)</option>
                    </select>
                </label>
                <div className="field-row">
                    <label>
                        Device voice
                        <select
                            value={s.speech.voiceId ?? ""}
                            onChange={e => a.setSpeech({ voiceId: e.target.value || null })}
                        >
                            <option value="">Auto-select compatible voice</option>
                            {s.voices.map(v => (
                                <option key={v.id} value={v.id}>
                                    {v.name} ({v.lang}) — offline: {v.offlineAvailability}
                                    {v.isFilipinoCompatible ? " [Filipino compatible]" : ""}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button type="button" onClick={() => void a.refreshVoices()}>
                        Refresh voices
                    </button>
                    <button type="button" onClick={() => void a.previewSpeech()}>
                        🔊 Preview voice
                    </button>
                </div>
                {s.voicesLoaded && s.voices.filter(v => v.isFilipinoCompatible).length === 0 && (
                    <p role="status">
                        No Filipino/Tagalog voice was reported by this browser. Visual communication remains active.
                    </p>
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
                        onChange={e => a.setAccess({ longPressToEdit: e.target.checked })}
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
                        onChange={e => a.setAccess({ holdDurationMs: Number(e.target.value) })}
                    />
                </label>
                <label>
                    Movement tolerance: {s.access.moveTolerancePx} px
                    <input
                        type="range"
                        min="4"
                        max="50"
                        value={s.access.moveTolerancePx}
                        onChange={e => a.setAccess({ moveTolerancePx: Number(e.target.value) })}
                    />
                </label>
                <label>
                    Swipe threshold: {s.access.swipeThresholdPx ?? 60} px
                    <input
                        type="range"
                        min="30"
                        max="160"
                        value={s.access.swipeThresholdPx ?? 60}
                        onChange={e => a.setAccess({ swipeThresholdPx: Number(e.target.value) })}
                    />
                </label>
                <label>
                    {s.hasPin ? "Change Guardian PIN (empty disables lock)" : "Set Guardian PIN (empty leaves unlocked)"}
                    <input
                        type="password"
                        autoComplete="new-password"
                        value={s.pin}
                        onChange={e => a.setPin(e.target.value)}
                    />
                </label>
                <button type="button" onClick={() => void a.savePin()}>
                    Save PIN
                </button>
                {s.pinSaved && <p role="status">PIN settings saved</p>}
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
                    <li>App shell cached: {s.offlineReadiness.appShellCached ? "Yes" : "Not yet"}</li>
                    <li>Local storage healthy: {s.offlineReadiness.localStorageOk ? "Yes" : "Check storage warning"}</li>
                    <li>Stored profile media: {s.offlineReadiness.mediaCount} item(s)</li>
                    <li>Compatible Filipino local voices: {s.offlineReadiness.compatibleVoicesCount}</li>
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
                {s.backupStatus && (
                    <p role="status">{s.backupStatus.message}</p>
                )}

                <h3>Guardian cloud account &amp; sync (Supabase)</h3>
                {!s.cloudConfigured ? (
                    <p>
                        Cloud sync is not configured on this build. Local boards and backups continue working offline.
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
                                disabled={s.cloudBusy || !s.cloudEmail.trim() || !s.cloudPassword}
                                onClick={() => void a.cloudSignIn()}
                            >
                                Sign in
                            </button>
                            <button
                                type="button"
                                disabled={s.cloudBusy || !s.cloudEmail.trim() || !s.cloudPassword}
                                onClick={() => void a.cloudSignUp()}
                            >
                                Create guardian account
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <p>
                            Signed in as <strong>{s.cloudUser.email ?? s.cloudUser.id}</strong>.{" "}
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
                                                onClick={() => void a.downloadCloudProfile(cp)}
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
                <p>Disabling a prototype hides its entry points without deleting saved content.</p>
                <label>
                    <input
                        type="checkbox"
                        checked={s.featureFlags?.animation ?? false}
                        onChange={e => a.setFeatureFlags({ animation: e.target.checked })}
                    />{" "}
                    Animated GIF symbols (suppressed when reduced motion is enabled)
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={s.featureFlags?.vibration ?? false}
                        onChange={e => a.setFeatureFlags({ vibration: e.target.checked })}
                    />{" "}
                    Short tap vibration ({isVibrationSupported() ? "supported on this device" : "not supported on this browser"})
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={s.featureFlags?.categoryWheel ?? false}
                        onChange={e => a.setFeatureFlags({ categoryWheel: e.target.checked })}
                    />{" "}
                    Category wheel (right-click / Shift+F10)
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={s.featureFlags?.scribblePractice ?? false}
                        onChange={e => a.setFeatureFlags({ scribblePractice: e.target.checked })}
                    />{" "}
                    Scribble practice area (mock OCR prototype)
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={s.featureFlags?.parentChildChat ?? false}
                        onChange={e => a.setFeatureFlags({ parentChildChat: e.target.checked })}
                    />{" "}
                    Parent–child chat (local mock prototype)
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={s.featureFlags?.pinnedVocabulary ?? false}
                        onChange={e => a.setFeatureFlags({ pinnedVocabulary: e.target.checked })}
                    />{" "}
                    Pinned core vocabulary bar
                </label>
            </fieldset>
        </Modal>
    );
}
