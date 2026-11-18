import { createStore } from "zustand/vanilla";
import {
    cellKey,
    clampGrid,
    inBounds,
    uid,
    type Tile,
    type CatalogBoard,
    type GridConfig,
    type CellKey,
    type ColorKey,
    type SentenceToken,
} from "@/lib/board";
import { initialData, migrateV1 } from "@/lib/boardDefaults";
import { createPinVerifier, verifyPin } from "@/lib/pinVerifier";
import {
    DEFAULT_FEATURE_FLAGS,
    type BoardData,
    type ChatMessage,
    type FeatureFlags,
    type PreReflowSnapshot,
} from "@/models/boardData";
import {
    PROFILE_SCHEMA_VERSION,
    type LocalProfileDocument,
    type LocalStorageStatus,
    type ProfileSummary,
} from "@/models/profile";
import type { User } from "@/models/user";
import { type AuthSession, findDummyAccountById, isGuardianRole } from "@/models/auth";
import { authService, type AuthService } from "@/services/auth/authService";
import { localProfileService, LocalProfileService } from "@/services/storage/localProfileService";
import { mediaRepository } from "@/services/storage/mediaRepository";
import { ttsService } from "@/services/tts/ttsService";

export type { BoardData } from "@/models/boardData";
export { initialData, migrateV1 };

const MAX_SENTENCE_HISTORY = 20;

export interface BoardState extends BoardData {
    // Profile & persistence metadata (W01, W08)
    activeProfileId: string;
    activeProfileName: string;
    cloudProfileId: string | null;
    cloudRevision: number | null;
    profiles: ProfileSummary[];
    storageStatus: LocalStorageStatus;
    storageError: string | null;
    dirty: boolean;
    lastSavedAt: string | null;

    // Session-local state (never persisted to localStorage or cloud)
    sentenceHistory: SentenceToken[][];
    sentenceRevision: number;
    preReflowSnapshot: PreReflowSnapshot | null;
    isEditUnlocked: boolean;
    currentUser: User | null;

    // Auth commands
    loginWithCredentials: (
        identifier: string,
        password: string,
        authSvc?: AuthService,
    ) => { ok: boolean; error?: string };
    loginWithAccountId: (userId: string, authSvc?: AuthService) => { ok: boolean; error?: string };
    logout: (authSvc?: AuthService) => void;

    // Hydration & profile commands (W01)
    hydrateFromStorage: (service?: LocalProfileService) => Promise<void>;
    switchProfile: (localProfileId: string, service?: LocalProfileService) => void;
    createProfile: (name: string, boardData?: BoardData, service?: LocalProfileService) => string;
    renameProfile: (localProfileId: string, name: string, service?: LocalProfileService) => void;
    deleteProfile: (localProfileId: string, service?: LocalProfileService) => void;
    importProfileDocument: (doc: LocalProfileDocument, service?: LocalProfileService) => string;
    markCloudSynced: (
        localProfileId: string,
        cloudProfileId: string,
        cloudRevision: number,
        preserveDirty?: boolean,
    ) => void;
    clearStorageError: () => void;

    // Editing session guard (W07)
    unlockEditSession: (pin?: string) => Promise<{ ok: boolean; error?: string }>;
    lockEditSession: () => void;
    setEditPin: (pin: string | null) => Promise<void>;

    // Layout & grid commands (W02)
    setGridConfig: (grid: GridConfig, boardId?: string) => boolean;
    reflowOutOfBoundsTiles: (boardId: string) => boolean;
    setGridConfigAndReflow: (grid: GridConfig, boardId?: string) => boolean;
    rollbackReflow: () => boolean;
    setTileAppearance: (patch: Partial<BoardData["tileAppearance"]>) => boolean;
    setSpeechConfig: (patch: Partial<BoardData["speechConfig"]>) => boolean;
    setAccessConfig: (patch: Partial<Omit<BoardData["accessConfig"], "editPin" | "pinVerifier">>) => boolean;
    setFeatureFlags: (patch: Partial<FeatureFlags>) => boolean;

    // Sentence commands (W04)
    appendSentenceTile: (tile: Tile) => void;
    removeSentenceTokenAt: (index: number) => void;
    popSentenceToken: () => void;
    clearSentence: (recordHistory?: boolean) => void;
    undoSentenceEdit: () => boolean;

    // Tile & catalog commands (W02, W03, W06, W07)
    upsertTile: (tile: Tile) => boolean;
    assignSlot: (boardId: string, page: number, cell: CellKey, tileId: string | null) => boolean;
    swapSlots: (boardId: string, page: number, from: CellKey, to: CellKey) => boolean;
    setSlotHidden: (boardId: string, page: number, cell: CellKey, hidden: boolean) => boolean;
    createCatalog: (input: {
        name: string;
        shortName?: string;
        colorKey: ColorKey;
        iconName: string | null;
        placeFolderOnHome?: boolean;
    }) => string | null;
    updateCatalog: (
        id: string,
        patch: Partial<Pick<CatalogBoard, "name" | "shortName" | "colorKey" | "iconName" | "gridOverride">>,
    ) => boolean;
    deleteCatalog: (id: string) => boolean;
    reorderCatalog: (id: string, direction: number) => boolean;
    addWordsToCatalog: (id: string, tileIds: string[]) => boolean;
    placeFolderOnHome: (id: string) => boolean;

    // Experimental module data (W09 - retained when disabled)
    addScribbleDraft: (text: string) => void;
    addChatMessage: (sender: ChatMessage["sender"], text: string) => void;
    togglePinnedTile: (tileId: string) => boolean;
}

function addToBoard(data: BoardData, id: string, tileIds: string[]) {
    const board = data.boards[id];
    if (!board) return;
    const grid = board.gridOverride ?? data.gridConfig;
    for (const tileId of tileIds) {
        if (!data.tiles[tileId]) continue;
        const alreadyPlaced = board.pages.some(page =>
            Object.values(page.cells).some(cell => cell?.tileId === tileId),
        );
        if (alreadyPlaced) continue;
        let placed = false;
        for (const page of board.pages) {
            for (let i = 0; i < grid.rows * grid.cols; i++) {
                const key = cellKey(Math.floor(i / grid.cols), i % grid.cols);
                if (!page.cells[key]) {
                    page.cells[key] = { tileId };
                    placed = true;
                    break;
                }
            }
            if (placed) break;
        }
        if (!placed) {
            board.pages.push({ cells: { "0:0": { tileId } } });
        }
    }
}

function extractBoardDataWithSentence(state: BoardData, sentence: SentenceToken[]): BoardData {
    return {
        tiles: state.tiles,
        boards: state.boards,
        catalogOrder: state.catalogOrder,
        gridConfig: state.gridConfig,
        tileAppearance: state.tileAppearance,
        speechConfig: state.speechConfig,
        accessConfig: state.accessConfig,
        featureFlags: state.featureFlags ?? { ...DEFAULT_FEATURE_FLAGS },
        ...(state.experimentalData ? { experimentalData: state.experimentalData } : {}),
        sentence,
    };
}

export function extractBoardData(state: BoardData): BoardData {
    return structuredClone(extractBoardDataWithSentence(state, state.sentence));
}

export function isMediaReferenced(data: BoardData, mediaId: string, excludeTileId?: string): boolean {
    for (const tile of Object.values(data.tiles)) {
        if (tile.id !== excludeTileId && tile.mediaId === mediaId) {
            return true;
        }
    }
    for (const token of data.sentence) {
        if (token.mediaId === mediaId) {
            return true;
        }
    }
    return false;
}

function pushSentenceHistory(history: SentenceToken[][], current: SentenceToken[]): SentenceToken[][] {
    const next = [...history, structuredClone(current)];
    return next.length > MAX_SENTENCE_HISTORY ? next.slice(next.length - MAX_SENTENCE_HISTORY) : next;
}

function reflowBoard(data: BoardData, id: string) {
    const board = data.boards[id];
    const grid = board.gridOverride ?? data.gridConfig;
    const overflow: { tileId: string; hidden?: boolean }[] = [];
    board.pages.forEach(page => {
        Object.entries(page.cells).forEach(([key, placement]) => {
            if (placement && !inBounds(key, grid)) {
                overflow.push(placement);
                delete page.cells[key as CellKey];
            }
        });
    });
    for (const placement of overflow) {
        const before = new Set(
            board.pages.flatMap((page, index) => Object.keys(page.cells).map(key => `${index}/${key}`)),
        );
        addToBoard(data, id, [placement.tileId]);
        board.pages.forEach((page, index) => {
            Object.keys(page.cells).forEach(key => {
                if (!before.has(`${index}/${key}`)) page.cells[key as CellKey] = placement;
            });
        });
    }
}

export const createBoardStore = (profileService: LocalProfileService = localProfileService) =>
    createStore<BoardState>()((set, get) => {
        let failedPinAttempts = 0;
        let pinLockoutUntil = 0;

        const resetPinAttempts = () => {
            failedPinAttempts = 0;
            pinLockoutUntil = 0;
        };

        const persistCurrent = (nextData: BoardData) => {
            const s = get();
            const doc: LocalProfileDocument = {
                schemaVersion: PROFILE_SCHEMA_VERSION,
                localProfileId: s.activeProfileId,
                name: s.activeProfileName,
                cloudProfileId: s.cloudProfileId,
                cloudRevision: s.cloudRevision,
                dirty: true,
                lastSavedAt: s.lastSavedAt,
                boardData: nextData,
            };
            const res = profileService.saveProfileDocument(doc);
            if (!res.ok) {
                set({
                    storageStatus: res.status,
                    storageError: res.errorMessage ?? "Unable to save changes to local storage.",
                    dirty: true,
                });
            } else {
                set({
                    storageStatus: "ok",
                    storageError: null,
                    dirty: false,
                    lastSavedAt: new Date().toISOString(),
                });
            }
        };

        const canMutateSettings = (): boolean => {
            const s = get();
            if (s.currentUser?.role === "CHILD") return false;
            if (isGuardianRole(s.currentUser?.role)) return true;
            if (!s.accessConfig.pinVerifier) return true;
            return s.isEditUnlocked;
        };

        const mutateBoard = (fn: (data: BoardData) => void, requireEditGuard = true): boolean => {
            if (requireEditGuard && !canMutateSettings()) {
                return false;
            }
            const data = extractBoardData(get());
            fn(data);
            set({ ...data, dirty: true, preReflowSnapshot: null });
            persistCurrent(data);
            return true;
        };

        const reflowBoards = (ids: string[], grid?: GridConfig, boardId?: string): boolean => {
            if (!canMutateSettings()) return false;
            const current = get();
            if ((!ids.length && !grid) || ids.some(id => !current.boards[id])) return false;
            // Capture the entire operation before changing dimensions or moving tiles.
            const snapshot: PreReflowSnapshot = {
                previousGlobalGrid: { ...current.gridConfig },
                boards: ids.map(id => ({
                    boardId: id,
                    previousGrid: current.boards[id].gridOverride
                        ? { ...current.boards[id].gridOverride }
                        : undefined,
                    pages: structuredClone(current.boards[id].pages),
                })),
                timestamp: new Date().toISOString(),
            };
            const ok = mutateBoard(data => {
                if (grid) {
                    if (boardId) data.boards[boardId].gridOverride = clampGrid(grid);
                    else data.gridConfig = clampGrid(grid);
                }
                ids.forEach(id => reflowBoard(data, id));
            });
            if (ok) set({ preReflowSnapshot: snapshot });
            return ok;
        };

        const applyLoginResult = (
            res: { ok: true; session: AuthSession } | { ok: false; error: string },
        ): { ok: boolean; error?: string } => {
            if (!res.ok) {
                return { ok: false, error: res.error };
            }
            const s = get();
            const loaded = profileService.loadProfileDocument(s.activeProfileId);
            resetPinAttempts();
            if (loaded.doc) {
                set({
                    ...loaded.doc.boardData,
                    experimentalData: loaded.doc.boardData.experimentalData,
                    activeProfileId: loaded.doc.localProfileId,
                    activeProfileName: loaded.doc.name,
                    cloudProfileId: loaded.doc.cloudProfileId ?? null,
                    cloudRevision: loaded.doc.cloudRevision ?? null,
                    storageStatus: "ok",
                    storageError: null,
                    dirty: false,
                    lastSavedAt: loaded.doc.lastSavedAt ?? null,
                    sentenceHistory: [],
                    sentenceRevision: s.sentenceRevision + 1,
                    preReflowSnapshot: null,
                    currentUser: res.session.user,
                    isEditUnlocked: isGuardianRole(res.session.user.role),
                });
            } else {
                set({
                    currentUser: res.session.user,
                    isEditUnlocked: isGuardianRole(res.session.user.role),
                });
            }
            return { ok: true };
        };

        const defaults = initialData();

        return {
            ...defaults,
            activeProfileId: "default",
            activeProfileName: "Lily's Board",
            cloudProfileId: null,
            cloudRevision: null,
            profiles: [{ localProfileId: "default", name: "Lily's Board", cloudProfileId: null }],
            storageStatus: "ok",
            storageError: null,
            dirty: false,
            lastSavedAt: null,
            sentenceHistory: [],
            sentenceRevision: 0,
            preReflowSnapshot: null,
            isEditUnlocked: false,
            currentUser: null,

            loginWithCredentials: (identifier, password, authSvc = authService) =>
                applyLoginResult(authSvc.loginWithCredentials(identifier, password)),

            loginWithAccountId: (userId, authSvc = authService) =>
                applyLoginResult(authSvc.loginWithAccountId(userId)),

            logout: (authSvc = authService) => {
                ttsService.stop();
                authSvc.clearSession();
                resetPinAttempts();
                set({ currentUser: null, isEditUnlocked: false });
            },

            hydrateFromStorage: async (svc = profileService) => {
                const res = await svc.loadOrMigrateActiveProfile();
                const rawSession = authService.loadSession();
                const validAccount = rawSession ? findDummyAccountById(rawSession.user.id) : null;
                if (rawSession && !validAccount) {
                    authService.clearSession();
                }
                const session = validAccount ? rawSession : null;
                let activeName = res.activeDocument.name;
                let profiles = res.index.profiles;
                if (
                    res.status === "ok" &&
                    res.activeDocument.localProfileId === "default" &&
                    res.activeDocument.name === "Default Child"
                ) {
                    activeName = "Lily's Board";
                    profiles = res.index.profiles.map(p =>
                        p.localProfileId === "default" && p.name === "Default Child"
                            ? { ...p, name: activeName }
                            : p,
                    );
                    svc.saveProfileDocument({ ...res.activeDocument, name: activeName });
                    svc.saveActiveIndex({ ...res.index, profiles });
                }
                resetPinAttempts();
                set({
                    ...res.activeDocument.boardData,
                    experimentalData: res.activeDocument.boardData.experimentalData,
                    activeProfileId: res.activeDocument.localProfileId,
                    activeProfileName: activeName,
                    cloudProfileId: res.activeDocument.cloudProfileId ?? null,
                    cloudRevision: res.activeDocument.cloudRevision ?? null,
                    profiles,
                    storageStatus: res.status,
                    storageError: res.errorMessage ?? null,
                    dirty: res.activeDocument.dirty ?? false,
                    lastSavedAt: res.activeDocument.lastSavedAt ?? null,
                    sentenceHistory: [],
                    sentenceRevision: 0,
                    preReflowSnapshot: null,
                    currentUser: session?.user ?? null,
                    isEditUnlocked: isGuardianRole(session?.user?.role),
                });
            },

            switchProfile: (localProfileId, svc = profileService) => {
                ttsService.stop();
                const s = get();
                if (s.activeProfileId === localProfileId) return;
                const loaded = svc.loadProfileDocument(localProfileId);
                if (!loaded.doc) {
                    set({
                        storageStatus: loaded.status,
                        storageError: loaded.errorMessage ?? "Could not load selected profile.",
                    });
                    return;
                }
                const nextIndex = {
                    schemaVersion: PROFILE_SCHEMA_VERSION,
                    activeProfileId: loaded.doc.localProfileId,
                    profiles: s.profiles,
                };
                svc.saveActiveIndex(nextIndex);
                resetPinAttempts();
                set({
                    ...loaded.doc.boardData,
                    experimentalData: loaded.doc.boardData.experimentalData,
                    activeProfileId: loaded.doc.localProfileId,
                    activeProfileName: loaded.doc.name,
                    cloudProfileId: loaded.doc.cloudProfileId ?? null,
                    cloudRevision: loaded.doc.cloudRevision ?? null,
                    storageStatus: "ok",
                    storageError: null,
                    dirty: false,
                    lastSavedAt: loaded.doc.lastSavedAt ?? null,
                    sentenceHistory: [],
                    sentenceRevision: get().sentenceRevision + 1,
                    preReflowSnapshot: null,
                    isEditUnlocked: isGuardianRole(s.currentUser?.role),
                });
            },

            createProfile: (name, boardData, svc = profileService) => {
                if (!canMutateSettings()) return get().activeProfileId;
                ttsService.stop();
                const doc = svc.createProfileDocument(name, boardData);
                const saveRes = svc.saveProfileDocument(doc);
                const s = get();
                const profiles = [
                    ...s.profiles,
                    { localProfileId: doc.localProfileId, name: doc.name, cloudProfileId: null },
                ];
                svc.saveActiveIndex({
                    schemaVersion: PROFILE_SCHEMA_VERSION,
                    activeProfileId: doc.localProfileId,
                    profiles,
                });
                set({
                    ...doc.boardData,
                    experimentalData: doc.boardData.experimentalData,
                    activeProfileId: doc.localProfileId,
                    activeProfileName: doc.name,
                    cloudProfileId: null,
                    cloudRevision: null,
                    profiles,
                    storageStatus: saveRes.status,
                    storageError: saveRes.errorMessage ?? null,
                    dirty: !saveRes.ok,
                    lastSavedAt: doc.lastSavedAt ?? null,
                    sentenceHistory: [],
                    sentenceRevision: s.sentenceRevision + 1,
                    preReflowSnapshot: null,
                    isEditUnlocked: isGuardianRole(s.currentUser?.role),
                });
                return doc.localProfileId;
            },

            renameProfile: (localProfileId, name, svc = profileService) => {
                if (!canMutateSettings()) return;
                const trimmed = name.trim();
                if (!trimmed) return;
                const s = get();
                const profiles = s.profiles.map(p =>
                    p.localProfileId === localProfileId ? { ...p, name: trimmed } : p,
                );
                svc.saveActiveIndex({
                    schemaVersion: PROFILE_SCHEMA_VERSION,
                    activeProfileId: s.activeProfileId,
                    profiles,
                });
                if (s.activeProfileId === localProfileId) {
                    set({ activeProfileName: trimmed, profiles });
                    persistCurrent(extractBoardData(get()));
                } else {
                    const loaded = svc.loadProfileDocument(localProfileId);
                    if (loaded.doc) {
                        svc.saveProfileDocument({ ...loaded.doc, name: trimmed });
                    }
                    set({ profiles });
                }
            },

            deleteProfile: (localProfileId, svc = profileService) => {
                if (!canMutateSettings()) return;
                const s = get();
                if (s.profiles.length <= 1) return;
                const remaining = s.profiles.filter(p => p.localProfileId !== localProfileId);
                const nextActiveId =
                    s.activeProfileId === localProfileId ? remaining[0].localProfileId : s.activeProfileId;
                let replacementDoc: LocalProfileDocument | null = null;
                if (s.activeProfileId === localProfileId) {
                    const loaded = svc.loadProfileDocument(nextActiveId);
                    if (!loaded.doc) {
                        set({
                            storageStatus: loaded.status,
                            storageError: loaded.errorMessage ?? "Could not load replacement profile.",
                        });
                        return;
                    }
                    replacementDoc = loaded.doc;
                }
                svc.deleteProfileDocument(localProfileId);
                void mediaRepository
                    .listProfileMedia(localProfileId)
                    .then(records =>
                        Promise.all(records.map(r => mediaRepository.removeMedia(localProfileId, r.mediaId))),
                    )
                    .catch(() => undefined);
                svc.saveActiveIndex({
                    schemaVersion: PROFILE_SCHEMA_VERSION,
                    activeProfileId: nextActiveId,
                    profiles: remaining,
                });
                if (replacementDoc) {
                    ttsService.stop();
                    set({
                        ...replacementDoc.boardData,
                        experimentalData: replacementDoc.boardData.experimentalData,
                        activeProfileId: replacementDoc.localProfileId,
                        activeProfileName: replacementDoc.name,
                        cloudProfileId: replacementDoc.cloudProfileId ?? null,
                        cloudRevision: replacementDoc.cloudRevision ?? null,
                        profiles: remaining,
                        sentenceHistory: [],
                        sentenceRevision: s.sentenceRevision + 1,
                        preReflowSnapshot: null,
                        isEditUnlocked: isGuardianRole(s.currentUser?.role),
                    });
                    return;
                }
                set({ profiles: remaining });
            },

            importProfileDocument: (doc, svc = profileService) => {
                if (!canMutateSettings()) return get().activeProfileId;
                const s = get();
                // Import preparation already stored media under this profile ID.
                const newId = doc.localProfileId;
                if (s.profiles.some(p => p.localProfileId === newId)) {
                    throw new Error("Imported profile ID already exists.");
                }
                const imported: LocalProfileDocument = {
                    ...doc,
                    schemaVersion: PROFILE_SCHEMA_VERSION,
                    localProfileId: newId,
                    dirty: false,
                    lastSavedAt: new Date().toISOString(),
                };
                const saveRes = svc.saveProfileDocument(imported);
                const profiles = [
                    ...s.profiles,
                    {
                        localProfileId: newId,
                        name: imported.name,
                        cloudProfileId: imported.cloudProfileId ?? null,
                    },
                ];
                svc.saveActiveIndex({
                    schemaVersion: PROFILE_SCHEMA_VERSION,
                    activeProfileId: s.activeProfileId,
                    profiles,
                });
                set({
                    profiles,
                    storageStatus: saveRes.status,
                    storageError: saveRes.errorMessage ?? null,
                });
                return newId;
            },

            markCloudSynced: (localProfileId, cloudProfileId, cloudRevision, preserveDirty = false) => {
                const s = get();
                const wasDirty = s.dirty;
                // A publish can finish after the user switches or deletes profiles.
                if (!s.profiles.some(p => p.localProfileId === localProfileId)) return;
                if (s.activeProfileId !== localProfileId) {
                    const loaded = profileService.loadProfileDocument(localProfileId);
                    if (!loaded.doc) return;
                    const saved = profileService.saveProfileDocument({
                        ...loaded.doc,
                        cloudProfileId,
                        cloudRevision,
                    });
                    if (!saved.ok) {
                        set({ storageStatus: saved.status, storageError: saved.errorMessage ?? "Unable to save cloud profile link." });
                        return;
                    }
                }
                const profiles = s.profiles.map(p =>
                    p.localProfileId === localProfileId ? { ...p, cloudProfileId } : p,
                );
                profileService.saveActiveIndex({
                    schemaVersion: PROFILE_SCHEMA_VERSION,
                    activeProfileId: s.activeProfileId,
                    profiles,
                });
                set({ profiles });
                if (s.activeProfileId === localProfileId) {
                    set({ cloudProfileId, cloudRevision });
                    persistCurrent(extractBoardData(get()));
                    if (preserveDirty && wasDirty) {
                        set({ dirty: true });
                    }
                }
            },

            clearStorageError: () => set({ storageError: null }),

            unlockEditSession: async pin => {
                const s = get();
                if (s.currentUser?.role === "CHILD") {
                    return { ok: false, error: "Guardian access required" };
                }
                const verifier = s.accessConfig.pinVerifier;
                if (!verifier || isGuardianRole(s.currentUser?.role)) {
                    resetPinAttempts();
                    set({ isEditUnlocked: true });
                    return { ok: true };
                }
                if (Date.now() < pinLockoutUntil) {
                    return {
                        ok: false,
                        error: "Too many failed PIN attempts. Please wait a moment and try again.",
                    };
                }
                if (!pin || !(await verifyPin(pin, verifier))) {
                    failedPinAttempts += 1;
                    if (failedPinAttempts >= 5) {
                        pinLockoutUntil = Date.now() + 15_000;
                        failedPinAttempts = 0;
                    }
                    return { ok: false, error: "Incorrect PIN" };
                }
                resetPinAttempts();
                set({ isEditUnlocked: true });
                return { ok: true };
            },

            lockEditSession: () => set({ isEditUnlocked: false }),

            setEditPin: async pin => {
                if (!canMutateSettings()) return;
                const trimmed = pin?.trim() ?? "";
                const verifier = trimmed ? await createPinVerifier(trimmed) : null;
                const data = extractBoardData(get());
                data.accessConfig.editPin = null;
                data.accessConfig.pinVerifier = verifier;
                set({ ...data, isEditUnlocked: true });
                persistCurrent(data);
            },

            setGridConfig: (grid, id) =>
                mutateBoard(d => {
                    if (id && d.boards[id]) d.boards[id].gridOverride = clampGrid(grid);
                    else if (!id) d.gridConfig = clampGrid(grid);
                }),

            reflowOutOfBoundsTiles: id => reflowBoards([id]),

            setGridConfigAndReflow: (grid, id) =>
                reflowBoards(
                    id ? [id] : Object.values(get().boards).filter(board => !board.gridOverride).map(board => board.id),
                    grid,
                    id,
                ),

            rollbackReflow: () => {
                const snap = get().preReflowSnapshot;
                if (!snap) return false;
                const ok = mutateBoard(d => {
                    for (const previous of snap.boards) {
                        const b = d.boards[previous.boardId];
                        if (!b) continue;
                        b.pages = structuredClone(previous.pages);
                        if (previous.previousGrid) {
                            b.gridOverride = { ...previous.previousGrid };
                        } else {
                            delete b.gridOverride;
                        }
                    }
                    d.gridConfig = { ...snap.previousGlobalGrid };
                });
                if (ok) {
                    set({ preReflowSnapshot: null });
                }
                return ok;
            },

            setTileAppearance: patch =>
                mutateBoard(d => {
                    d.tileAppearance = { ...d.tileAppearance, ...patch };
                }),

            setSpeechConfig: patch => {
                const keys = Object.keys(patch);
                const volumeOnly = keys.length === 1 && keys[0] === "volume";
                return mutateBoard(
                    d => {
                        d.speechConfig = { ...d.speechConfig, ...patch };
                    },
                    !volumeOnly,
                );
            },

            setAccessConfig: patch =>
                mutateBoard(d => {
                    d.accessConfig = { ...d.accessConfig, ...patch };
                }),

            setFeatureFlags: patch =>
                mutateBoard(d => {
                    d.featureFlags = { ...(d.featureFlags ?? DEFAULT_FEATURE_FLAGS), ...patch };
                }),

            appendSentenceTile: tile => {
                const s = get();
                const history = pushSentenceHistory(s.sentenceHistory, s.sentence);
                const nextToken: SentenceToken = {
                    instanceId: uid(),
                    tileId: tile.id,
                    label: tile.label,
                    spokenText: tile.spokenText || tile.label,
                    iconName: tile.iconName,
                    mediaId: tile.mediaId ?? null,
                    colorKey: tile.colorKey ?? s.boards[tile.categoryId]?.colorKey ?? "slate",
                    wordClass: tile.wordClass,
                };
                const nextSentence = [...s.sentence, nextToken];
                set({
                    sentence: nextSentence,
                    sentenceHistory: history,
                    sentenceRevision: s.sentenceRevision + 1,
                });
                persistCurrent(extractBoardDataWithSentence(s, nextSentence));
            },

            removeSentenceTokenAt: i => {
                const s = get();
                if (i < 0 || i >= s.sentence.length) return;
                const history = pushSentenceHistory(s.sentenceHistory, s.sentence);
                const nextSentence = s.sentence.filter((_, n) => n !== i);
                set({
                    sentence: nextSentence,
                    sentenceHistory: history,
                    sentenceRevision: s.sentenceRevision + 1,
                });
                persistCurrent(extractBoardDataWithSentence(s, nextSentence));
            },

            popSentenceToken: () => {
                const s = get();
                if (s.sentence.length === 0) return;
                const history = pushSentenceHistory(s.sentenceHistory, s.sentence);
                const nextSentence = s.sentence.slice(0, -1);
                set({
                    sentence: nextSentence,
                    sentenceHistory: history,
                    sentenceRevision: s.sentenceRevision + 1,
                });
                persistCurrent(extractBoardDataWithSentence(s, nextSentence));
            },

            clearSentence: (recordHistory = true) => {
                const s = get();
                if (s.sentence.length === 0) return;
                const history = recordHistory ? pushSentenceHistory(s.sentenceHistory, s.sentence) : s.sentenceHistory;
                set({
                    sentence: [],
                    sentenceHistory: history,
                    sentenceRevision: s.sentenceRevision + 1,
                });
                persistCurrent(extractBoardDataWithSentence(s, []));
            },

            undoSentenceEdit: () => {
                const s = get();
                if (s.sentenceHistory.length === 0) return false;
                const previous = s.sentenceHistory[s.sentenceHistory.length - 1];
                const remaining = s.sentenceHistory.slice(0, -1);
                const restoredSentence = structuredClone(previous);
                set({
                    sentence: restoredSentence,
                    sentenceHistory: remaining,
                    sentenceRevision: s.sentenceRevision + 1,
                });
                persistCurrent(extractBoardDataWithSentence(s, restoredSentence));
                return true;
            },

            upsertTile: tile => {
                const s = get();
                const oldTile = s.tiles[tile.id];
                const ok = mutateBoard(d => {
                    d.tiles[tile.id] = tile;
                });
                if (ok && oldTile?.mediaId && oldTile.mediaId !== tile.mediaId) {
                    const currentData = extractBoardData(get());
                    if (!isMediaReferenced(currentData, oldTile.mediaId)) {
                        void mediaRepository.removeMedia(s.activeProfileId, oldTile.mediaId);
                    }
                }
                return ok;
            },

            assignSlot: (id, page, key, tileId) =>
                mutateBoard(d => {
                    const b = d.boards[id];
                    if (!b || (tileId && !d.tiles[tileId])) return;
                    while (b.pages.length <= page) b.pages.push({ cells: {} });
                    if (tileId) {
                        const prev = b.pages[page].cells[key];
                        b.pages[page].cells[key] =
                            prev?.tileId === tileId && prev.hidden ? { tileId, hidden: true } : { tileId };
                    } else {
                        delete b.pages[page].cells[key];
                    }
                }),

            swapSlots: (id, page, from, to) =>
                mutateBoard(d => {
                    const cells = d.boards[id]?.pages[page]?.cells;
                    if (!cells) return;
                    const a = cells[from];
                    const b = cells[to];
                    delete cells[from];
                    delete cells[to];
                    if (a) cells[to] = a;
                    if (b) cells[from] = b;
                }),

            setSlotHidden: (id, page, key, hidden) =>
                mutateBoard(d => {
                    const p = d.boards[id]?.pages[page]?.cells[key];
                    if (p) p.hidden = hidden;
                }),

            createCatalog: input => {
                if (!canMutateSettings()) return null;
                const id = `cat-${uid()}`;
                mutateBoard(d => {
                    d.boards[id] = {
                        id,
                        name: input.name.trim() || "Catalog",
                        shortName: input.shortName?.trim() || input.name.trim() || "Catalog",
                        colorKey: input.colorKey,
                        iconName: input.iconName,
                        isBuiltIn: false,
                        pages: [{ cells: {} }],
                    };
                    d.catalogOrder.push(id);
                });
                if (input.placeFolderOnHome) {
                    get().placeFolderOnHome(id);
                }
                return id;
            },

            updateCatalog: (id, patch) =>
                mutateBoard(d => {
                    if (!d.boards[id]) return;
                    Object.assign(d.boards[id], patch);
                    for (const tile of Object.values(d.tiles)) {
                        if (tile.kind !== "folder" || tile.targetBoardId !== id) continue;
                        if (patch.name !== undefined) tile.label = patch.name;
                        if (patch.iconName !== undefined) tile.iconName = patch.iconName;
                    }
                }),

            deleteCatalog: id =>
                mutateBoard(d => {
                    if (!d.boards[id] || d.boards[id].isBuiltIn) return;
                    delete d.boards[id];
                    d.catalogOrder = d.catalogOrder.filter(c => c !== id);
                    const folderIds = new Set(
                        Object.values(d.tiles)
                            .filter(t => t.kind === "folder" && t.targetBoardId === id)
                            .map(t => t.id),
                    );
                    for (const b of Object.values(d.boards)) {
                        b.pages.forEach(p =>
                            Object.entries(p.cells).forEach(([k, v]) => {
                                if (v && folderIds.has(v.tileId)) delete p.cells[k as CellKey];
                            }),
                        );
                    }
                    folderIds.forEach(k => delete d.tiles[k]);
                    Object.values(d.tiles).forEach(t => {
                        if (t.categoryId === id) t.categoryId = "home";
                    });
                }),

            reorderCatalog: (id, direction) =>
                mutateBoard(d => {
                    const a = d.catalogOrder.indexOf(id);
                    const b = a + direction;
                    if (a >= 0 && b >= 0 && b < d.catalogOrder.length) {
                        [d.catalogOrder[a], d.catalogOrder[b]] = [d.catalogOrder[b], d.catalogOrder[a]];
                    }
                }),

            addWordsToCatalog: (id, ids) => mutateBoard(d => addToBoard(d, id, ids)),

            placeFolderOnHome: id =>
                mutateBoard(d => {
                    const b = d.boards[id];
                    if (!b) return;
                    const tileId = `folder-${id}`;
                    d.tiles[tileId] = {
                        id: tileId,
                        kind: "folder",
                        label: b.name,
                        categoryId: id,
                        targetBoardId: id,
                        iconName: b.iconName,
                    };
                    addToBoard(d, "home", [tileId]);
                }),

            addScribbleDraft: text => {
                const trimmed = text.trim();
                if (!trimmed) return;
                mutateBoard(d => {
                    const prev = d.experimentalData?.scribbleDrafts ?? [];
                    d.experimentalData = {
                        ...(d.experimentalData ?? {}),
                        scribbleDrafts: [...prev, trimmed],
                    };
                }, false);
            },

            addChatMessage: (sender, text) => {
                const trimmed = text.trim();
                if (!trimmed) return;
                mutateBoard(d => {
                    const prev = d.experimentalData?.chatMessages ?? [];
                    d.experimentalData = {
                        ...(d.experimentalData ?? {}),
                        chatMessages: [
                            ...prev,
                            {
                                id: uid(),
                                sender,
                                text: trimmed,
                                createdAt: new Date().toISOString(),
                            },
                        ],
                    };
                }, false);
            },

            togglePinnedTile: tileId =>
                mutateBoard(d => {
                    const prev = d.experimentalData?.pinnedTileIds ?? [];
                    const next = prev.includes(tileId)
                        ? prev.filter(id => id !== tileId)
                        : [...prev, tileId];
                    d.experimentalData = {
                        ...(d.experimentalData ?? {}),
                        pinnedTileIds: next,
                    };
                }),
        };
    });

export type BoardStore = ReturnType<typeof createBoardStore>;
