export interface ITTSService {
    speak(text: string, volume: number): Promise<void>;
    stop(): void;
}
export type CloudSynthesize = (text: string) => Promise<HTMLAudioElement>;
async function synthesizeCloud(text: string) {
    const { puter } = await import("@heyputer/puter.js");
    // Communication must never be interrupted by a cloud sign-in popup.
    if (!puter.auth.isSignedIn()) throw new Error("Cloud speech is not connected");
    return puter.ai.txt2speech(text, {
        voice: "Andres",
        engine: "neural",
        language: "es-MX",
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
        if (typeof window !== "undefined") window.speechSynthesis?.cancel();
        this.finish?.();
        this.finish = null;
    }
    async speak(text: string, volume: number) {
        this.stop();
        const generation = this.generation;
        if (!text.trim()) return;
        if (typeof navigator !== "undefined" && navigator.onLine) {
            let timeout: ReturnType<typeof setTimeout> | undefined;
            try {
                const audio = await Promise.race([
                    this.synthesize(text),
                    new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Speech timeout")), 4000); }),
                ]).finally(() => clearTimeout(timeout));
                if (generation !== this.generation) return;
                this.audio = audio;
                audio.volume = Math.max(0, Math.min(1, volume));
                await new Promise<void>((resolve, reject) => {
                    this.finish = resolve;
                    audio.onended = () => resolve();
                    audio.onerror = () => reject(new Error("Audio unavailable"));
                    void audio.play().catch(reject);
                });
                return;
            } catch {
                // A disconnected account, network error or playback failure uses local speech.
                this.audio?.pause();
                this.audio = null;
            }
        }
        if (generation !== this.generation) return;
        if (typeof window === "undefined" || !window.speechSynthesis) throw new Error("Speech is unavailable on this device.");
        await new Promise<void>((resolve, reject) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = "fil-PH";
            utterance.volume = Math.max(0, Math.min(1, volume));
            const voice = window.speechSynthesis.getVoices().find(v => /^(fil|tl)(-|$)/i.test(v.lang));
            if (voice) utterance.voice = voice;
            this.finish = resolve;
            utterance.onend = () => resolve();
            utterance.onerror = event => event.error === "canceled" || event.error === "interrupted" ? resolve() : reject(new Error("Speech failed. Check your device voices."));
            window.speechSynthesis.speak(utterance);
        });
    }
}
export const ttsService: ITTSService = new TTSService();
