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

export const ANDRES_VOICE: VoiceDescriptor = {
    id: "Andres",
    name: "Andres (es-MX)",
    lang: "es-MX",
    provider: "cloud-puter",
    offlineAvailability: "unavailable",
    isFilipinoCompatible: false,
};

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
    const { puter } = await import("@heyputer/puter.js");
    return puter.ai.txt2speech(text, {
        voice: options.voice ?? ANDRES_VOICE.id,
        engine: "neural",
        language: options.language ?? ANDRES_VOICE.lang,
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
        const voices = typeof window === "undefined" ? [] : window.speechSynthesis?.getVoices() ?? [];
        return [...voices.filter(voice => voice.localService).map(voice => ({
            id: voice.voiceURI, name: voice.name, lang: voice.lang, provider: "local" as const,
            offlineAvailability: "known" as const,
            isFilipinoCompatible: isLanguageCompatible(voice.lang),
        })), ANDRES_VOICE];
    }

    private async speakCloud(
        text: string,
        voice: string,
        language: string,
        volume: number,
        rate: number,
        generation: number,
    ): Promise<void> {
        const audio = await this.synthesize(text, { voice, language });
        if (generation !== this.generation) return;
        this.audio = audio;
        audio.volume = Math.max(0, Math.min(1, volume));
        audio.playbackRate = Math.max(0.5, Math.min(2, rate));
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

        const provider = req.provider ?? "cloud-puter";
        if (provider === "none") {
            throw new SpeechError("unavailable-voice", "Speech output is disabled in profile settings.");
        }

        if (provider === "local") {
            const synth = typeof window === "undefined" ? undefined : window.speechSynthesis;
            if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
                throw new SpeechError("unavailable-voice", "Local speech is unavailable on this device.");
            }
            const language = req.languageTag ?? "fil-PH";
            const voices = synth.getVoices().filter(voice => voice.localService && isLanguageCompatible(voice.lang, language));
            const voice = voices.find(v => v.voiceURI === req.voiceId) ?? voices[0];
            if (!voice) throw new SpeechError("unavailable-voice", `No installed voice supports ${language}.`);
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.voice = voice;
            utterance.lang = voice.lang;
            utterance.rate = Math.max(0.5, Math.min(2, req.rate ?? 1));
            utterance.volume = Math.max(0, Math.min(1, req.volume ?? 1));
            await new Promise<void>((resolve, reject) => {
                this.finish = resolve;
                utterance.onend = () => { if (this.finish === resolve) this.finish = null; resolve(); };
                utterance.onerror = () => {
                    if (this.finish === resolve) this.finish = null;
                    if (generation !== this.generation) resolve();
                    else reject(new SpeechError("playback-failed", "Local speech playback failed."));
                };
                synth.speak(utterance);
            });
            return;
        }
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
            throw new SpeechError("provider-failed", "Cloud speech (Andres) requires an internet connection.");
        }

        const volume = req.volume ?? 1;

        try {
            await this.speakCloud(text, ANDRES_VOICE.id, ANDRES_VOICE.lang, volume, req.rate ?? 1, generation);
        } catch (error) {
            if (generation !== this.generation) return;
            throw error instanceof SpeechError
                ? error
                : new SpeechError("provider-failed", "Speech playback failed for Andres.");
        }
    }
}

export const ttsService: ITTSService = new TTSService();
