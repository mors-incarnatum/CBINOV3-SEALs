import type { SpeechProviderMode } from "@/models/boardData";

export type OfflineAvailability = "known" | "unknown" | "unavailable";

export interface VoiceDescriptor {
    id: string;
    name: string;
    lang: string;
    provider: Exclude<SpeechProviderMode, "none">;
    offlineAvailability: OfflineAvailability;
    isFilipinoCompatible: boolean;
}

export interface SpeakRequest {
    text: string;
    languageTag?: string;
    provider?: SpeechProviderMode;
    voiceId?: string | null;
    rate?: number;
    volume?: number;
}

export type SpeechFailureKind =
    | "cancelled"
    | "unavailable-voice"
    | "provider-failed"
    | "playback-failed";

export class SpeechError extends Error {
    constructor(
        public readonly kind: SpeechFailureKind,
        message: string,
    ) {
        super(message);
        this.name = "SpeechError";
    }
}

export interface ITTSService {
    speak(request: SpeakRequest | string, volume?: number): Promise<void>;
    stop(): void;
    listVoices(): Promise<VoiceDescriptor[]>;
}

export type CloudSynthesize = (text: string, options: { voice?: string; language?: string }) => Promise<HTMLAudioElement>;

const FILIPINO_LANG_RE = /^(fil|tl)(-|$)/i;

export function isLanguageCompatible(voiceLang: string, targetLang = "fil-PH"): boolean {
    if (!voiceLang) return false;
    if (FILIPINO_LANG_RE.test(targetLang)) {
        return FILIPINO_LANG_RE.test(voiceLang);
    }
    const baseTarget = targetLang.split("-")[0]?.toLowerCase();
    const baseVoice = voiceLang.split("-")[0]?.toLowerCase();
    return Boolean(baseTarget && baseVoice && baseTarget === baseVoice);
}

async function synthesizeCloud(
    text: string,
    options: { voice?: string; language?: string },
): Promise<HTMLAudioElement> {
    if (!options.voice || !options.language) {
        throw new SpeechError(
            "unavailable-voice",
            "A cloud voice and language must be configured.",
        );
    }
    const { puter } = await import("@heyputer/puter.js");
    return puter.ai.txt2speech(text, {
        voice: options.voice,
        engine: "neural",
        language: options.language,
    });
}

function waitForLocalVoices(timeoutMs = 1200): Promise<SpeechSynthesisVoice[]> {
    if (typeof window === "undefined" || !window.speechSynthesis) {
        return Promise.resolve([]);
    }
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
        return Promise.resolve(existing);
    }
    return new Promise(resolve => {
        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
            window.speechSynthesis.removeEventListener?.("voiceschanged", onVoices);
            resolve(window.speechSynthesis.getVoices());
        };
        const onVoices = () => done();
        window.speechSynthesis.addEventListener?.("voiceschanged", onVoices);
        setTimeout(done, timeoutMs);
    });
}

export class TTSService implements ITTSService {
    private audio: HTMLAudioElement | null = null;
    private generation = 0;
    private finish: (() => void) | null = null;

    constructor(private synthesize: CloudSynthesize = synthesizeCloud) {}

    stop() {
        this.generation++;
        this.audio?.pause();
        this.audio = null;
        if (typeof window !== "undefined") {
            window.speechSynthesis?.cancel();
        }
        this.finish?.();
        this.finish = null;
    }

    async listVoices(): Promise<VoiceDescriptor[]> {
        const voices = await waitForLocalVoices();
        return voices.map(v => ({
            id: v.voiceURI || v.name,
            name: v.name,
            lang: v.lang,
            provider: "local",
            offlineAvailability: v.localService ? "known" : "unknown",
            isFilipinoCompatible: FILIPINO_LANG_RE.test(v.lang),
        }));
    }

    private async speakLocal(
        req: Required<Pick<SpeakRequest, "text" | "languageTag" | "rate" | "volume">> & { voiceId: string | null },
        generation: number,
    ): Promise<void> {
        if (typeof window === "undefined" || !window.speechSynthesis) {
            throw new SpeechError("unavailable-voice", "Speech is unavailable on this device.");
        }
        const voices = await waitForLocalVoices();
        if (generation !== this.generation) return;

        let chosen: SpeechSynthesisVoice | undefined;
        if (req.voiceId) {
            chosen = voices.find(v => (v.voiceURI || v.name) === req.voiceId);
        }
        if (!chosen) {
            chosen = voices.find(v => isLanguageCompatible(v.lang, req.languageTag));
        }

        if (!chosen) {
            throw new SpeechError(
                "unavailable-voice",
                `No compatible ${req.languageTag} voice is installed on this device. Visual communication remains available.`,
            );
        }

        if (!isLanguageCompatible(chosen.lang, req.languageTag)) {
            throw new SpeechError(
                "unavailable-voice",
                `Selected voice (${chosen.lang}) does not match ${req.languageTag}.`,
            );
        }

        await new Promise<void>((resolve, reject) => {
            const utterance = new SpeechSynthesisUtterance(req.text);
            utterance.lang = chosen.lang || req.languageTag;
            utterance.voice = chosen;
            utterance.volume = Math.max(0, Math.min(1, req.volume));
            utterance.rate = Math.max(0.5, Math.min(2, req.rate));
            const cleanup = () => {
                utterance.onend = null;
                utterance.onerror = null;
                if (this.finish === resolve) this.finish = null;
            };
            this.finish = resolve;
            utterance.onend = () => {
                cleanup();
                resolve();
            };
            utterance.onerror = event => {
                cleanup();
                if (event.error === "canceled" || event.error === "interrupted") {
                    resolve();
                } else {
                    reject(new SpeechError("playback-failed", "Speech playback failed on this device."));
                }
            };
            try {
                window.speechSynthesis.speak(utterance);
            } catch (error) {
                cleanup();
                reject(error);
            }
        });
    }

    private async speakCloud(
        text: string,
        voice: string,
        language: string,
        volume: number,
        generation: number,
    ): Promise<void> {
        const audio = await this.synthesize(text, { voice, language });
        if (generation !== this.generation) return;
        this.audio = audio;
        audio.volume = Math.max(0, Math.min(1, volume));
        await new Promise<void>((resolve, reject) => {
            const cleanup = () => {
                audio.onended = null;
                audio.onerror = null;
                if (this.finish === resolve) this.finish = null;
                if (this.audio === audio) this.audio = null;
            };
            this.finish = resolve;
            audio.onended = () => {
                cleanup();
                resolve();
            };
            audio.onerror = () => {
                cleanup();
                audio.pause();
                reject(new SpeechError("playback-failed", "Cloud audio playback failed."));
            };
            const playbackFailed = () => {
                cleanup();
                audio.pause();
                reject(new SpeechError("playback-failed", "Could not start audio playback."));
            };
            try {
                void audio.play().catch(playbackFailed);
            } catch {
                playbackFailed();
            }
        });
    }

    async speak(requestOrText: SpeakRequest | string, volumeArg?: number): Promise<void> {
        this.stop();
        const generation = this.generation;
        const req: SpeakRequest =
            typeof requestOrText === "string"
                ? { text: requestOrText, volume: volumeArg ?? 1 }
                : requestOrText;

        const text = req.text.trim();
        if (!text) return;

        const provider = req.provider ?? "local";
        if (provider === "none") {
            throw new SpeechError("unavailable-voice", "Speech output is disabled in profile settings.");
        }

        const languageTag = req.languageTag || "fil-PH";
        const volume = req.volume ?? 1;
        const rate = req.rate ?? 1;

        const attempts: (() => Promise<void>)[] = [];
        if (provider === "cloud-puter" && req.voiceId &&
            (typeof navigator === "undefined" || navigator.onLine !== false)) {
            const voiceId = req.voiceId;
            attempts.push(() => this.speakCloud(text, voiceId, languageTag, volume, generation));
        }
        if (provider === "local" && req.voiceId) {
            const voiceId = req.voiceId;
            attempts.push(() => this.speakLocal({ text, languageTag, rate, volume, voiceId }, generation));
        }
        attempts.push(() => this.speakLocal({ text, languageTag, rate, volume, voiceId: null }, generation));

        let lastError: unknown;
        for (const attempt of attempts) {
            if (generation !== this.generation) return;
            try {
                await attempt();
                return;
            } catch (error) {
                if (generation !== this.generation) return;
                lastError = error;
            }
        }
        throw lastError instanceof SpeechError
            ? lastError
            : new SpeechError("provider-failed", "Speech playback failed for the configured provider.");
    }
}

export const ttsService: ITTSService = new TTSService();
