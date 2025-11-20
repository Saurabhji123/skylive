"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useSessionStore } from "@/store/session-store";
import { clientLog } from "@/lib/logger";

interface SocketContextValue {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextValue>({ socket: null });
const MAX_CONNECT_ATTEMPTS = 3;
const CONNECT_TIMEOUT_MS = 8000;

interface ConnectionIdentity {
  userId?: string;
  displayName?: string;
  accessToken?: string | null;
}

interface SocketProviderProps {
  roomId?: string;
  rtcSessionId?: string;
  connect?: boolean;
  identity?: ConnectionIdentity;
  onJoinError?: (error?: string) => void;
  children: React.ReactNode;
}

export function SocketProvider({ roomId, rtcSessionId, connect = true, identity, onJoinError, children }: SocketProviderProps) {
  const { accessToken: sessionToken, userId: sessionUserId, displayName: sessionDisplayName } = useSessionStore();
  const effectiveUserId = identity?.userId ?? sessionUserId;
  const effectiveDisplayName = identity?.displayName ?? sessionDisplayName;
  const tokenOverride = identity?.accessToken;
  const effectiveToken = tokenOverride === undefined ? sessionToken : tokenOverride ?? undefined;
  const [socket, setSocket] = useState<Socket | null>(null);
  const joinInFlightRef = useRef(false);
  const connectAttemptsRef = useRef(0);
  const connectTimeoutRef = useRef<number | null>(null);
  const joinErrorNotifiedRef = useRef(false);

  useEffect(() => {
    if (!connect || !roomId || !effectiveUserId) {
      return;
    }

    joinErrorNotifiedRef.current = false;
    connectAttemptsRef.current = 0;

    const query: Record<string, string> = {
      roomId,
      userId: effectiveUserId
    };
    if (rtcSessionId) {
      query.rtcSessionId = rtcSessionId;
    }

    const extraHeaders = effectiveToken
      ? {
          Authorization: `Bearer ${effectiveToken}`
        }
      : undefined;

    const createdSocket = io(process.env.NEXT_PUBLIC_SIGNALING_URL ?? "", {
      transports: ["websocket"],
      query,
      extraHeaders,
      reconnectionAttempts: MAX_CONNECT_ATTEMPTS,
      timeout: CONNECT_TIMEOUT_MS
    });

    const clearConnectTimer = () => {
      if (connectTimeoutRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(connectTimeoutRef.current);
      }
      connectTimeoutRef.current = null;
    };

    const notifyJoinError = (code: string) => {
      if (joinErrorNotifiedRef.current) {
        return;
      }
      joinErrorNotifiedRef.current = true;
      onJoinError?.(code);
    };

    const scheduleConnectTimeout = () => {
      if (typeof window === "undefined") {
        return;
      }
      clearConnectTimer();
      connectTimeoutRef.current = window.setTimeout(() => {
        if (!createdSocket.connected) {
          clientLog("warn", "Socket connection timed out for room", roomId);
          notifyJoinError("SIGNALING_CONNECT_TIMEOUT");
          createdSocket.disconnect();
        }
      }, CONNECT_TIMEOUT_MS);
    };

    scheduleConnectTimeout();

    const attemptJoin = (reconnect = false) => {
      if (joinInFlightRef.current) {
        return;
      }
      joinInFlightRef.current = true;
      setSocket(null);
      createdSocket.emit(
        "join_room",
        {
          roomId,
          userId: effectiveUserId,
          displayName: effectiveDisplayName,
          reconnect
        },
        (ack?: { ok: boolean; error?: string }) => {
          joinInFlightRef.current = false;
          if (ack?.ok) {
            joinErrorNotifiedRef.current = false;
            onJoinError?.(undefined);
            setSocket(createdSocket);
          } else {
            clientLog("warn", "socket join rejected", ack?.error);
            joinErrorNotifiedRef.current = true;
            onJoinError?.(ack?.error ?? "JOIN_FAILED");
            createdSocket.disconnect();
          }
        }
      );
    };

    const handleConnect = () => {
      clearConnectTimer();
      connectAttemptsRef.current = 0;
      joinErrorNotifiedRef.current = false;
      attemptJoin(false);
    };

    const handleDisconnect = () => {
      joinInFlightRef.current = false;
      setSocket(null);
      scheduleConnectTimeout();
    };
    const handleReconnect = () => {
      scheduleConnectTimeout();
      attemptJoin(true);
    };

    const handleConnectError = (error: Error) => {
      clientLog("error", "socket connect error", error.message);
      connectAttemptsRef.current += 1;
      if (connectAttemptsRef.current >= MAX_CONNECT_ATTEMPTS) {
        notifyJoinError("SIGNALING_CONNECT_FAILED");
        createdSocket.disconnect();
      } else {
        scheduleConnectTimeout();
      }
    };

    const handleReconnectError = () => {
      connectAttemptsRef.current += 1;
      if (connectAttemptsRef.current >= MAX_CONNECT_ATTEMPTS) {
        notifyJoinError("SIGNALING_RECONNECT_FAILED");
        createdSocket.disconnect();
      }
    };

    createdSocket.on("connect", handleConnect);
    createdSocket.on("connect_error", handleConnectError);
    createdSocket.on("error", handleConnectError);
    createdSocket.on("disconnect", handleDisconnect);
    createdSocket.io.on("reconnect", handleReconnect);
    createdSocket.io.on("reconnect_error", handleReconnectError);
    createdSocket.io.on("reconnect_failed", () => {
      notifyJoinError("SIGNALING_RECONNECT_FAILED");
      createdSocket.disconnect();
    });

    return () => {
      clearConnectTimer();
      createdSocket.off("connect", handleConnect);
      createdSocket.off("connect_error", handleConnectError);
      createdSocket.off("error", handleConnectError);
      createdSocket.off("disconnect", handleDisconnect);
      createdSocket.io.off("reconnect", handleReconnect);
      createdSocket.io.off("reconnect_error", handleReconnectError);
      createdSocket.io.off("reconnect_failed");
      createdSocket.disconnect();
      joinInFlightRef.current = false;
      setSocket(null);
    };
  }, [connect, effectiveDisplayName, effectiveToken, effectiveUserId, onJoinError, roomId, rtcSessionId]);

  const value = useMemo(() => ({ socket }), [socket]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): Socket | null {
  return useContext(SocketContext).socket;
}
