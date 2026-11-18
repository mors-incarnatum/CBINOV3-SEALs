"use client";

import { useState } from "react";
import { isGuardianRole } from "@/models/auth";
import { useBoardStore } from "@/store/BoardProvider";
import { useSentenceContext } from "@/viewmodels/useBoardShellViewModel";
import type { ChatMessage } from "@/models/boardData";

const EMPTY_MESSAGES: ChatMessage[] = [];

/**
 * ViewModel for the Parent-Child Chat prototype modal, managing draft state,
 * sentence copying, and sending local guardian or child chat messages.
 */
export function useParentChatViewModel() {
    const sentence = useSentenceContext();
    const currentUser = useBoardStore(s => s.currentUser);
    const messages = useBoardStore(s => s.experimentalData?.chatMessages) ?? EMPTY_MESSAGES;
    const addChatMessage = useBoardStore(s => s.addChatMessage);
    const [draft, setDraft] = useState(sentence.state.sentenceText);

    const senderRole: ChatMessage["sender"] = isGuardianRole(currentUser?.role) ? "guardian" : "child";

    const copyCurrentSentence = () => {
        setDraft(sentence.state.sentenceText);
    };

    const sendMessage = () => {
        const trimmed = draft.trim();
        if (!trimmed) return;
        addChatMessage(senderRole, trimmed);
        setDraft("");
    };

    return {
        state: {
            messages,
            draft,
            senderRole,
            sentenceText: sentence.state.sentenceText,
            isSentenceEmpty: sentence.state.isEmpty,
        },
        actions: {
            setDraft,
            copyCurrentSentence,
            sendMessage,
            sendAsChild: sendMessage,
        },
    };
}
