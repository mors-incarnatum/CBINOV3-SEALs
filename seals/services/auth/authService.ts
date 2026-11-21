import {
    findDummyAccountByCredentials,
    findDummyAccountById,
    type AuthSession,
    type DummyAccount,
} from "@/models/auth";
import type { User, UserRole } from "@/models/user";
import type { StorageLike } from "@/services/storage/localProfileService";

export const AUTH_SESSION_STORAGE_KEY = "wikahon-auth-session-v1";

const VALID_ROLES: readonly UserRole[] = ["PARENT", "CAREGIVER", "CHILD"];

function getBrowserStorage(storage?: StorageLike | null): StorageLike | null {
    if (storage !== undefined) return storage;
    try {
        if (typeof window !== "undefined" && window.localStorage) {
            return window.localStorage;
        }
    } catch {
        return null;
    }
    return null;
}

function isValidUser(value: unknown): value is User {
    if (!value || typeof value !== "object") return false;
    const obj = value as Record<string, unknown>;
    return (
        typeof obj.id === "string" &&
        obj.id.length > 0 &&
        typeof obj.name === "string" &&
        obj.name.length > 0 &&
        (obj.email === null || typeof obj.email === "string") &&
        typeof obj.role === "string" &&
        VALID_ROLES.includes(obj.role as UserRole)
    );
}

export class AuthService {
    private storage: StorageLike | null;

    constructor(storage?: StorageLike | null) {
        this.storage = getBrowserStorage(storage);
    }

    private getStorage(): StorageLike | null {
        return this.storage ?? getBrowserStorage();
    }

    loadSession(): AuthSession | null {
        const storage = this.getStorage();
        if (!storage) return null;
        try {
            const raw = storage.getItem(AUTH_SESSION_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            if (
                !parsed ||
                typeof parsed !== "object" ||
                !isValidUser(parsed.user) ||
                typeof parsed.username !== "string"
            ) {
                return null;
            }
            return {
                user: parsed.user,
                username: parsed.username,
            };
        } catch {
            return null;
        }
    }

    saveSession(session: AuthSession): void {
        const storage = this.getStorage();
        if (!storage) return;
        try {
            storage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
        } catch {
            // Keep session in memory if storage write fails.
        }
    }

    clearSession(): void {
        const storage = this.getStorage();
        if (!storage) return;
        try {
            storage.removeItem(AUTH_SESSION_STORAGE_KEY);
        } catch {
            // Ignore storage removal errors.
        }
    }

    loginWithCredentials(
        identifier: string,
        password: string,
    ): { ok: true; session: AuthSession; account: DummyAccount } | { ok: false; error: string } {
        const account = findDummyAccountByCredentials(identifier, password);
        if (!account) {
            return { ok: false, error: "Invalid username/email or password." };
        }
        const session: AuthSession = {
            user: { ...account.user },
            username: account.username,
        };
        this.saveSession(session);
        return { ok: true, session, account };
    }

    loginWithAccountId(
        userId: string,
    ): { ok: true; session: AuthSession; account: DummyAccount } | { ok: false; error: string } {
        const account = findDummyAccountById(userId);
        if (!account) {
            return { ok: false, error: "Account not found." };
        }
        const session: AuthSession = {
            user: { ...account.user },
            username: account.username,
        };
        this.saveSession(session);
        return { ok: true, session, account };
    }
}

export const authService = new AuthService();
