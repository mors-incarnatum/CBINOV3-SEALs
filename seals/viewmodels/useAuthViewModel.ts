"use client";

import { useState } from "react";
import { DUMMY_ACCOUNTS, isGuardianRole, type DummyAccount } from "@/models/auth";
import { useBoardSelector } from "@/store/BoardProvider";

const GUARDIAN_ACCOUNTS = DUMMY_ACCOUNTS.filter(a => isGuardianRole(a.user.role));
const CHILD_ACCOUNTS = DUMMY_ACCOUNTS.filter(a => a.user.role === "CHILD");

/**
 * ViewModel for user login and role-based session state.
 */
export function useAuthViewModel() {
    const {
        currentUser,
        activeProfileName,
        loginWithCredentials,
        loginWithAccountId,
        logout,
    } = useBoardSelector(s => ({
        currentUser: s.currentUser,
        activeProfileName: s.activeProfileName,
        loginWithCredentials: s.loginWithCredentials,
        loginWithAccountId: s.loginWithAccountId,
        logout: s.logout,
    }));

    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const login = () => {
        if (!identifier.trim() || !password) {
            setError("Enter both username/email and password.");
            return;
        }
        const res = loginWithCredentials(identifier, password);
        if (!res.ok) {
            setError(res.error ?? "Invalid credentials.");
            return;
        }
        setError("");
        setPassword("");
    };

    const quickLogin = (userId: string) => {
        const res = loginWithAccountId(userId);
        if (!res.ok) {
            setError(res.error ?? "Unable to sign in.");
            return;
        }
        setError("");
        setIdentifier("");
        setPassword("");
    };

    const fillAccount = (account: DummyAccount) => {
        setIdentifier(account.username);
        setPassword(account.password);
        setError("");
    };

    return {
        state: {
            currentUser,
            isGuardian: isGuardianRole(currentUser?.role),
            activeProfileName,
            identifier,
            password,
            error,
            guardianAccounts: GUARDIAN_ACCOUNTS,
            childAccounts: CHILD_ACCOUNTS,
        },
        actions: {
            setIdentifier: (val: string) => {
                setIdentifier(val);
                if (error) setError("");
            },
            setPassword: (val: string) => {
                setPassword(val);
                if (error) setError("");
            },
            login,
            quickLogin,
            fillAccount,
            logout,
        },
    };
}
