import type { User, UserRole } from "./user";
import type { Parent } from "./parent";
import type { Caregiver } from "./caregiver";
import type { Child } from "./child";

export interface DummyAccount {
    user: Parent | Caregiver | Child;
    username: string;
    aliases?: readonly string[];
    password: string;
}

export interface AuthSession {
    user: User;
    username: string;
    loggedInAt: string;
}

export const DUMMY_ACCOUNTS: readonly DummyAccount[] = [
    {
        user: {
            id: "guardian-kyle",
            name: "Kyle",
            email: "kyle@wikahon.local",
            role: "CAREGIVER",
        },
        username: "kyle",
        aliases: ["guardian"],
        password: "kyle123",
    },
    {
        user: {
            id: "child-lily",
            name: "Lily",
            email: null,
            role: "CHILD",
        },
        username: "lily",
        aliases: ["child"],
        password: "1234",
    },
];

export function isGuardianRole(role: UserRole | null | undefined): boolean {
    return role === "PARENT" || role === "CAREGIVER";
}

export function findDummyAccountByCredentials(
    identifier: string,
    password: string,
): DummyAccount | null {
    const normalized = identifier.trim().toLowerCase();
    if (!normalized || !password) return null;
    return (
        DUMMY_ACCOUNTS.find(
            account =>
                (account.username.toLowerCase() === normalized ||
                    account.aliases?.some(alias => alias.toLowerCase() === normalized) ||
                    account.user.email?.toLowerCase() === normalized) &&
                account.password === password,
        ) ?? null
    );
}

export function findDummyAccountById(userId: string): DummyAccount | null {
    return DUMMY_ACCOUNTS.find(account => account.user.id === userId) ?? null;
}
