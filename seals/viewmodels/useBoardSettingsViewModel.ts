"use client";
import { useCallback, useState } from "react";
import { useBoardSelector } from "@/store/BoardProvider";
import { clampGrid, inBounds, type GridConfig } from "@/lib/board";
import { ttsService, type VoiceDescriptor } from "@/services/tts/ttsService";
import { exportProfilePackage, validateAndPrepareImport } from "@/services/storage/backupService";
import { mediaRepository } from "@/services/storage/mediaRepository";
import { extractBoardData } from "@/store/useBoardStore";
import type { FeatureFlags } from "@/models/boardData";
import { cloudSyncService, type CloudUser } from "@/services/cloud/cloudSyncService";
import type { ProfileRow } from "@/models/supabase/database.types";

export type SettingsTab = "layout" | "speech" | "profiles" | "experiments";

export interface OfflineReadiness {
    appShellCached: boolean;
    localStorageOk: boolean;
    mediaCount: number;
    compatibleVoicesCount: number;
}

export function useBoardSettingsViewModel(boardId: string) {
    const {
        boards,
        global,
        appearance,
        speech,
        access,
        featureFlags,
        profiles,
        activeProfileId,
        activeProfileName,
        cloudProfileId,
        cloudRevision,
        markCloudSynced,
        storageStatus,
        preReflowSnapshot,
        tiles,
        catalogOrder,
        experimentalData,
        sentence,
        setGrid,
        setAppearance,
        setSpeech,
        setAccess,
        setEditPin,
        setFeatureFlags,
        reflow,
        rollbackReflow,
        updater,
        switchProfile,
        createProfile,
        renameProfile,
        deleteProfile,
        importProfileDocument,
    } = useBoardSelector(s => ({
        boards: s.boards,
        global: s.gridConfig,
        appearance: s.tileAppearance,
        speech: s.speechConfig,
        access: s.accessConfig,
        featureFlags: s.featureFlags,
        profiles: s.profiles,
        activeProfileId: s.activeProfileId,
        activeProfileName: s.activeProfileName,
        cloudProfileId: s.cloudProfileId,
        cloudRevision: s.cloudRevision,
        markCloudSynced: s.markCloudSynced,
        storageStatus: s.storageStatus,
        preReflowSnapshot: s.preReflowSnapshot,
        tiles: s.tiles,
        catalogOrder: s.catalogOrder,
        experimentalData: s.experimentalData,
        sentence: s.sentence,
        setGrid: s.setGridConfig,
        setAppearance: s.setTileAppearance,
        setSpeech: s.setSpeechConfig,
        setAccess: s.setAccessConfig,
        setEditPin: s.setEditPin,
        setFeatureFlags: s.setFeatureFlags,
        reflow: s.setGridConfigAndReflow,
        rollbackReflow: s.rollbackReflow,
        updater: s.updateCatalog,
        switchProfile: s.switchProfile,
        createProfile: s.createProfile,
        renameProfile: s.renameProfile,
        deleteProfile: s.deleteProfile,
        importProfileDocument: s.importProfileDocument,
    }));

    const [scope, setScope] = useState("global");
    const [selected, setSelected] = useState(boards[boardId] ? boardId : "home");
    const [draft, setDraft] = useState(global);
    const [pin, setPin] = useState("");
    const [saved, setSaved] = useState(false);
    const [tab, setTab] = useState<SettingsTab>("layout");
    const [pinSaved, setPinSaved] = useState(false);

    const [voices, setVoices] = useState<VoiceDescriptor[]>([]);
    const [voicesLoaded, setVoicesLoaded] = useState(false);
    const [speechPreviewError, setSpeechPreviewError] = useState("");

    const [newProfileName, setNewProfileName] = useState("");
    const [backupStatus, setBackupStatus] = useState<{ ok: boolean; message: string } | null>(null);
    const [cloudUser, setCloudUser] = useState<CloudUser | null>(null);
    const [cloudEmail, setCloudEmail] = useState("");
    const [cloudPassword, setCloudPassword] = useState("");
    const [cloudProfiles, setCloudProfiles] = useState<ProfileRow[]>([]);
    const [cloudStatus, setCloudStatus] = useState<{ ok: boolean; message: string } | null>(null);
    const [cloudBusy, setCloudBusy] = useState(false);
    const [offlineReadiness, setOfflineReadiness] = useState<OfflineReadiness>({
        appShellCached: false,
        localStorageOk: storageStatus === "ok",
        mediaCount: 0,
        compatibleVoicesCount: 0,
    });

    const refreshVoices = useCallback(async () => {
        const list = await ttsService.listVoices();
        setVoices(list);
        setVoicesLoaded(true);
        return list;
    }, []);

    const refreshOfflineReadiness = useCallback(async () => {
        const list = await refreshVoices();
        const media = await mediaRepository.listProfileMedia(activeProfileId);
        let appShellCached = false;
        if (typeof caches !== "undefined") {
            try {
                if (typeof caches.match === "function") {
                    appShellCached = Boolean(await caches.match("/board"));
                } else {
                    const keys = await caches.keys();
                    appShellCached = keys.some(k => k.startsWith("wikahon-shell-"));
                }
            } catch {
                appShellCached = false;
            }
        }
        setOfflineReadiness({
            appShellCached,
            localStorageOk: storageStatus === "ok",
            mediaCount: media.length,
            compatibleVoicesCount: list.filter(v => v.isFilipinoCompatible).length,
        });
        if (cloudSyncService.isConfigured()) {
            const user = await cloudSyncService.getCurrentUser();
            setCloudUser(user);
            if (user) {
                const res = await cloudSyncService.listCloudProfiles();
                if (res.ok) setCloudProfiles(res.profiles);
            } else {
                setCloudProfiles([]);
            }
        }
    }, [activeProfileId, refreshVoices, storageStatus]);

    const affectedBoards = Object.values(boards).filter(b =>
        scope === "global" ? !b.gridOverride : b.id === selected,
    );
    const overflowDetails = affectedBoards
        .map(b => ({
            id: b.id,
            name: b.name,
            count: b.pages.reduce(
                (m, p) => m + Object.keys(p.cells).filter(k => !inBounds(k, draft)).length,
                0,
            ),
        }))
        .filter(item => item.count > 0);
    const overflow = overflowDetails.reduce((n, item) => n + item.count, 0);

    const currentBoardData = () =>
        extractBoardData({
            tiles,
            boards,
            catalogOrder,
            gridConfig: global,
            tileAppearance: appearance,
            speechConfig: speech,
            accessConfig: access,
            featureFlags,
            experimentalData,
            sentence,
        });

    const exportBackupJson = async (): Promise<string> => {
        const pkg = await exportProfilePackage(
            activeProfileId,
            activeProfileName,
            currentBoardData(),
        );
        const json = JSON.stringify(pkg, null, 2);
        setBackupStatus({ ok: true, message: `Exported backup (${pkg.manifest.length} media files).` });
        return json;
    };

    const importBackupJson = async (rawJson: string) => {
        const res = await validateAndPrepareImport(rawJson);
        if (!res.ok) {
            setBackupStatus({ ok: false, message: res.error });
            return false;
        }
        importProfileDocument(res.doc);
        setBackupStatus({ ok: true, message: `Imported "${res.doc.name}" as a new local profile.` });
        return true;
    };

    const downloadBackupFile = async () => {
        const json = await exportBackupJson();
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        try {
            const link = document.createElement("a");
            link.href = url;
            link.download = `wikahon-backup-${activeProfileId}.json`;
            link.click();
        } finally {
            URL.revokeObjectURL(url);
        }
    };

    const importBackupFile = async (file: File | null | undefined) => {
        if (!file) return false;
        return importBackupJson(await file.text());
    };

    return {
        state: {
            tab,
            pinSaved,
            hasPin: Boolean(access.pinVerifier),
            boards,
            scope,
            selected,
            draft,
            appearance,
            speech,
            access,
            featureFlags,
            pin,
            saved,
            overflow,
            overflowDetails,
            canRollbackReflow: Boolean(preReflowSnapshot),
            preview: Array.from({ length: draft.rows * draft.cols }),
            voices,
            voicesLoaded,
            speechPreviewError,
            profiles,
            activeProfileId,
            activeProfileName,
            cloudProfileId,
            cloudRevision,
            cloudConfigured: cloudSyncService.isConfigured(),
            cloudUser,
            cloudEmail,
            cloudPassword,
            cloudProfiles,
            cloudStatus,
            cloudBusy,
            newProfileName,
            backupStatus,
            offlineReadiness,
        },
        actions: {
            setTab: (nextTab: SettingsTab) => {
                setTab(nextTab);
                if (nextTab === "speech") {
                    void refreshVoices();
                } else if (nextTab === "profiles") {
                    void refreshOfflineReadiness();
                }
            },
            setScope: (value: string) => {
                setScope(value);
                setDraft(value === "global" ? global : boards[selected]?.gridOverride ?? global);
                setSaved(false);
            },
            selectBoard: (id: string) => {
                setSelected(id);
                setDraft(boards[id]?.gridOverride ?? global);
                setSaved(false);
            },
            setDraft: (grid: GridConfig) => {
                setDraft(clampGrid(grid));
                setSaved(false);
            },
            swapRowsCols: () => {
                setDraft({ rows: draft.cols, cols: draft.rows });
                setSaved(false);
            },
            apply: () => {
                setGrid(draft, scope === "global" ? undefined : selected);
                setSaved(true);
            },
            reflow: () => {
                setSaved(reflow(draft, scope === "global" ? undefined : selected));
            },
            rollbackReflow: () => {
                if (rollbackReflow() && preReflowSnapshot) {
                    const previousBoard = preReflowSnapshot.boards.find(board => board.boardId === selected);
                    setDraft(scope === "global"
                        ? preReflowSnapshot.previousGlobalGrid
                        : previousBoard?.previousGrid ?? preReflowSnapshot.previousGlobalGrid);
                    setSaved(false);
                }
            },
            useGlobal: () => {
                updater(selected, { gridOverride: undefined });
                setDraft(global);
                setSaved(true);
            },
            setAppearance,
            setSpeech,
            setAccess,
            setFeatureFlags: (patch: Partial<FeatureFlags>) => setFeatureFlags(patch),
            setPin: (value: string) => {
                setPin(value);
                setPinSaved(false);
            },
            savePin: async () => {
                await setEditPin(pin.trim() || null);
                setPin("");
                setPinSaved(true);
            },
            refreshVoices,
            previewSpeech: async () => {
                setSpeechPreviewError("");
                try {
                    await ttsService.speak({
                        text: "Kumusta, gusto ko ng tubig",
                        languageTag: speech.languageTag || "fil-PH",
                        provider: speech.provider ?? "local",
                        voiceId: speech.voiceId ?? null,
                        rate: speech.rate ?? 1,
                        volume: speech.volume,
                    });
                } catch (e) {
                    setSpeechPreviewError(e instanceof Error ? e.message : "Speech preview failed.");
                }
            },
            setNewProfileName,
            switchProfile,
            createProfile: () => {
                if (!newProfileName.trim()) return;
                createProfile(newProfileName.trim());
                setNewProfileName("");
            },
            renameActiveProfile: (name: string) => renameProfile(activeProfileId, name),
            deleteProfile,
            exportBackupJson,
            importBackupJson,
            downloadBackupFile,
            importBackupFile,
            refreshOfflineReadiness,
            setCloudEmail,
            setCloudPassword,
            cloudSignIn: async () => {
                setCloudBusy(true);
                setCloudStatus(null);
                try {
                    const res = await cloudSyncService.signIn(cloudEmail, cloudPassword);
                    if (!res.ok || !res.user) {
                        setCloudStatus({ ok: false, message: res.error ?? "Sign in failed." });
                        return;
                    }
                    setCloudUser(res.user);
                    setCloudPassword("");
                    const listRes = await cloudSyncService.listCloudProfiles();
                    if (listRes.ok) setCloudProfiles(listRes.profiles);
                    setCloudStatus({ ok: true, message: `Signed in as ${res.user.email ?? res.user.id}.` });
                } finally {
                    setCloudBusy(false);
                }
            },
            cloudSignUp: async () => {
                setCloudBusy(true);
                setCloudStatus(null);
                try {
                    const res = await cloudSyncService.signUp(cloudEmail, cloudPassword);
                    if (!res.ok) {
                        setCloudStatus({ ok: false, message: res.error ?? "Sign up failed." });
                        return;
                    }
                    setCloudStatus({
                        ok: true,
                        message: res.user
                            ? `Account created for ${res.user.email ?? res.user.id}.`
                            : "Check your email to confirm your guardian account.",
                    });
                } finally {
                    setCloudBusy(false);
                }
            },
            cloudSignOut: async () => {
                await cloudSyncService.signOut();
                setCloudUser(null);
                setCloudProfiles([]);
                setCloudStatus({ ok: true, message: "Signed out. Local board remains available." });
            },
            publishActiveProfile: async () => {
                setCloudBusy(true);
                setCloudStatus(null);
                try {
                    const res = await cloudSyncService.publishProfile({
                        localProfileId: activeProfileId,
                        profileName: activeProfileName,
                        cloudProfileId,
                        expectedRevision: cloudRevision,
                        boardData: currentBoardData(),
                    });
                    if (!res.ok || !res.cloudProfileId || !res.revision) {
                        if (!res.ok && res.cloudProfileId && !cloudProfileId) {
                            markCloudSynced(activeProfileId, res.cloudProfileId, res.revision ?? 1, true);
                        }
                        setCloudStatus({ ok: false, message: res.error ?? "Publish failed." });
                        return;
                    }
                    markCloudSynced(activeProfileId, res.cloudProfileId, res.revision);
                    const listRes = await cloudSyncService.listCloudProfiles();
                    if (listRes.ok) setCloudProfiles(listRes.profiles);
                    setCloudStatus({ ok: true, message: `Published to cloud (revision ${res.revision}).` });
                } finally {
                    setCloudBusy(false);
                }
            },
            downloadCloudProfile: async (profile: ProfileRow) => {
                setCloudBusy(true);
                setCloudStatus(null);
                try {
                    const res = await cloudSyncService.downloadAsLocalCopy(profile);
                    if (!res.ok || !res.doc) {
                        setCloudStatus({ ok: false, message: res.error ?? "Download failed." });
                        return;
                    }
                    importProfileDocument(res.doc);
                    setCloudStatus({ ok: true, message: `Downloaded "${res.doc.name}" as a new local profile.` });
                } finally {
                    setCloudBusy(false);
                }
            },
        },
    };
}
