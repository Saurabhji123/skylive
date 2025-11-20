"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useSessionStore } from "@/store/session-store";
import { clientLog } from "@/lib/logger";

interface SocketContextValue {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextValue>({ socket: null });

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

  useEffect(() => {
    if (!connect || !roomId || !effectiveUserId) {
      return;
    }

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
      extraHeaders
    });

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
            onJoinError?.(undefined);
            setSocket(createdSocket);
          } else {
            clientLog("warn", "socket join rejected", ack?.error);
            onJoinError?.(ack?.error ?? "JOIN_FAILED");
            createdSocket.disconnect();
          }
        }
      );
    };

    const handleConnect = () => attemptJoin(false);
    const handleDisconnect = () => {
      joinInFlightRef.current = false;
      setSocket(null);
    };
    const handleReconnect = () => attemptJoin(true);

    createdSocket.on("connect", handleConnect);
    createdSocket.on("disconnect", handleDisconnect);
    createdSocket.io.on("reconnect", handleReconnect);

    return () => {
      createdSocket.off("connect", handleConnect);
      createdSocket.off("disconnect", handleDisconnect);
      createdSocket.io.off("reconnect", handleReconnect);
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
