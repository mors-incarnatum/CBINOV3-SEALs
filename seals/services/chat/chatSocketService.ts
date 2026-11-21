import type { RealtimeChannel } from "@supabase/supabase-js";
import type { ChatMessage } from "@/models/boardData";
import { getSupabaseBrowserClient, type BoardSupabaseClient } from "@/models/supabase/client";

export const DEFAULT_CHAT_CHANNEL = "wikahon:parent-child-chat";

const MAX_SYNC_MESSAGES = 100;

export type ChatConnectionStatus = "disconnected" | "connecting" | "connected" | "unconfigured" | "error";

export interface ChatSocketListener {
    onMessages?: (messages: ChatMessage[]) => void;
    onStatusChange?: (status: ChatConnectionStatus) => void;
    getLocalMessages?: () => ChatMessage[];
}

export interface IChatSocketService {
    isConfigured(): boolean;
    getStatus(): ChatConnectionStatus;
    subscribe(listener: ChatSocketListener): () => void;
    sendMessage(message: ChatMessage): Promise<{ ok: boolean; error?: string }>;
    reconnect(): void;
    disconnect(): void;
}

export function isValidChatMessage(value: unknown): value is ChatMessage {
    if (!value || typeof value !== "object") return false;
    const obj = value as Record<string, unknown>;
    return (
        typeof obj.id === "string" &&
        obj.id.trim().length > 0 &&
        (obj.sender === "child" || obj.sender === "guardian") &&
        typeof obj.text === "string" &&
        obj.text.trim().length > 0
    );
}

/**
 * Manages real-time parent–child chat transport over a Supabase Realtime
 * Broadcast WebSocket channel with reference-counted subscriptions,
 * pending-send queueing, and initial history sync between peers.
 */
export class ChatSocketService implements IChatSocketService {
    private channel: RealtimeChannel | null = null;
    private status: ChatConnectionStatus = "disconnected";
    private readonly listeners = new Set<ChatSocketListener>();
    private readonly pendingQueue: ChatMessage[] = [];
    private readonly channelName: string;
    private flushing = false;

    constructor(
        private readonly getClient: () => BoardSupabaseClient | null = getSupabaseBrowserClient,
        channelName: string = DEFAULT_CHAT_CHANNEL,
    ) {
        this.channelName = channelName;
        this.status = this.getClient() ? "disconnected" : "unconfigured";
    }

    isConfigured(): boolean {
        return this.getClient() !== null;
    }

    getStatus(): ChatConnectionStatus {
        if (!this.isConfigured()) {
            return "unconfigured";
        }
        return this.status;
    }

    subscribe(listener: ChatSocketListener): () => void {
        this.listeners.add(listener);
        if (this.channel) {
            listener.onStatusChange?.(this.getStatus());
        } else {
            const prevStatus = this.status;
            this.connect();
            if (this.status === prevStatus) {
                listener.onStatusChange?.(this.getStatus());
            }
        }
        return () => {
            this.listeners.delete(listener);
            if (this.listeners.size === 0) {
                this.disconnect();
            }
        };
    }

    async sendMessage(message: ChatMessage): Promise<{ ok: boolean; error?: string }> {
        if (!isValidChatMessage(message)) {
            return { ok: false, error: "Invalid chat message." };
        }
        const client = this.getClient();
        if (!client) {
            this.setStatus("unconfigured");
            return { ok: false, error: "Supabase is not configured." };
        }
        if (!this.channel && this.listeners.size > 0) {
            this.connect();
        }
        if (this.status === "connecting" || !this.channel) {
            this.enqueuePending(message);
            return { ok: true };
        }
        if (this.status !== "connected") {
            this.enqueuePending(message);
            return { ok: false, error: "Chat socket is offline." };
        }
        const res = await this.broadcastEvent("chat:message", { message });
        if (!res.ok) {
            this.enqueuePending(message);
        }
        return res;
    }

    reconnect(): void {
        this.disconnect();
        if (this.listeners.size > 0) {
            this.connect();
        }
    }

    disconnect(): void {
        const channel = this.channel;
        this.channel = null;
        const client = this.getClient();
        if (channel && client) {
            void client.removeChannel(channel).catch(() => undefined);
        }
        this.setStatus(client ? "disconnected" : "unconfigured");
    }

    private setStatus(next: ChatConnectionStatus): void {
        if (this.status === next) return;
        this.status = next;
        for (const listener of this.listeners) {
            listener.onStatusChange?.(next);
        }
    }

    private notifyMessages(messages: ChatMessage[]): void {
        if (messages.length === 0) return;
        for (const listener of this.listeners) {
            listener.onMessages?.(messages);
        }
    }

    private collectLocalMessages(): ChatMessage[] {
        const byId = new Map<string, ChatMessage>();
        for (const listener of this.listeners) {
            const list = listener.getLocalMessages?.() ?? [];
            for (const item of list) {
                if (isValidChatMessage(item) && !byId.has(item.id)) {
                    byId.set(item.id, item);
                }
            }
        }
        return Array.from(byId.values()).slice(-MAX_SYNC_MESSAGES);
    }

    private enqueuePending(message: ChatMessage): void {
        if (!this.pendingQueue.some(item => item.id === message.id)) {
            this.pendingQueue.push(message);
        }
    }

    private async flushPendingQueue(): Promise<void> {
        if (this.flushing) return;
        this.flushing = true;
        try {
            while (this.pendingQueue.length > 0 && this.status === "connected" && this.channel) {
                const next = this.pendingQueue[0];
                const result = await this.broadcastEvent("chat:message", { message: next });
                if (!result.ok) {
                    break;
                }
                this.pendingQueue.shift();
            }
        } finally {
            this.flushing = false;
        }
    }

    private async broadcastEvent(event: string, payload: unknown): Promise<{ ok: boolean; error?: string }> {
        if (!this.channel) {
            return { ok: false, error: "Not connected to chat socket." };
        }
        try {
            const response = await this.channel.send({
                type: "broadcast",
                event,
                payload,
            });
            if (response === "ok") {
                return { ok: true };
            }
            return { ok: false, error: `Socket send returned "${response}".` };
        } catch (error) {
            return {
                ok: false,
                error: error instanceof Error ? error.message : "Failed to send message over socket.",
            };
        }
    }

    private connect(): void {
        if (this.channel) return;
        const client = this.getClient();
        if (!client) {
            this.setStatus("unconfigured");
            return;
        }

        this.setStatus("connecting");
        const channel = client.channel(this.channelName, {
            config: { broadcast: { self: false, ack: true } },
        });
        this.channel = channel;

        channel
            .on("broadcast", { event: "chat:message" }, envelope => {
                if (this.channel !== channel) return;
                const rawMessage = (envelope as { payload?: { message?: unknown } })?.payload?.message;
                if (isValidChatMessage(rawMessage)) {
                    this.notifyMessages([rawMessage]);
                }
            })
            .on("broadcast", { event: "chat:sync_request" }, envelope => {
                if (this.channel !== channel) return;
                const rawMessages = (envelope as { payload?: { messages?: unknown } })?.payload?.messages;
                if (Array.isArray(rawMessages)) {
                    const valid = rawMessages.filter(isValidChatMessage);
                    if (valid.length > 0) {
                        this.notifyMessages(valid);
                    }
                }
                const local = this.collectLocalMessages();
                if (local.length > 0 && this.status === "connected") {
                    void this.broadcastEvent("chat:sync_response", { messages: local });
                }
            })
            .on("broadcast", { event: "chat:sync_response" }, envelope => {
                if (this.channel !== channel) return;
                const rawMessages = (envelope as { payload?: { messages?: unknown } })?.payload?.messages;
                if (Array.isArray(rawMessages)) {
                    const valid = rawMessages.filter(isValidChatMessage);
                    if (valid.length > 0) {
                        this.notifyMessages(valid);
                    }
                }
            })
            .subscribe(status => {
                if (this.channel !== channel) return;
                if (status === "SUBSCRIBED") {
                    this.setStatus("connected");
                    void this.flushPendingQueue();
                    const local = this.collectLocalMessages();
                    void this.broadcastEvent("chat:sync_request", { messages: local });
                } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                    this.setStatus("error");
                } else if (status === "CLOSED") {
                    this.setStatus("disconnected");
                }
            });
    }
}

export const chatSocketService = new ChatSocketService();
