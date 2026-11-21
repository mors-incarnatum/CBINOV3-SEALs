"use client";

import { useEffect, useRef, useState } from "react";
import { isGuardianRole } from "@/models/auth";
import { useBoardStore } from "@/store/BoardProvider";
import { useSentenceContext } from "@/viewmodels/useBoardShellViewModel";
import type { ChatMessage } from "@/models/boardData";
import {
    chatSocketService,
    type ChatConnectionStatus,
    type IChatSocketService,
} from "@/services/chat/chatSocketService";

const EMPTY_MESSAGES: ChatMessage[] = [];

/**
 * ViewModel for the Parent-Child Chat modal, managing draft state,
 * sentence copying, live socket connection status, and sending/receiving messages.
 */
export function useParentChatViewModel(socketService: IChatSocketService = chatSocketService) {
    const sentence = useSentenceContext();
    const currentUser = useBoardStore(s => s.currentUser);
    const messages = useBoardStore(s => s.experimentalData?.chatMessages) ?? EMPTY_MESSAGES;
    const addChatMessage = useBoardStore(s => s.addChatMessage);
    const receiveChatMessages = useBoardStore(s => s.receiveChatMessages);
    const [draft, setDraft] = useState(sentence.state.sentenceText);
    const [connectionStatus, setConnectionStatus] = useState<ChatConnectionStatus>(() =>
        socketService.getStatus(),
    );

    const messagesRef = useRef(messages);
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        return socketService.subscribe({
            onMessages: receiveChatMessages,
            onStatusChange: setConnectionStatus,
            getLocalMessages: () => messagesRef.current,
        });
    }, [socketService, receiveChatMessages]);

    const senderRole: ChatMessage["sender"] = isGuardianRole(currentUser?.role) ? "guardian" : "child";

    const copyCurrentSentence = () => {
        setDraft(sentence.state.sentenceText);
    };

    const sendMessage = () => {
        const trimmed = draft.trim();
        if (!trimmed) return;
        const created = addChatMessage(senderRole, trimmed);
        setDraft("");
        if (created) {
            void socketService.sendMessage(created);
        }
    };

    const reconnect = () => {
        socketService.reconnect();
    };

    return {
        state: {
            messages,
            draft,
            senderRole,
            sentenceText: sentence.state.sentenceText,
            isSentenceEmpty: sentence.state.isEmpty,
            connectionStatus,
            isConnected: connectionStatus === "connected",
        },
        actions: {
            setDraft,
            copyCurrentSentence,
            sendMessage,
            sendAsChild: sendMessage,
            reconnect,
        },
    };
}
