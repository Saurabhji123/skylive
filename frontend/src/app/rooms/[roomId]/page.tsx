"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type {
  ChatMessage,
  RoomSummary,
  Role,
  ParticipantsUpdatePayload,
  RoomParticipantSummary,
  ModerationActionPayload
} from "@skylive/shared";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { GlassCard } from "@/components/ui/glass-card";
import { ControlBar } from "@/components/room/control-bar";
import { ChatSidebar } from "@/components/room/chat-sidebar";
import { NetworkBanner } from "@/components/room/network-banner";
import { PreflightCheck } from "@/components/room/preflight-check";
import { useRtcStore } from "@/store/rtc-store";
import { useWebRTC } from "@/hooks/useWebRTC";
import { SocketProvider, useSocket } from "@/providers/socket-provider";
import { useSessionStore } from "@/store/session-store";
import { Button } from "@/components/ui/button";
import { roomStatusTokens } from "@/lib/room-status";
import { ParticipantRoster } from "@/components/room/participant-roster";
import { cn } from "@/lib/utils";
import { clientLog } from "@/lib/logger";
import { WhiteboardSurface } from "@/components/room/whiteboard-surface";
import { ReactionPalette } from "@/components/room/reaction-palette";
import { ReactionsOverlay } from "@/components/room/reactions-overlay";
import { useWhiteboard, WHITEBOARD_COLORS } from "@/hooks/useWhiteboard";
import { useReactions } from "@/hooks/useReactions";
import type { ReactionDefinition } from "@/components/icons/reaction-icons";

const MODERATION_ERROR_MESSAGES: Record<string, string> = {
  NOT_HOST: "Only hosts can perform this action.",
  TARGET_NOT_FOUND: "That participant has already left the room.",
  TARGET_REQUIRED: "Select a participant first.",
  CANNOT_TARGET_HOST: "Hosts cannot act on themselves.",
  NO_PARTICIPANTS: "No other participants are connected yet.",
  ROOM_ID_MISSING: "Room context missing. Refresh and try again.",
  NOT_JOINED: "Reconnect to the room before performing host actions."
};

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();
  const queryName = searchParams.get("username") ?? undefined;
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const { accessToken, displayName, userId, role } = useSessionStore();
  const username = displayName ?? queryName ?? "Guest";
  const router = useRouter();
  const [guestIdentity] = useState<{ userId: string } | null>(() => {
    if (userId) {
      return null;
    }

    const safeRoomId = roomId ?? "room";

    if (typeof window === "undefined") {
      return { userId: createGuestParticipantId(safeRoomId) };
    }

    const storageKey = `skylive-guest-${safeRoomId}`;
    const stored = window.sessionStorage.getItem(storageKey);
    const participantId = stored ?? createGuestParticipantId(safeRoomId);
    return { userId: participantId };
  });

  useEffect(() => {
    if (userId || !guestIdentity) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const safeRoomId = roomId ?? "room";
    const storageKey = `skylive-guest-${safeRoomId}`;
    if (!window.sessionStorage.getItem(storageKey)) {
      window.sessionStorage.setItem(storageKey, guestIdentity.userId);
    }
  }, [guestIdentity, roomId, userId]);

  const connectionIdentity = useMemo(
    () =>
      userId
        ? { userId, displayName: username, accessToken }
        : { userId: guestIdentity?.userId ?? createGuestParticipantId(roomId ?? "room"), displayName: username, accessToken: null },
    [accessToken, guestIdentity?.userId, roomId, userId, username]
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const state = await apiFetch<{ room: RoomSummary; messages: ChatMessage[] }>(`/state/rooms/${roomId}`, {
          token: accessToken ?? undefined
        });
        if (!active) {
          return;
        }
        setRoom(state.room);
        setInitialMessages(state.messages ?? []);
        setError(null);
        setErrorCode(null);
      } catch (err) {
        if (!active) {
          return;
        }
        if (err instanceof ApiClientError) {
          if (err.status === 404) {
            setError("This room is no longer available or may have already ended.");
            setErrorCode("ROOM_NOT_FOUND");
          } else if (err.status === 401) {
            setError("You're not authorized to join this room. Please sign in again.");
            setErrorCode("UNAUTHORIZED");
          } else {
            setError(err.message || "Failed to load room");
            setErrorCode(err.code ?? (err.status ? String(err.status) : null));
          }
        } else {
          setError(err instanceof Error ? err.message : "Failed to load room");
          setErrorCode(null);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [accessToken, roomId]);


  const handleErrorAction = () => {
    if (errorCode === "UNAUTHORIZED") {
      router.push("/auth/login");
      return;
    }
    router.push("/dashboard");
  };

  const shouldConnectSocket = Boolean(room && room.status !== "ended" && room.status !== "suspended" && !error);

  if (error) {
    const heading = errorCode === "UNAUTHORIZED" ? "Authorization required" : "Unable to join room";
    const actionLabel = errorCode === "UNAUTHORIZED" ? "Go to login" : "Return to dashboard";

    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <GlassCard className="flex w-full max-w-md flex-col items-center gap-4 text-center text-white">
          <h2 className="text-xl font-semibold">{heading}</h2>
          <p className="text-sm text-white/80">{error}</p>
          <Button onClick={handleErrorAction}>{actionLabel}</Button>
        </GlassCard>
      </main>
    );
  }

  if (room && room.status === "suspended") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <GlassCard className="flex w-full max-w-lg flex-col gap-4 text-center text-white">
          <h2 className="text-2xl font-semibold">Room suspended by host</h2>
          <p className="text-sm text-white/70">
            This screening room is no longer active. Reach out to the host if you believe it should be reopened, or start a
            fresh session from your dashboard.
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => router.push("/dashboard")}>Return to dashboard</Button>
          </div>
        </GlassCard>
      </main>
    );
  }

  return (
    <SocketProvider roomId={roomId} connect={shouldConnectSocket} identity={connectionIdentity}>
      <RoomExperience
        room={room}
        roomId={roomId}
        username={username}
        connectionIdentity={connectionIdentity}
        role={role}
        initialMessages={initialMessages}
        onRoomUpdate={(nextRoom) => setRoom(nextRoom)}
      />
    </SocketProvider>
  );
}

interface RoomExperienceProps {
  room: RoomSummary | null;
  roomId: string;
  username: string;
  connectionIdentity: { userId: string; displayName?: string; accessToken?: string | null };
  role?: Role;
  initialMessages: ChatMessage[];
  onRoomUpdate?: (room: RoomSummary) => void;
}

function RoomExperience({ room, roomId, username, connectionIdentity, role, initialMessages, onRoomUpdate }: RoomExperienceProps) {
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const viewerVideoRef = useRef<HTMLVideoElement | null>(null);
  const rtcState = useRtcStore();
  const webrtc = useWebRTC({ roomId, identity: connectionIdentity });
  const leaveSessionRef = useRef(webrtc.leaveSession);
  useEffect(() => {
    leaveSessionRef.current = webrtc.leaveSession;
  }, [webrtc.leaveSession]);
  const router = useRouter();
  const hasMediaReady = useMemo(
    () => Boolean(rtcState.localCameraStream && rtcState.localMicrophoneStream),
    [rtcState.localCameraStream, rtcState.localMicrophoneStream]
  );
  const [preflightAcknowledged, setPreflightAcknowledged] = useState<boolean>(hasMediaReady);
  const preflightComplete = hasMediaReady || preflightAcknowledged;
  const [roomEndError, setRoomEndError] = useState<string | null>(null);
  const [whiteboardError, setWhiteboardError] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [deviceErrorCode, setDeviceErrorCode] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRosterVisible, setIsRosterVisible] = useState(true);
  const rosterSectionRef = useRef<HTMLDivElement | null>(null);
  const activationAttemptRef = useRef(false);
  const [micBusy, setMicBusy] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [screenBusy, setScreenBusy] = useState(false);
  const [whiteboardBusy, setWhiteboardBusy] = useState(false);

  useEffect(() => {
    return () => {
      void leaveSessionRef.current();
    };
  }, []);

  const networkStats = useMemo(() => {
    const lastHeartbeat = rtcState.heartbeats.at(-1);
    return {
      quality: rtcState.networkQuality,
      rtt: lastHeartbeat?.rtt,
      jitter: lastHeartbeat?.quality === "excellent" ? 5 : lastHeartbeat?.quality === "good" ? 15 : 30
    };
  }, [rtcState.heartbeats, rtcState.networkQuality]);
  const hasActiveScreenFeed = useMemo(
    () => Boolean(rtcState.remoteScreenStream || rtcState.localScreenStream),
    [rtcState.localScreenStream, rtcState.remoteScreenStream]
  );

  const participantId = connectionIdentity.userId;
  const socket = useSocket();
  const { isPaletteOpen, togglePalette, closePalette, sendReaction, availableReactions, reactions } = useReactions({
    roomId,
    socket,
    userId: participantId,
    displayName: username,
  });
  const [participants, setParticipants] = useState<RoomParticipantSummary[]>([]);
  const [hostId, setHostId] = useState<string | null>(room?.hostId ?? null);
  const [presenterId, setPresenterId] = useState<string | null>(null);
  const [pendingModeration, setPendingModeration] = useState<{ userId: string; action: ModerationActionPayload["type"] } | null>(null);
  const [rosterFeedback, setRosterFeedback] = useState<string | null>(null);
  const rosterFeedbackTimer = useRef<number | null>(null);
  const selfJoinedAt = useMemo(() => new Date().toISOString(), []);
  const participantsForDisplay = useMemo(() => {
    if (!participants.length) {
      return [
        {
          userId: participantId,
          displayName: username,
          joinedAt: selfJoinedAt
        }
      ];
    }

    const hasSelf = participants.some((participant) => participant.userId === participantId);

    if (hasSelf) {
      return participants.map((participant) =>
        participant.userId === participantId
          ? {
              ...participant,
              displayName: username
            }
          : participant
      );
    }

    return [
      {
        userId: participantId,
        displayName: username,
        joinedAt: selfJoinedAt
      },
      ...participants
    ];
  }, [participants, participantId, username, selfJoinedAt]);

  const effectiveHostId = hostId ?? room?.hostId ?? null;
  const isHost = useMemo(() => {
    if (role === "host") {
      return true;
    }
    return Boolean(effectiveHostId && effectiveHostId === participantId);
  }, [effectiveHostId, participantId, role]);
  const roomEnded = webrtc.roomEnded;
  const roomEndedInfo = webrtc.roomEndedInfo;

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleParticipantsUpdate = (payload: ParticipantsUpdatePayload) => {
      if (payload.hostId) {
        setHostId(payload.hostId);
      } else if (room?.hostId) {
        setHostId(room.hostId);
      }
      setPresenterId(payload.presenterId ?? null);

      const rosterMap = new Map<string, RoomParticipantSummary>();
      payload.participants?.forEach((participant) => {
        rosterMap.set(participant.userId, {
          ...participant,
          displayName: participant.displayName ?? participant.userId
        });
      });

      rosterMap.set(participantId, {
        ...(rosterMap.get(participantId) ?? {}),
        userId: participantId,
        displayName: username,
        joinedAt: rosterMap.get(participantId)?.joinedAt ?? new Date().toISOString()
      });

      const effectiveHost = payload.hostId ?? room?.hostId ?? null;
      const effectivePresenter = payload.presenterId ?? null;

      const ordered = Array.from(rosterMap.values()).sort((a, b) => {
        if (effectiveHost && a.userId === effectiveHost && b.userId !== effectiveHost) return -1;
        if (effectiveHost && b.userId === effectiveHost && a.userId !== effectiveHost) return 1;
        if (effectivePresenter && a.userId === effectivePresenter && b.userId !== effectivePresenter) return -1;
        if (effectivePresenter && b.userId === effectivePresenter && a.userId !== effectivePresenter) return 1;
        const joinedA = a.joinedAt ?? "";
        const joinedB = b.joinedAt ?? "";
        return joinedA.localeCompare(joinedB);
      });

      setParticipants(ordered);
    };

    socket.on("participants:update", handleParticipantsUpdate);

    return () => {
      socket.off("participants:update", handleParticipantsUpdate);
    };
  }, [participantId, room?.hostId, socket, username]);

  useEffect(() => () => {
    if (rosterFeedbackTimer.current) {
      window.clearTimeout(rosterFeedbackTimer.current);
    }
  }, []);

  const emitModerationAction = useCallback(
    (action: ModerationActionPayload, buildMessage: (target?: RoomParticipantSummary) => string | null) => {
      if (!socket) {
        setRosterFeedback("Connection not ready. Try again in a moment.");
        return;
      }

      setPendingModeration({ userId: action.targetUserId, action: action.type });
      setRosterFeedback(null);

      socket.emit("moderation:action", action, (ack?: { ok: boolean; error?: string }) => {
        setPendingModeration(null);

        if (ack?.ok) {
          const target = participantsForDisplay.find((participant) => participant.userId === action.targetUserId);
          const message = buildMessage(target);
          if (message) {
            if (rosterFeedbackTimer.current) {
              window.clearTimeout(rosterFeedbackTimer.current);
            }
            setRosterFeedback(message);
            rosterFeedbackTimer.current = window.setTimeout(() => setRosterFeedback(null), 4000);
          }
          return;
        }

        const errorKey = ack?.error ?? "";
        setRosterFeedback(MODERATION_ERROR_MESSAGES[errorKey] ?? "Unable to apply that action. Try again.");
      });
    },
    [participantsForDisplay, socket]
  );

  const handleSetPresenter = useCallback(
    (targetId: string) => {
      emitModerationAction(
        { type: "presenter", targetUserId: targetId },
        (target) => {
          if (!target) {
            return "Presenter updated.";
          }
          const name = target.displayName ?? "Participant";
          return `${name} is now presenting.`;
        }
      );
    },
    [emitModerationAction]
  );

  const handleMuteParticipant = useCallback(
    (targetId: string) => {
      emitModerationAction(
        { type: "mute", targetUserId: targetId },
        (target) => {
          const name = target?.displayName ?? "Participant";
          return `${name}'s microphone was muted.`;
        }
      );
    },
    [emitModerationAction]
  );

  const handleRemoveParticipant = useCallback(
    (targetId: string) => {
      emitModerationAction(
        { type: "block", targetUserId: targetId },
        (target) => {
          const name = target?.displayName ?? "Participant";
          return `${name} was removed from the session.`;
        }
      );
    },
    [emitModerationAction]
  );

  const effectivePresenterId = presenterId ?? effectiveHostId ?? null;
  const presenterParticipant = useMemo(
    () => (effectivePresenterId ? participantsForDisplay.find((participant) => participant.userId === effectivePresenterId) ?? null : null),
    [effectivePresenterId, participantsForDisplay]
  );
  const presenterLabel = presenterParticipant?.displayName ?? (effectivePresenterId === participantId ? username : "Presenter");
  const presenterBadge = effectivePresenterId && effectivePresenterId === effectiveHostId ? "Host" : "Presenter";
  const localBadge = useMemo(() => {
    if (participantId === effectiveHostId && participantId === effectivePresenterId) {
      return "Host & Presenter";
    }
    if (participantId === effectiveHostId) {
      return "Host";
    }
    if (participantId === effectivePresenterId) {
      return "Presenter";
    }
    return "You";
  }, [effectiveHostId, effectivePresenterId, participantId]);
  const muteNotice = webrtc.moderationNotice?.type === "muted"
    ? webrtc.moderationNotice.reason ?? "The host muted your microphone. You can unmute when you're ready."
    : null;

  const canAnnotateWhiteboard = useMemo(
    () => Boolean(isHost || (effectivePresenterId && effectivePresenterId === participantId)),
    [effectivePresenterId, isHost, participantId]
  );

  const whiteboard = useWhiteboard({
    socket,
    roomId,
    participantId,
    canAnnotate: canAnnotateWhiteboard,
    isHost,
  });

  const {
    state: whiteboardState,
    isActive: isWhiteboardActive,
    canAnnotate: userCanAnnotateWhiteboard,
    tool: whiteboardTool,
    color: whiteboardColor,
    size: whiteboardSize,
    setTool: setWhiteboardTool,
    setColor: setWhiteboardColor,
    setSize: setWhiteboardSize,
    toggle: toggleWhiteboard,
    sendStroke: sendWhiteboardStroke,
    clear: clearWhiteboard,
  } = whiteboard;

  useEffect(() => {
    const element = viewerVideoRef.current;
    if (!element) {
      return;
    }

    const nextStream = isWhiteboardActive ? null : rtcState.remoteScreenStream ?? rtcState.localScreenStream;

    if (nextStream) {
      if (element.srcObject !== nextStream) {
        element.srcObject = nextStream;
      }
    } else if (element.srcObject) {
      element.srcObject = null;
    }
  }, [isWhiteboardActive, rtcState.localScreenStream, rtcState.remoteScreenStream]);

  useEffect(() => {
    if (!room) {
      return;
    }
    if (!isHost) {
      return;
    }
    if (!preflightComplete) {
      return;
    }
    if (!connectionIdentity.accessToken) {
      return;
    }
    if (room.status === "suspended") {
      return;
    }

    if (room.status === "live") {
      activationAttemptRef.current = true;
      return;
    }

    if (activationAttemptRef.current) {
      return;
    }

    activationAttemptRef.current = true;
    void (async () => {
      try {
        const payload = await apiFetch<{ room: RoomSummary }>(`/rooms/${roomId}/activate`, {
          method: "POST",
          token: connectionIdentity.accessToken ?? undefined
        });
        onRoomUpdate?.(payload.room);
      } catch (err) {
        activationAttemptRef.current = false;
        clientLog("error", "Failed to activate room", err);
      }
    })();
  }, [connectionIdentity.accessToken, isHost, onRoomUpdate, preflightComplete, room, roomId]);

  const endedAtLabel = useMemo(() => {
    if (!roomEndedInfo?.endedAt) {
      return null;
    }
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(roomEndedInfo.endedAt));
  }, [roomEndedInfo]);

  const handlePreflightContinue = async (options?: { skipDeviceChecks?: boolean }) => {
    if (options?.skipDeviceChecks) {
      setPreflightAcknowledged(true);
      return;
    }

    const tasks: Array<Promise<void>> = [];
    if (!rtcState.localCameraStream) {
      tasks.push(webrtc.startCamera());
    }
    if (!rtcState.localMicrophoneStream) {
      tasks.push(webrtc.startMicrophone());
    }

    if (!tasks.length) {
      setPreflightAcknowledged(true);
      return;
    }

    const results = await Promise.allSettled(tasks);
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");

    if (failures.length === tasks.length) {
      const reason = failures[0]?.reason;
      const message = reason instanceof Error ? reason.message : "We couldn't access your camera or microphone. Check permissions or skip for now.";
      throw new Error(message);
    }

    setPreflightAcknowledged(true);
  };

  const handleToggleMic = useCallback(async () => {
    if (micBusy) {
      return;
    }

    if (rtcState.microphonePermission === "denied") {
      setDeviceError("Microphone access is blocked. Enable permissions in your browser settings to unmute.");
      setDeviceErrorCode("MIC_PERMISSION_DENIED");
      return;
    }

    setMicBusy(true);
    try {
      if (webrtc.isMicMuted) {
        await webrtc.startMicrophone();
      } else {
        webrtc.stopMicrophone();
      }
      if (deviceErrorCode === "MIC_PERMISSION_DENIED" || deviceErrorCode === "MIC_TOGGLE_FAILED") {
        setDeviceError(null);
        setDeviceErrorCode(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to toggle the microphone.";
      setDeviceError(message);
      setDeviceErrorCode("MIC_TOGGLE_FAILED");
    } finally {
      setMicBusy(false);
    }
  }, [deviceErrorCode, micBusy, rtcState.microphonePermission, webrtc]);

  const handleToggleCamera = useCallback(async () => {
    if (cameraBusy) {
      return;
    }

    if (rtcState.cameraPermission === "denied") {
      setDeviceError("Camera access is blocked. Allow access in your browser settings to enable video.");
      setDeviceErrorCode("CAMERA_PERMISSION_DENIED");
      return;
    }

    setCameraBusy(true);
    try {
      if (webrtc.isCameraMuted) {
        await webrtc.startCamera();
      } else {
        webrtc.stopCamera();
      }
      if (deviceErrorCode === "CAMERA_PERMISSION_DENIED" || deviceErrorCode === "CAMERA_TOGGLE_FAILED") {
        setDeviceError(null);
        setDeviceErrorCode(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to toggle the camera.";
      setDeviceError(message);
      setDeviceErrorCode("CAMERA_TOGGLE_FAILED");
    } finally {
      setCameraBusy(false);
    }
  }, [cameraBusy, deviceErrorCode, rtcState.cameraPermission, webrtc]);

  const handleToggleWhiteboard = useCallback(async () => {
    if (!isHost || whiteboardBusy) {
      return;
    }

    setWhiteboardBusy(true);
    setWhiteboardError(null);

    try {
      if (isWhiteboardActive) {
        const ack = await toggleWhiteboard(false);
        if (!ack?.ok) {
          setWhiteboardError(ack?.error ?? "Unable to close the whiteboard. Try again.");
        }
        return;
      }

      if (webrtc.isScreenSharing) {
        await webrtc.stopScreenShare();
      }

      const ack = await toggleWhiteboard(true);
      if (!ack?.ok) {
        setWhiteboardError(ack?.error ?? "Unable to open the whiteboard. Try again.");
      }
    } finally {
      setWhiteboardBusy(false);
    }
  }, [isHost, isWhiteboardActive, toggleWhiteboard, webrtc, whiteboardBusy]);

  const handleReactionSelect = useCallback(
    (reaction: ReactionDefinition) => {
      sendReaction(reaction.emoji);
      closePalette();
    },
    [closePalette, sendReaction]
  );

  const handleClearWhiteboard = useCallback(() => {
    if (!isHost) {
      return;
    }
    setWhiteboardError(null);
    void clearWhiteboard().then((ack) => {
      if (!ack?.ok) {
        setWhiteboardError(ack?.error ?? "Unable to clear the whiteboard. Try again.");
      }
    });
  }, [clearWhiteboard, isHost]);

  const activeWhiteboardError = isWhiteboardActive ? whiteboardError : null;

  const handleToggleRosterVisibility = useCallback(() => {
    setIsRosterVisible((current) => {
      const next = !current;
      if (!current) {
        window.setTimeout(() => {
          rosterSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 16);
      }
      return next;
    });
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    if (typeof document === "undefined") {
      return;
    }

    const container = layoutRef.current;
    if (!container) {
      return;
    }

    if (!document.fullscreenElement) {
      if (container.requestFullscreen) {
        await container.requestFullscreen();
      }
    } else if (document.exitFullscreen) {
      await document.exitFullscreen();
    }
  }, []);

  const handleToggleShare = useCallback(async () => {
    if (screenBusy) {
      return;
    }
    setScreenBusy(true);
    try {
      if (webrtc.isScreenSharing) {
        await webrtc.stopScreenShare();
        return;
      }
      if (isHost && isWhiteboardActive) {
        const ack = await toggleWhiteboard(false);
        if (!ack?.ok) {
          setWhiteboardError(ack?.error ?? "Unable to close the whiteboard. Try again.");
          return;
        }
      }
      await webrtc.startScreenShare();
    } finally {
      setScreenBusy(false);
    }
  }, [isHost, isWhiteboardActive, screenBusy, toggleWhiteboard, webrtc]);

  const handleEndSession = async () => {
    await webrtc.leaveSession();
  };

  const handleEndRoom = async () => {
    try {
      await webrtc.endRoom();
      setRoomEndError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to end room";
      setRoomEndError(message);
    }
  };

  const handleExitAfterEnd = () => {
    router.push("/dashboard");
  };

  if (webrtc.moderationNotice?.type === "kicked") {
    const removalMessage = webrtc.moderationNotice.reason ?? "The host removed you from this session.";
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <GlassCard className="flex w-full max-w-xl flex-col gap-4 text-center text-white">
          <h2 className="text-2xl font-semibold">Removed by host</h2>
          <p className="text-sm text-white/70">{removalMessage}</p>
          <div className="flex justify-center">
            <Button variant="secondary" onClick={handleExitAfterEnd}>
              Return to dashboard
            </Button>
          </div>
        </GlassCard>
      </main>
    );
  }

  if (room && room.status === "ended" && !roomEnded) {
    const endedAt = room.endedAt ? new Date(room.endedAt).toLocaleString() : null;
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <GlassCard className="flex w-full max-w-xl flex-col gap-4 text-center text-white">
          <h2 className="text-2xl font-semibold">Room has ended</h2>
          <p className="text-sm text-white/70">
            This session wrapped up{endedAt ? ` at ${endedAt}` : ""}. Launch a new room from your dashboard to host another screening.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={handleExitAfterEnd}>
              Return to dashboard
            </Button>
          </div>
        </GlassCard>
      </main>
    );
  }

  if (roomEnded && roomEndedInfo) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <GlassCard className="flex w-full max-w-xl flex-col gap-4 text-center text-white">
          <h2 className="text-2xl font-semibold">Room has ended</h2>
          <p className="text-sm text-white/70">
            {roomEndedInfo.endedBy === participantId ? "You" : "The host"} ended this session
            {endedAtLabel ? ` at ${endedAtLabel}` : ""}. Thank you for joining Skylive.
          </p>
          {roomEndError ? <p className="text-sm text-red-300">{roomEndError}</p> : null}
          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={handleExitAfterEnd}>
              Return to dashboard
            </Button>
          </div>
        </GlassCard>
      </main>
    );
  }

  if (!preflightComplete) {
    return <PreflightCheck displayName={username} onContinue={handlePreflightContinue} />;
  }

  return (
    <main
      ref={layoutRef}
      className={cn(
        "mx-auto min-h-screen w-full px-6 py-10 text-white transition-[max-width]",
        isFullscreen ? "max-w-none" : "max-w-7xl"
      )}
    >
      <div className="grid min-h-[calc(100vh-8rem)] gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(320px,1fr)]">
        <section className="flex flex-col rounded-3xl border border-white/15 bg-black/30 p-6 shadow-[0_25px_90px_rgba(15,23,42,0.45)] backdrop-blur">
          <header className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-semibold">{room ? `Room ${room.roomCode}` : "Loading room"}</h1>
                {room ? (
                  <span className={`rounded-full px-3 py-1 text-xs ${roomStatusTokens[room.status].className}`}>
                    {roomStatusTokens[room.status].label}
                  </span>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="border border-white/15 bg-white/10 text-xs uppercase tracking-[0.3em] text-white/70 hover:border-white/30 hover:text-white"
                onClick={() => clientLog("info", "Open device settings")}
              >
                Settings
              </Button>
            </div>
            <NetworkBanner
              quality={networkStats.quality}
              rtt={networkStats.rtt}
              jitter={networkStats.jitter}
              reconnecting={webrtc.isReconnecting && !roomEnded}
              reconnectAttempts={roomEnded ? 0 : webrtc.reconnectAttempts}
            />
            {muteNotice ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
                <span>{muteNotice}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="border border-transparent text-amber-200 hover:bg-amber-500/20"
                  onClick={() => webrtc.clearModerationNotice()}
                >
                  Dismiss
                </Button>
              </div>
            ) : null}
            {roomEndError && !roomEnded ? <p className="text-sm text-red-300">{roomEndError}</p> : null}
            {deviceError ? <p className="text-sm text-red-300">{deviceError}</p> : null}
            {activeWhiteboardError ? <p className="text-sm text-red-300">{activeWhiteboardError}</p> : null}
          </header>
          <div className="mt-6 flex flex-1 flex-col gap-6">
            <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/12 bg-black/70">
              <video
                ref={viewerVideoRef}
                className={cn(
                  "h-full w-full object-contain transition-opacity duration-200",
                  isWhiteboardActive ? "opacity-0" : "opacity-100"
                )}
                autoPlay
                playsInline
                controls={false}
              />
              <ReactionsOverlay reactions={reactions} />
              <button
                type="button"
                onClick={() => {
                  void handleToggleFullscreen();
                }}
                className="absolute left-6 top-6 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:border-white/40 hover:bg-white/15"
                aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
              >
                <FullscreenGlyph exit={isFullscreen} />
                <span className="sr-only">{isFullscreen ? "Exit full screen" : "Enter full screen"}</span>
              </button>
              {isWhiteboardActive ? (
                <WhiteboardSurface
                  state={whiteboardState}
                  isActive={isWhiteboardActive}
                  canAnnotate={userCanAnnotateWhiteboard}
                  tool={whiteboardTool}
                  color={whiteboardColor}
                  colors={Array.from(WHITEBOARD_COLORS)}
                  size={whiteboardSize}
                  onToolChange={setWhiteboardTool}
                  onColorChange={setWhiteboardColor}
                  onSizeChange={setWhiteboardSize}
                  onClear={handleClearWhiteboard}
                  sendStroke={sendWhiteboardStroke}
                  presenterName={presenterParticipant?.displayName ?? undefined}
                  canClear={isHost}
                />
              ) : null}
              {!isWhiteboardActive && !hasActiveScreenFeed ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rounded-2xl border border-white/20 bg-white/5 px-6 py-4 text-sm text-white/70">
                    Waiting for a shared screen
                  </div>
                </div>
              ) : null}
              <ReactionPalette
                reactions={availableReactions}
                isOpen={isPaletteOpen}
                onSelect={handleReactionSelect}
                onClose={closePalette}
              />
            </div>
            <ControlBar
              isMicMuted={webrtc.isMicMuted}
              isCameraMuted={webrtc.isCameraMuted}
              isScreenSharing={webrtc.isScreenSharing}
              isWhiteboardActive={isWhiteboardActive}
              areReactionsActive={isPaletteOpen}
              isRosterVisible={isRosterVisible}
              onToggleMic={handleToggleMic}
              onToggleCamera={handleToggleCamera}
              onToggleScreenShare={handleToggleShare}
              onStopScreenShare={() => webrtc.stopScreenShare()}
              onToggleWhiteboard={isHost ? handleToggleWhiteboard : undefined}
              onToggleReactions={togglePalette}
              onToggleRoster={handleToggleRosterVisibility}
              onEndSession={handleEndSession}
              canEndRoom={isHost}
              onEndRoom={() => handleEndRoom()}
              roomEnded={roomEnded}
              isMicBusy={micBusy}
              isCameraBusy={cameraBusy}
              isScreenBusy={screenBusy}
              isWhiteboardBusy={whiteboardBusy}
            />
          </div>
        </section>
        <aside className="flex max-h-[calc(100vh-8rem)] flex-col gap-4 overflow-y-auto rounded-3xl border border-white/15 bg-black/30 p-6 backdrop-blur">
          <div className="flex flex-col gap-3">
            <p className="text-xs uppercase tracking-[0.35em] text-white/50">Live cameras</p>
            <div className="flex flex-col gap-3">
              <CameraTile
                label={presenterLabel}
                badge={presenterBadge}
                stream={rtcState.remoteCameraStream}
                muted={false}
                placeholder="Waiting for presenter feed"
              />
              <CameraTile
                label={username}
                badge={localBadge}
                stream={rtcState.localCameraStream}
                muted
                placeholder="Your camera is off"
                flipForUser
              />
            </div>
          </div>
          {isRosterVisible ? (
            <div ref={rosterSectionRef} className="shrink-0">
              <ParticipantRoster
                participants={participantsForDisplay}
                hostId={effectiveHostId}
                presenterId={effectivePresenterId}
                currentUserId={participantId}
                isHost={isHost}
                busyUserId={pendingModeration?.userId ?? null}
                feedback={rosterFeedback}
                onSetPresenter={isHost ? handleSetPresenter : undefined}
                onMuteParticipant={isHost ? handleMuteParticipant : undefined}
                onRemoveParticipant={isHost ? handleRemoveParticipant : undefined}
              />
            </div>
          ) : (
            <GlassCard className="flex flex-col gap-3 border border-white/12 bg-white/5 p-4 text-sm text-white/70">
              <span>Participant list hidden.</span>
              <Button
                variant="ghost"
                size="sm"
                className="self-start border border-white/20"
                onClick={() => setIsRosterVisible(true)}
              >
                Show users
              </Button>
            </GlassCard>
          )}
          <div className="min-h-0 flex-1">
            <ChatSidebar
              roomId={roomId}
              userId={participantId}
              displayName={username}
              initialMessages={initialMessages}
              disabled={roomEnded || room?.status === "suspended"}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}

function createGuestParticipantId(roomKey: string): string {
  const randomId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);
  return `guest-${roomKey}-${randomId}`;
}

interface CameraTileProps {
  label: string;
  badge?: string | null;
  stream?: MediaStream | null;
  muted?: boolean;
  placeholder: string;
  flipForUser?: boolean;
}

function CameraTile({ label, badge, stream, muted = true, placeholder, flipForUser = false }: CameraTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shouldFlip = useMemo(() => {
    if (!flipForUser) {
      return false;
    }
    const track = stream?.getVideoTracks()[0];
    if (!track) {
      return false;
    }
    return track.getSettings().facingMode === "user";
  }, [flipForUser, stream]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }

    if (stream) {
      if (element.srcObject !== stream) {
        element.srcObject = stream;
      }
    } else if (element.srcObject) {
      element.srcObject = null;
    }
  }, [stream]);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/12 bg-black/50 p-3 text-white">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/50">
        <span className="truncate">{label}</span>
        {badge ? (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium tracking-[0.2em] text-white/60">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="aspect-video overflow-hidden rounded-xl bg-black/40">
        {stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
            className={cn("h-full w-full object-cover", shouldFlip ? "scale-x-[-1]" : "")}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-xs text-white/50">{placeholder}</div>
        )}
      </div>
    </div>
  );
}

function FullscreenGlyph({ exit }: { exit: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      {exit ? (
        <>
          <path d="M9 3H5v4" />
          <path d="M15 3h4v4" />
          <path d="M9 21H5v-4" />
          <path d="M15 21h4v-4" />
          <path d="M15 5l-4 4" />
          <path d="M9 19l4-4" />
        </>
      ) : (
        <>
          <path d="M9 4H4v5" />
          <path d="M15 4h5v5" />
          <path d="M9 20H4v-5" />
          <path d="M15 20h5v-5" />
          <path d="M10 10L4 4" opacity={0.25} />
          <path d="M14 14l6 6" opacity={0.25} />
        </>
      )}
    </svg>
  );
}

