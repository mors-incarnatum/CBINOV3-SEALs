"use client";
import { createContext, useContext, useState } from "react";
import { useBoardStore } from "@/store/BoardProvider";
export function useEditModeViewModel() {
    const config = useBoardStore(s => s.accessConfig);
    const [isEditMode, setEdit] = useState(false), [pinDialog, setPinDialog] = useState(false), [pin, setPin] = useState(""), [error, setError] = useState("");
    const enter = () => { if (config.editPin) {
        setPin("");
        setError("");
        setPinDialog(true);
    }
    else
        setEdit(true); };
    return { state: { isEditMode, pinDialog, pin, error }, actions: { enter, toggle: () => isEditMode ? setEdit(false) : enter(), setPin, unlock: () => { if (pin === config.editPin) {
                setEdit(true);
                setPinDialog(false);
            }
            else
                setError("Incorrect PIN"); }, closePin: () => setPinDialog(false) } };
}
export const EditContext = createContext<ReturnType<typeof useEditModeViewModel> | null>(null);
export function useEditContext() { const vm = useContext(EditContext); if (!vm)
    throw new Error("Edit provider required"); return vm; }
