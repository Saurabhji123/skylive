"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/providers/socket-provider";
import { useSessionStore } from "@/store/session-store";
import { useRtcStore } from "@/store/rtc-store";
import type {
  SignalingEvent,
  HeartbeatPayload,

  ScreenShareState,
  SignalingOffer,
  SignalingAnswer,
  RoomEndRequestPayload,
  RoomEndedPayload
} from "@skylive/shared";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { clientLog } from "@/lib/logger";

interface UseWebRTCOptions {
  roomId: string;
  identity?: {
    userId: string;
    displayName?: string;
    accessToken?: string | null;
  };
}

interface UseWebRTCReturn {
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  startMicrophone: () => Promise<void>;
  stopMicrophone: () => void;
  muteMicrophone: () => void;
  unmuteMicrophone: () => void;
  startScreenShare: (source?: "screen" | "window" | "tab") => Promise<void>;
  stopScreenShare: () => Promise<void>;
  switchScreenShare: (source: "screen" | "window" | "tab") => Promise<void>;
  enterFullscreen: (element: HTMLVideoElement) => Promise<void>;
  leaveSession: () => Promise<void>;
  retryConnection: () => Promise<void>;
  endRoom: (reason?: string) => Promise<void>;
  isMicMuted: boolean;
  isCameraMuted: boolean;
  isScreenSharing: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  reconnectFailed: boolean;
  roomEnded: boolean;
  roomEndedInfo: RoomEndedPayload | null;
  moderationNotice: ModerationNotice | null;
  clearModerationNotice: () => void;
}

interface ModerationNotice {
  type: "muted" | "kicked";
  reason?: string;
  by?: string;
}

const HEARTBEAT_INTERVAL = 5000;
const MAX_RECONNECT_ATTEMPTS = 3;

export function useWebRTC({ roomId, identity }: UseWebRTCOptions): UseWebRTCReturn {
  const socket = useSocket();
  const { accessToken: sessionToken, userId: sessionUserId, markSessionExpired } = useSessionStore();
  const participantId = identity?.userId ?? sessionUserId ?? "anonymous";
  const tokenOverride = identity?.accessToken;
  const authToken = tokenOverride === undefined ? sessionToken : tokenOverride ?? undefined;
  const rtcStore = useRtcStore();
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localMicTrack = useRef<MediaStreamTrack | null>(null);
  const screenSession = useRef<ScreenShareState | null>(null);
  const cameraSenderRef = useRef<RTCRtpSender | null>(null);
  const micSenderRef = useRef<RTCRtpSender | null>(null);
  const screenVideoSenderRef = useRef<RTCRtpSender | null>(null);
  const screenAudioSenderRef = useRef<RTCRtpSender | null>(null);
  const lastLatencyRef = useRef<number | null>(null);
  const heartbeatTimer = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isReconnectingRef = useRef(false);
  const [isMicMuted, setMicMuted] = useState(true);
  const [isCameraMuted, setCameraMuted] = useState(true);
  const [isScreenSharing, setScreenSharing] = useState(false);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([]);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [reconnectFailed, setReconnectFailed] = useState(false);
  const [roomEndedInfo, setRoomEndedInfo] = useState<RoomEndedPayload | null>(null);
  const [moderationNotice, setModerationNotice] = useState<ModerationNotice | null>(null);
  const permissionRefs = useRef<{ camera?: PermissionStatus; microphone?: PermissionStatus }>({});

  const syncPermissionState = useCallback(
    async (device: "camera" | "microphone") => {
      if (typeof navigator === "undefined" || !navigator.permissions?.query) {
        return undefined;
      }

      try {
        const status = await navigator.permissions.query({ name: device as PermissionName });
        permissionRefs.current[device] = status;

        const state = status.state as PermissionState;
        if (device === "camera") {
          rtcStore.setDeviceState({ cameraPermission: state });
        } else {
          rtcStore.setDeviceState({ microphonePermission: state });
        }

        status.onchange = () => {
          const nextState = status.state as PermissionState;
          if (device === "camera") {
            rtcStore.setDeviceState({ cameraPermission: nextState });
          } else {
            rtcStore.setDeviceState({ microphonePermission: nextState });
          }
        };

        return state;
      } catch (error) {
        clientLog("warn", `Unable to query ${device} permission`, error);
        if (device === "camera") {
          rtcStore.setDeviceState({ cameraPermission: undefined });
        } else {
          rtcStore.setDeviceState({ microphonePermission: undefined });
        }
        return undefined;
      }
    },
    [rtcStore]
  );

  useEffect(() => {
    void syncPermissionState("camera");
    void syncPermissionState("microphone");

    return () => {
      if (permissionRefs.current.camera) {
        permissionRefs.current.camera.onchange = null;
      }
      if (permissionRefs.current.microphone) {
        permissionRefs.current.microphone.onchange = null;
      }
    };
  }, [syncPermissionState]);

  const determineQuality = (latency: number): HeartbeatPayload["quality"] => {
    if (latency < 80) return "excellent";
    if (latency < 160) return "good";
    if (latency < 280) return "poor";
    return "critical";
  };

  useEffect(() => {
    if (!authToken) {
      return;
    }

    let cancelled = false;

    async function hydrateIceServers() {
      try {
        const { iceServers: servers } = await apiFetch<{ iceServers: RTCIceServer[] }>("/rtc/turn", {
          method: "GET",
          token: authToken
        });
        if (!cancelled) {
          setIceServers(servers);
        }
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 401) {
          markSessionExpired();
          clientLog("warn", "Access token expired while fetching ICE servers. Marking session expired.");
        } else if (!cancelled) {
          clientLog("error", "Failed to fetch ICE servers", error);
        }
      }
    }

    void hydrateIceServers();

    return () => {
      cancelled = true;
    };
  }, [authToken, markSessionExpired]);

  const startHeartbeat = useCallback(() => {
    if (!socket || !participantId) {
      return;
    }
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current);
    }

    heartbeatTimer.current = setInterval(() => {
      const heartbeat: HeartbeatPayload = {
        userId: participantId ?? "anonymous",
        roomId,
        timestamp: Date.now(),
        rtt: 0,
        quality: rtcStore.networkQuality
      };

      socket.emit("signal", { type: "heartbeat", payload: heartbeat } satisfies SignalingEvent);
    }, HEARTBEAT_INTERVAL);
  }, [participantId, roomId, rtcStore.networkQuality, socket]);

  const resetReconnectState = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    isReconnectingRef.current = false;
    setReconnectAttempts(0);
    setIsReconnecting(false);
    setReconnectFailed(false);
  }, []);

  const attemptReconnect = useCallback(async () => {
    const peer = peerRef.current;
    if (!peer || !socket) {
      return;
    }

    if (peer.connectionState === "closed") {
      return;
    }

    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      clientLog("warn", "Reached maximum ICE restarts");
      isReconnectingRef.current = false;
      setIsReconnecting(false);
      setReconnectFailed(true);
      return;
    }

    reconnectAttemptsRef.current += 1;
    setReconnectAttempts(reconnectAttemptsRef.current);

    if (!isReconnectingRef.current) {
      isReconnectingRef.current = true;
      setIsReconnecting(true);
    }

    try {
      const peerConnection = peerRef.current;
      if (!peerConnection) {
        return;
      }

      const offer = await peerConnection.createOffer({ iceRestart: true });
      await peerConnection.setLocalDescription(offer);
      const sdp = offer.sdp ?? peerConnection.localDescription?.sdp;
      if (sdp) {
        const offerPayload: SignalingOffer = {
          type: "offer",
          sdp
        };
        socket.emit("signal", { type: "offer", payload: offerPayload, metadata: { reconnect: true } } as SignalingEvent & {
          metadata?: { reconnect: boolean };
        });
      }
    } catch (error) {
      clientLog("error", "Failed to restart ICE", error);
    }
  }, [socket]);

  const ensurePeer = useCallback(
    async (mode: "active" | "passive" = "active") => {
      if (peerRef.current) {
        return peerRef.current;
      }

      const configuration: RTCConfiguration = {
        iceServers: iceServers.length ? iceServers : [{ urls: "stun:stun.l.google.com:19302" }],
        iceTransportPolicy: "all"
      };

      const peer = new RTCPeerConnection(configuration);
      peerRef.current = peer;

      peer.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream) return;

        if (event.track.kind === "video") {
          const isScreen = isLikelyScreenShareTrack(event.track);
          if (isScreen) {
            rtcStore.setStreamState({ remoteScreenStream: stream });
          } else {
            rtcStore.setStreamState({ remoteCameraStream: stream });
          }
        }

        if (event.track.kind === "audio") {
          const currentState = useRtcStore.getState();
          if (!currentState.remoteCameraStream) {
            rtcStore.setStreamState({ remoteCameraStream: stream });
          }
        }
      };

      peer.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit("signal", {
            type: "ice-candidate",
            payload: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid ?? undefined,
              sdpMLineIndex: event.candidate.sdpMLineIndex ?? undefined
            }
          } satisfies SignalingEvent);
        }
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") {
          resetReconnectState();
        }

        if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
          clientLog("warn", "Peer connection state", peer.connectionState);
          void attemptReconnect();
        }
      };

      peer.oniceconnectionstatechange = () => {
        if (peer.iceConnectionState === "connected" || peer.iceConnectionState === "completed") {
          resetReconnectState();
        }

        if (peer.iceConnectionState === "failed" || peer.iceConnectionState === "disconnected") {
          clientLog("warn", "ICE connection state", peer.iceConnectionState);
          void attemptReconnect();
        }
      };

      if (mode === "active" && socket) {
        const offer = await peer.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true });
        await peer.setLocalDescription(offer);
        const sdp = offer.sdp ?? peer.localDescription?.sdp;
        if (sdp) {
          const offerPayload: SignalingOffer = {
            type: "offer",
            sdp
          };
          socket.emit("signal", { type: "offer", payload: offerPayload } satisfies SignalingEvent);
        } else {
          clientLog("error", "Failed to generate SDP for offer");
        }
      }

      startHeartbeat();
      return peer;
    },
    [attemptReconnect, iceServers, resetReconnectState, rtcStore, socket, startHeartbeat]
  );

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleSignal = async (event: SignalingEvent & { from?: string }) => {
      if (!peerRef.current) {
        await ensurePeer("passive");
      }

      if (!peerRef.current) {
        return;
      }

      if (event.type === "offer") {
        await peerRef.current.setRemoteDescription({ type: "offer", sdp: event.payload.sdp });
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        const sdp = answer.sdp ?? peerRef.current.localDescription?.sdp;
        if (sdp) {
          const answerPayload: SignalingAnswer = {
            type: "answer",
            sdp
          };
          socket.emit("signal", { type: "answer", payload: answerPayload } satisfies SignalingEvent);
        } else {
          clientLog("error", "Failed to generate SDP for answer");
        }
      }

      if (event.type === "answer") {
        await peerRef.current.setRemoteDescription({ type: "answer", sdp: event.payload.sdp });
        resetReconnectState();
      }

      if (event.type === "ice-candidate" && event.payload.candidate) {
        try {
          await peerRef.current.addIceCandidate({
            candidate: event.payload.candidate,
            sdpMid: event.payload.sdpMid ?? undefined,
            sdpMLineIndex: event.payload.sdpMLineIndex ?? undefined
          });
        } catch (error) {
          clientLog("warn", "Failed to add ICE candidate", error);
        }
      }

      if (event.type === "share-started") {
        rtcStore.setScreenShareState(event.payload);
        setScreenSharing(true);
      }

      if (event.type === "share-stopped") {
        rtcStore.setScreenShareState(undefined);
        setScreenSharing(false);
      }

      if (event.type === "heartbeat") {
        const payload = event.payload as HeartbeatPayload & {
          latencyMs?: number;
          acknowledgedAt?: number;
        };
        const rawLatency =
          payload.latencyMs ?? (payload.acknowledgedAt ? payload.acknowledgedAt - payload.timestamp : payload.rtt);
        const latency = Math.max(0, rawLatency ?? 0);
        const previousLatency = lastLatencyRef.current;
        const jitter = previousLatency === null ? 0 : Math.abs(latency - previousLatency);
        lastLatencyRef.current = latency;
        const quality = determineQuality(latency);

        rtcStore.setNetworkQuality(quality);
        rtcStore.pushHeartbeat({
          ...payload,
          rtt: latency,
          quality,
          jitter
        } as HeartbeatPayload);
      }
    };

    socket.on("signal", handleSignal);

    return () => {
      socket.off("signal", handleSignal);
    };
  }, [attemptReconnect, ensurePeer, resetReconnectState, rtcStore, socket]);

  const startCamera = useCallback(async () => {
    const permission = await syncPermissionState("camera");
    if (permission === "denied") {
      throw new Error("Camera access is blocked. Enable camera permissions in your browser settings to continue.");
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
    } catch (error) {
      if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
        rtcStore.setDeviceState({ cameraPermission: "denied" });
        throw new Error("Camera permissions are denied. Allow access and try again.");
      }

      throw new Error("Unable to start the camera. Check your device settings and try again.");
    }

    const peer = await ensurePeer();
    const [videoTrack] = stream.getVideoTracks();
    if (!videoTrack) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    if (rtcStore.localCameraStream) {
      rtcStore.localCameraStream.getTracks().forEach((track) => track.stop());
    }

    if (cameraSenderRef.current && peerRef.current) {
      try {
        peerRef.current.removeTrack(cameraSenderRef.current);
      } catch (error) {
        clientLog("warn", "Failed to remove previous camera sender", error);
      }
      cameraSenderRef.current = null;
    }

    cameraSenderRef.current = peer.addTrack(videoTrack, stream);
    rtcStore.setStreamState({ localCameraStream: stream });
    rtcStore.setDeviceState({ cameraPermission: "granted" });
    setCameraMuted(false);
  }, [ensurePeer, rtcStore, syncPermissionState]);

  const startMicrophone = useCallback(async () => {
    const permission = await syncPermissionState("microphone");
    if (permission === "denied") {
      throw new Error("Microphone access is blocked. Enable the microphone in your browser settings to continue.");
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false
      });
    } catch (error) {
      if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
        rtcStore.setDeviceState({ microphonePermission: "denied" });
        throw new Error("Microphone permissions are denied. Allow access and try again.");
      }

      throw new Error("Unable to start the microphone. Check your input device and try again.");
    }

    const [track] = stream.getAudioTracks();
    if (!track) {
      stream.getTracks().forEach((item) => item.stop());
      return;
    }

    const peer = await ensurePeer();
    if (rtcStore.localMicrophoneStream) {
      rtcStore.localMicrophoneStream.getTracks().forEach((currentTrack) => currentTrack.stop());
    }

    if (micSenderRef.current && peerRef.current) {
      try {
        peerRef.current.removeTrack(micSenderRef.current);
      } catch (error) {
        clientLog("warn", "Failed to remove previous mic sender", error);
      }
      micSenderRef.current = null;
    }

    micSenderRef.current = peer.addTrack(track, stream);
    localMicTrack.current = track;
    rtcStore.setStreamState({ localMicrophoneStream: stream });
    rtcStore.setDeviceState({ microphonePermission: "granted" });
    setMicMuted(false);
  }, [ensurePeer, rtcStore, syncPermissionState]);

  const stopMicrophone = useCallback(() => {
    if (peerRef.current && micSenderRef.current) {
      try {
        peerRef.current.removeTrack(micSenderRef.current);
      } catch (error) {
        clientLog("warn", "Failed to remove mic sender", error);
      }
    }
    micSenderRef.current = null;
    if (localMicTrack.current) {
      localMicTrack.current.stop();
      localMicTrack.current = null;
    }
    rtcStore.localMicrophoneStream?.getTracks().forEach((track) => track.stop());
    rtcStore.setStreamState({ localMicrophoneStream: undefined });
    setMicMuted(true);
  }, [rtcStore]);

  const muteMicrophone = useCallback(() => {
    stopMicrophone();
  }, [stopMicrophone]);

  const unmuteMicrophone = useCallback(() => {
    void startMicrophone();
  }, [startMicrophone]);

  const stopCamera = useCallback(() => {
    if (peerRef.current && cameraSenderRef.current) {
      try {
        peerRef.current.removeTrack(cameraSenderRef.current);
      } catch (error) {
        clientLog("warn", "Failed to remove camera sender", error);
      }
    }
    cameraSenderRef.current = null;
    rtcStore.localCameraStream?.getTracks().forEach((track) => track.stop());
    rtcStore.setStreamState({ localCameraStream: undefined });
    setCameraMuted(true);
  }, [rtcStore]);

  const stopScreenShare = useCallback(async () => {
    const wasSharing = Boolean(rtcStore.localScreenStream || screenVideoSenderRef.current || screenAudioSenderRef.current);
    if (peerRef.current && screenVideoSenderRef.current) {
      try {
        peerRef.current.removeTrack(screenVideoSenderRef.current);
      } catch (error) {
        clientLog("warn", "Failed to remove screen video sender", error);
      }
    }
    if (peerRef.current && screenAudioSenderRef.current) {
      try {
        peerRef.current.removeTrack(screenAudioSenderRef.current);
      } catch (error) {
        clientLog("warn", "Failed to remove screen audio sender", error);
      }
    }
    screenVideoSenderRef.current = null;
    screenAudioSenderRef.current = null;
    rtcStore.localScreenStream?.getTracks().forEach((track) => track.stop());
    rtcStore.localScreenAudioStream?.getTracks().forEach((track) => track.stop());
    rtcStore.setStreamState({ localScreenStream: undefined, localScreenAudioStream: undefined });
    setScreenSharing(false);
    screenSession.current = null;
    if (wasSharing) {
      socket?.emit("signal", {
        type: "share-stopped",
        payload: {
          roomId,
          presenterId: participantId,
          stoppedAt: new Date().toISOString()
        }
      } satisfies SignalingEvent);
    }
  }, [participantId, roomId, rtcStore, socket]);

  const startScreenShare = useCallback(
    async (source: "screen" | "window" | "tab" = "screen", switchEvents: ScreenShareState["switchEvents"] = []) => {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 60 }, displaySurface: source },
        audio: true
      });

      const peer = await ensurePeer();

      if (peerRef.current && screenVideoSenderRef.current) {
        try {
          peerRef.current.removeTrack(screenVideoSenderRef.current);
        } catch (error) {
          clientLog("warn", "Failed to remove previous screen video sender", error);
        }
        screenVideoSenderRef.current = null;
      }

      if (peerRef.current && screenAudioSenderRef.current) {
        try {
          peerRef.current.removeTrack(screenAudioSenderRef.current);
        } catch (error) {
          clientLog("warn", "Failed to remove previous screen audio sender", error);
        }
        screenAudioSenderRef.current = null;
      }

      const [videoTrack] = stream.getVideoTracks();
      const audioTrack = stream.getAudioTracks()[0];
      let audioStream: MediaStream | undefined;

      if (videoTrack) {
        screenVideoSenderRef.current = peer.addTrack(videoTrack, stream);
        videoTrack.addEventListener(
          "ended",
          () => {
            stopScreenShare().catch((error: unknown) => clientLog("warn", "Failed to stop share after video end", error));
          },
          { once: true }
        );
      }

      if (audioTrack) {
        audioStream = new MediaStream([audioTrack]);
        screenAudioSenderRef.current = peer.addTrack(audioTrack, audioStream);
        audioTrack.addEventListener(
          "ended",
          () => {
            stopScreenShare().catch((error: unknown) => clientLog("warn", "Failed to stop share after audio end", error));
          },
          { once: true }
        );
      }

      rtcStore.setStreamState({ localScreenStream: stream, localScreenAudioStream: audioStream });
      setScreenSharing(true);

      const state: ScreenShareState = {
        presenterId: participantId,
        mediaSource: source,
        isActive: true,
        startedAt: new Date().toISOString(),
        switchEvents
      };
      screenSession.current = state;
      socket?.emit("signal", { type: "share-started", payload: state } satisfies SignalingEvent);
    },
    [ensurePeer, participantId, rtcStore, socket, stopScreenShare]
  );

  const switchScreenShare = useCallback(
    async (source: "screen" | "window" | "tab") => {
      const previousSource = screenSession.current?.mediaSource ?? "screen";
      const history = [...(screenSession.current?.switchEvents ?? [])];
      history.push({
        switchedAt: new Date().toISOString(),
        fromSource: previousSource,
        toSource: source
      });

      await stopScreenShare();
      await startScreenShare(source, history);
    },
    [startScreenShare, stopScreenShare]
  );

  const enterFullscreen = useCallback(async (element: HTMLVideoElement) => {
    if (!document.fullscreenElement) {
      await element.requestFullscreen();
    }
  }, []);

  const teardownMedia = useCallback(async () => {
    try {
      await stopScreenShare();
    } catch (error) {
      clientLog("warn", "Failed to stop screen share during teardown", error);
    }

    stopCamera();
    stopMicrophone();
    rtcStore.setStreamState({
      remoteCameraStream: undefined,
      remoteScreenStream: undefined
    });
    screenSession.current = null;
  }, [rtcStore, stopCamera, stopMicrophone, stopScreenShare]);

  const leaveSession = useCallback(async () => {
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current);
    }
    await teardownMedia();
    peerRef.current?.close();
    peerRef.current = null;
    resetReconnectState();
    rtcStore.reset();
    setModerationNotice(null);
    cameraSenderRef.current = null;
    micSenderRef.current = null;
    screenVideoSenderRef.current = null;
    screenAudioSenderRef.current = null;
    heartbeatTimer.current = null;
  }, [resetReconnectState, rtcStore, teardownMedia]);

  const clearModerationNotice = useCallback(() => {
    setModerationNotice(null);
  }, []);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleForceMute = (payload?: { by?: string; reason?: string }) => {
      stopMicrophone();
      setModerationNotice({
        type: "muted",
        by: payload?.by,
        reason: payload?.reason ?? "Host muted your microphone."
      });
    };

    const handleKick = (payload?: { by?: string; reason?: string }) => {
      setModerationNotice({
        type: "kicked",
        by: payload?.by,
        reason: payload?.reason ?? "Host removed you from the room."
      });
      void leaveSession();
    };

    socket.on("moderation:force-mute", handleForceMute);
    socket.on("moderation:kick", handleKick);

    return () => {
      socket.off("moderation:force-mute", handleForceMute);
      socket.off("moderation:kick", handleKick);
    };
  }, [leaveSession, socket, stopMicrophone]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleRoomEnded = (payload: RoomEndedPayload) => {
      setRoomEndedInfo(payload);
      void leaveSession();
    };

    socket.on("room:ended", handleRoomEnded);

    return () => {
      socket.off("room:ended", handleRoomEnded);
    };
  }, [leaveSession, socket]);

  const retryConnection = useCallback(async () => {
    const existingCameraStream = rtcStore.localCameraStream ?? null;
    const existingMicStream = rtcStore.localMicrophoneStream ?? null;
    const existingScreenStream = rtcStore.localScreenStream ?? null;
    const existingScreenAudioStream = rtcStore.localScreenAudioStream ?? null;

    peerRef.current?.close();
    peerRef.current = null;
    resetReconnectState();
    setReconnectFailed(false);

    const peer = await ensurePeer("active");

    if (existingCameraStream) {
      const [cameraTrack] = existingCameraStream.getVideoTracks();
      if (cameraTrack && cameraTrack.readyState === "live") {
        cameraSenderRef.current = peer.addTrack(cameraTrack, existingCameraStream);
        setCameraMuted(false);
      } else {
        await startCamera();
      }
    }

    if (existingMicStream) {
      const [micTrack] = existingMicStream.getAudioTracks();
      if (micTrack && micTrack.readyState === "live") {
        micSenderRef.current = peer.addTrack(micTrack, existingMicStream);
        localMicTrack.current = micTrack;
        setMicMuted(false);
      } else {
        await startMicrophone();
      }
    }

    if (existingScreenStream) {
      const [screenTrack] = existingScreenStream.getVideoTracks();
      const audioTrack =
        existingScreenStream.getAudioTracks()[0] ?? existingScreenAudioStream?.getAudioTracks()[0];
      if (screenTrack && screenTrack.readyState === "live") {
        screenVideoSenderRef.current = peer.addTrack(screenTrack, existingScreenStream);
        screenTrack.addEventListener(
          "ended",
          () => {
            stopScreenShare().catch((error: unknown) => clientLog("warn", "Failed to stop share after retry", error));
          },
          { once: true }
        );
      }
      if (audioTrack && audioTrack.readyState === "live") {
        const restoredAudio = new MediaStream([audioTrack]);
        screenAudioSenderRef.current = peer.addTrack(audioTrack, restoredAudio);
        audioTrack.addEventListener(
          "ended",
          () => {
            stopScreenShare().catch((error: unknown) => clientLog("warn", "Failed to stop share after retry", error));
          },
          { once: true }
        );
        rtcStore.setStreamState({ localScreenAudioStream: restoredAudio });
      }
      if (screenTrack || audioTrack) {
        setScreenSharing(true);
        const state: ScreenShareState =
          screenSession.current ?? {
            presenterId: participantId,
            mediaSource: "screen",
            isActive: true,
            startedAt: new Date().toISOString(),
            switchEvents: []
          };
        screenSession.current = state;
        socket?.emit("signal", { type: "share-started", payload: state } satisfies SignalingEvent);
      }
    }
  }, [ensurePeer, participantId, resetReconnectState, rtcStore, socket, startCamera, startMicrophone, stopScreenShare]);

  const endRoom = useCallback(
    (reason?: string) =>
      new Promise<void>((resolve, reject) => {
        if (!socket) {
          reject(new Error("Socket not connected"));
          return;
        }

        const payload: RoomEndRequestPayload = {
          roomId,
          endedBy: participantId
        };

        if (reason) {
          payload.reason = reason;
        }

        socket.emit("room:end", payload, (ack?: { ok: boolean; error?: string }) => {
          if (ack?.ok) {
            void leaveSession();
            resolve();
          } else {
            reject(new Error(ack?.error ?? "Failed to end room"));
          }
        });
      }),
    [leaveSession, participantId, roomId, socket]
  );

  useEffect(() => {
    return () => {
      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current);
      }
      peerRef.current?.close();
      resetReconnectState();
    };
  }, [resetReconnectState]);

  return {
    startCamera,
    stopCamera,
    startMicrophone,
    stopMicrophone,
    muteMicrophone,
    unmuteMicrophone,
    startScreenShare,
    stopScreenShare,
    switchScreenShare,
    enterFullscreen,
    leaveSession,
    retryConnection,
    endRoom,
    isMicMuted,
    isCameraMuted,
    isScreenSharing,
    isReconnecting,
    reconnectAttempts,
    reconnectFailed,
    roomEnded: Boolean(roomEndedInfo),
    roomEndedInfo,
    moderationNotice,
    clearModerationNotice
  };
}

function isLikelyScreenShareTrack(track: MediaStreamTrack): boolean {
  const label = track.label.toLowerCase();
  if (label.includes("screen") || label.includes("window") || label.includes("display") || label.includes("tab") || label.includes("share")) {
    return true;
  }

  if (typeof track.getSettings === "function") {
    const settings = track.getSettings() as MediaTrackSettings & { displaySurface?: string };
    if (typeof settings.displaySurface === "string" && settings.displaySurface.length) {
      return settings.displaySurface !== "camera";
    }
  }

  return track.contentHint === "detail";
}
