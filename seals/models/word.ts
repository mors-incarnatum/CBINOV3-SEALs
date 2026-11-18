import type { ColorKey, LanguageTag, WordClass } from "@/lib/board";

/** Domain entity for a vocabulary word scoped to a communication profile. */
export interface Word {
    id: string;
    label: string;
    spokenText?: string;
    iconName: string | null;
    mediaId?: string | null;
    language?: LanguageTag;
    categoryId: string;
    colorKey?: ColorKey;
    wordClass?: WordClass;
    isCustom?: boolean;
    isQuickPhrase?: boolean;
}
