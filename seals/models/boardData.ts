import type { Tile, CatalogBoard, GridConfig, SentenceToken, ColorMode, BoardPage } from "@/lib/board";

export type SpeechProviderMode = "local" | "cloud-puter" | "none";

export interface PinVerifier {
    salt: string;
    hash: string;
}

export interface FeatureFlags {
    animation: boolean;
    vibration: boolean;
    categoryWheel: boolean;
    scribblePractice: boolean;
    parentChildChat: boolean;
    pinnedVocabulary: boolean;
}

export interface ChatMessage {
    id: string;
    sender: "child" | "guardian";
    text: string;
}

export interface ExperimentalData {
    scribbleDrafts?: string[];
    chatMessages?: ChatMessage[];
    pinnedTileIds?: string[];
}

export interface BoardData {
    tiles: Record<string, Tile>;
    boards: Record<string, CatalogBoard>;
    catalogOrder: string[];
    gridConfig: GridConfig;
    layoutMode?: "manual" | "automatic";
    tileAppearance: {
        labelPosition: "top" | "bottom";
        fontScale: "sm" | "md" | "lg";
        iconScale: "sm" | "md" | "lg";
        showIcons: boolean;
        gridGap: "compact" | "normal" | "relaxed";
        colorMode: ColorMode;
        tileWidth: number;
        tileHeight: number;
    };
    speechConfig: {
        volume: number;
        speakOnTap: boolean;
        autoClear: "off" | "afterSpeak" | "nextTap";
        provider: SpeechProviderMode;
        voiceId: string | null;
        languageTag: string;
        rate: number;
    };
    accessConfig: {
        editPin: string | null;
        pinVerifier?: PinVerifier | null;
        longPressToEdit: boolean;
        holdDurationMs: number;
        moveTolerancePx: number;
        swipeThresholdPx: number;
    };
    featureFlags: FeatureFlags;
    experimentalData?: ExperimentalData;
    sentence: SentenceToken[];
}

export interface PreReflowSnapshot {
    previousGlobalGrid: GridConfig;
    boards: {
        boardId: string;
        previousGrid?: GridConfig;
        pages: BoardPage[];
    }[];
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
    animation: false,
    vibration: false,
    categoryWheel: false,
    scribblePractice: false,
    parentChildChat: false,
    pinnedVocabulary: false,
};

export const SAFE_MEDIA_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

export function isValidMediaId(id: unknown): id is string {
    return typeof id === "string" && SAFE_MEDIA_ID_RE.test(id);
}
