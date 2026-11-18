"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { isGuardianRole } from "@/models/auth";
import { useBoardStore } from "@/store/BoardProvider";

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

export function useEditModeViewModel() {
    const pinVerifier = useBoardStore(s => s.accessConfig.pinVerifier);
    const isEditUnlocked = useBoardStore(s => s.isEditUnlocked);
    const unlockEditSession = useBoardStore(s => s.unlockEditSession);
    const lockEditSession = useBoardStore(s => s.lockEditSession);
    const activeProfileId = useBoardStore(s => s.activeProfileId);
    const currentUser = useBoardStore(s => s.currentUser);

    const isGuardian = isGuardianRole(currentUser?.role);

    const [editProfileId, setEditProfileId] = useState<string | null>(null);
    const [pinDialog, setPinDialog] = useState(false);
    const [pin, setPin] = useState("");
    const [error, setError] = useState("");
    const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isEditMode = isGuardian && editProfileId === activeProfileId && (!pinVerifier || isEditUnlocked);

    const lockAll = useCallback(() => {
        setEditProfileId(null);
        setPinDialog(false);
        setPin("");
        setError("");
        lockEditSession();
    }, [lockEditSession]);

    const resetInactivityTimer = useCallback(() => {
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        if (isGuardian && (isEditMode || isEditUnlocked)) {
            inactivityTimer.current = setTimeout(() => {
                lockAll();
            }, INACTIVITY_TIMEOUT_MS);
        }
    }, [isGuardian, isEditMode, isEditUnlocked, lockAll]);

    useEffect(() => {
        resetInactivityTimer();
        return () => {
            if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        };
    }, [resetInactivityTimer]);

    const enter = () => {
        if (!isGuardian) return;
        void unlockEditSession().then(res => {
            if (res.ok) {
                setEditProfileId(activeProfileId);
                resetInactivityTimer();
            }
        });
    };

    const unlock = async () => {
        if (!isGuardian) return;
        const res = await unlockEditSession(pin);
        if (res.ok) {
            setEditProfileId(activeProfileId);
            setPinDialog(false);
            setPin("");
            setError("");
            resetInactivityTimer();
        } else {
            setError(res.error ?? "Incorrect PIN");
        }
    };

    return {
        state: {
            isGuardian,
            isEditMode,
            isEditUnlocked: isGuardian && (!pinVerifier || isEditUnlocked),
            hasPin: Boolean(pinVerifier),
            pinDialog: isGuardian && pinDialog,
            pin,
            error,
        },
        actions: {
            enter,
            toggle: () => {
                if (!isGuardian) return;
                if (isEditMode) {
                    lockAll();
                } else {
                    enter();
                }
            },
            lock: lockAll,
            setPin,
            unlock,
            closePin: () => {
                setPinDialog(false);
                setPin("");
                setError("");
            },
            touchActivity: resetInactivityTimer,
        },
    };
}

export const EditContext = createContext<ReturnType<typeof useEditModeViewModel> | null>(null);

export function useEditContext() {
    const vm = useContext(EditContext);
    if (!vm) throw new Error("Edit provider required");
    return vm;
}
