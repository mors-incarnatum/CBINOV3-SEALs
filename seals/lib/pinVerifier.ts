import type { PinVerifier } from "@/models/boardData";

const PBKDF2_PREFIX = "pbkdf2:";
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_BITS = 256;

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

function generateSalt(): string {
    if (typeof crypto === "undefined" || !crypto || typeof crypto.getRandomValues !== "function") {
        throw new Error("crypto.getRandomValues is unavailable");
    }
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
}

async function sha256Hex(input: string): Promise<string> {
    const encoded = new TextEncoder().encode(input);
    if (typeof crypto !== "undefined" && typeof crypto?.subtle?.digest === "function") {
        const digest = await crypto.subtle.digest("SHA-256", encoded);
        return bytesToHex(new Uint8Array(digest));
    }
    // Fallback for non-secure contexts where crypto.subtle is unavailable.
    let h1 = 0x811c9dc5;
    let h2 = 0x9e3779b9;
    for (let i = 0; i < encoded.length; i++) {
        h1 ^= encoded[i];
        h1 = Math.imul(h1, 0x01000193);
        h2 ^= encoded[i] + i;
        h2 = Math.imul(h2, 0x85ebca6b);
    }
    return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

async function pbkdf2Hex(pin: string, salt: string): Promise<string | null> {
    if (
        typeof crypto === "undefined" ||
        typeof crypto?.subtle?.importKey !== "function" ||
        typeof crypto?.subtle?.deriveBits !== "function"
    ) {
        return null;
    }
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: encoder.encode(salt),
            iterations: PBKDF2_ITERATIONS,
            hash: "SHA-256",
        },
        key,
        PBKDF2_KEY_BITS,
    );
    return `${PBKDF2_PREFIX}${bytesToHex(new Uint8Array(bits))}`;
}

export async function createPinVerifier(pin: string): Promise<PinVerifier> {
    const salt = generateSalt();
    const hash = (await pbkdf2Hex(pin, salt)) ?? (await sha256Hex(`${salt}:${pin}`));
    return { salt, hash };
}

export async function verifyPin(pin: string, verifier: PinVerifier | null | undefined): Promise<boolean> {
    if (!verifier) return false;
    const candidate = verifier.hash.startsWith(PBKDF2_PREFIX)
        ? await pbkdf2Hex(pin, verifier.salt)
        : await sha256Hex(`${verifier.salt}:${pin}`);
    if (!candidate || candidate.length !== verifier.hash.length) return false;
    let diff = 0;
    for (let i = 0; i < candidate.length; i++) {
        diff |= candidate.charCodeAt(i) ^ verifier.hash.charCodeAt(i);
    }
    return diff === 0;
}
