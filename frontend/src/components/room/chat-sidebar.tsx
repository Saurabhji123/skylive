"use client";

import { useEffect, useMemo, useReducer, useRef, useState, type UIEvent } from "react";
import type { ChatMessage } from "@skylive/shared";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSocket } from "@/providers/socket-provider";

interface ChatSidebarProps {
  roomId: string;
  userId: string;
  displayName: string;
  initialMessages?: ChatMessage[];
  disabled?: boolean;
}

type MessageStatus = "pending" | "sent" | "failed";

type ChatMessageWithStatus = ChatMessage & { status: MessageStatus; isLocal?: boolean };

type ChatAction =
  | { type: "hydrate"; messages: ChatMessageWithStatus[] }
  | { type: "append"; message: ChatMessageWithStatus }
  | { type: "upsert"; message: ChatMessageWithStatus }
  | { type: "status"; id: string; status: MessageStatus }
  | { type: "remove"; id: string };

const sortMessages = (list: ChatMessageWithStatus[]): ChatMessageWithStatus[] =>
  [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

function chatReducer(state: ChatMessageWithStatus[], action: ChatAction): ChatMessageWithStatus[] {
  switch (action.type) {
    case "hydrate": {
      const next = [...state];
      const existing = new Map(next.map((msg, index) => [msg.id, index] as const));
      action.messages.forEach((message) => {
        const index = existing.get(message.id);
        if (index !== undefined) {
          next[index] = { ...next[index], ...message };
        } else {
          next.push(message);
        }
      });
      return sortMessages(next);
    }
    case "append":
      return sortMessages([...state, action.message]);
    case "upsert": {
      const index = state.findIndex((msg) => msg.id === action.message.id);
      if (index !== -1) {
        const next = [...state];
        next[index] = { ...next[index], ...action.message };
        return next;
      }
      return sortMessages([...state, action.message]);
    }
    case "status":
      return state.map((msg) => (msg.id === action.id ? { ...msg, status: action.status } : msg));
    case "remove":
      return state.filter((msg) => msg.id !== action.id);
    default:
      return state;
  }
}

export function ChatSidebar({ roomId, userId, displayName, initialMessages = [], disabled = false }: ChatSidebarProps) {
  const socket = useSocket();
  const [messages, dispatch] = useReducer(chatReducer, [] as ChatMessageWithStatus[]);
  const [message, setMessage] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<HTMLDivElement | null>(null);
  const pendingAcks = useRef<Map<string, number>>(new Map());

  const hydratedInitialMessages = useMemo(
    () =>
      initialMessages.map((msg) => ({
        ...msg,
        status: "sent" as MessageStatus,
        isLocal: msg.senderId === userId
      })),
    [initialMessages, userId]
  );

  useEffect(() => {
    if (!hydratedInitialMessages.length) {
      return;
    }
    dispatch({ type: "hydrate", messages: hydratedInitialMessages });
  }, [hydratedInitialMessages]);

  useEffect(() => () => {
    pendingAcks.current.forEach((timer) => window.clearTimeout(timer));
    pendingAcks.current.clear();
  }, []);

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit"
      }),
    []
  );

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (payload: ChatMessage) => {
      dispatch({
        type: "upsert",
        message: { ...payload, status: "sent", isLocal: payload.senderId === userId }
      });
    };

    socket.on("chat:message", handleMessage);
    return () => {
      socket.off("chat:message", handleMessage);
    };
  }, [socket, userId]);

  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  const updateMessageStatus = (id: string, status: MessageStatus) => {
    dispatch({ type: "status", id, status });
  };

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const distanceToBottom = element.scrollHeight - (element.scrollTop + element.clientHeight);
    setAutoScroll(distanceToBottom < 96);
  };

  const sendMessage = () => {
    if (!socket || !message.trim() || disabled) return;
    const payload: ChatMessage = {
      id: crypto.randomUUID(),
      roomId,
      senderId: userId,
      senderName: displayName,
      content: message.trim(),
      contentType: "text",
      createdAt: new Date().toISOString()
    };
    dispatch({ type: "append", message: { ...payload, status: "pending", isLocal: true } });
    setAutoScroll(true);

    const timeout = window.setTimeout(() => {
      pendingAcks.current.delete(payload.id);
      updateMessageStatus(payload.id, "failed");
    }, 10000);
    pendingAcks.current.set(payload.id, timeout);

    socket.emit("chat:message", payload, (ack?: { ok: boolean; id: string }) => {
      const timer = pendingAcks.current.get(payload.id);
      if (timer) {
        window.clearTimeout(timer);
        pendingAcks.current.delete(payload.id);
      }

      if (ack?.ok) {
        updateMessageStatus(payload.id, "sent");
        setMessage("");
      } else {
        updateMessageStatus(payload.id, "failed");
      }
    });
  };

  const canSend = !disabled && message.trim().length > 0;

  const retryMessage = (msg: ChatMessageWithStatus) => {
    setMessage(msg.content);
    dispatch({ type: "remove", id: msg.id });
  };

  return (
    <aside className="flex w-full max-w-full flex-col gap-3 rounded-3xl border border-white/10 bg-black/50 p-4 text-white md:w-80 lg:w-96">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Chat</h2>
        <span className="text-xs text-white/50">{messages.length} messages</span>
      </header>
      <div
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto pr-2 text-sm"
        onScroll={handleScroll}
      >
        {messages.map((msg) => {
          const isOwnMessage = msg.senderId === userId;
          const statusLabel =
            msg.status === "pending" ? "Sending…" : msg.status === "failed" ? "Failed to send" : "Delivered";
          return (
            <div key={msg.id} className={cn("flex flex-col gap-1", isOwnMessage ? "items-end" : "items-start")}>
              <span className="text-xs text-white/60">{msg.senderName}</span>
              <div
                className={cn(
                  "max-w-[90%] rounded-2xl px-3 py-2",
                  isOwnMessage ? "bg-skylive-magenta/60" : "bg-white/10",
                  msg.status === "failed" && "border border-red-400/80"
                )}
              >
                {msg.content}
              </div>
              <span className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-white/40">
                {timeFormatter.format(new Date(msg.createdAt))}
                {isOwnMessage ? <span>{statusLabel}</span> : null}
                {msg.status === "failed" ? (
                  <button
                    type="button"
                    className="rounded px-1 py-0.5 text-[10px] font-medium text-red-200 hover:bg-red-500/10"
                    onClick={() => retryMessage(msg)}
                  >
                    Retry
                  </button>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Send a message"
          disabled={disabled}
          className="flex-1"
        />
        <Button onClick={sendMessage} size="sm" disabled={!canSend} className="w-full sm:w-auto">
          Send
        </Button>
      </div>
    </aside>
  );
}
