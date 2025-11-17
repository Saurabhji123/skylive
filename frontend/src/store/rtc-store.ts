import { create } from "zustand";
import type { ScreenShareState, HeartbeatPayload } from "@skylive/shared";

interface MediaDeviceState {
  cameraId?: string;
  microphoneId?: string;
  speakerId?: string;
  cameraPermission?: PermissionState;
  microphonePermission?: PermissionState;
}

interface StreamState {
  localCameraStream?: MediaStream;
  localScreenStream?: MediaStream;
  localScreenAudioStream?: MediaStream;
  localMicrophoneStream?: MediaStream;
  remoteCameraStream?: MediaStream;
  remoteScreenStream?: MediaStream;
}

interface StatsState {
  heartbeats: HeartbeatPayload[];
  networkQuality: "excellent" | "good" | "poor" | "critical";
}

interface RtcState extends MediaDeviceState, StreamState, StatsState {
  screenShare?: ScreenShareState;
  setDeviceState: (devices: MediaDeviceState) => void;
  setStreamState: (streams: Partial<StreamState>) => void;
  pushHeartbeat: (heartbeat: HeartbeatPayload) => void;
  setNetworkQuality: (quality: StatsState["networkQuality"]) => void;
  setScreenShareState: (state?: ScreenShareState) => void;
  reset: () => void;
}

const initialState: Omit<RtcState, "setDeviceState" | "setStreamState" | "pushHeartbeat" | "setNetworkQuality" | "setScreenShareState" | "reset"> = {
  heartbeats: [],
  networkQuality: "excellent",
  cameraPermission: undefined,
  microphonePermission: undefined
};

export const useRtcStore = create<RtcState>((set) => ({
  ...initialState,
  setDeviceState: (devices) => set((state) => ({ ...state, ...devices })),
  setStreamState: (streams) => set((state) => ({ ...state, ...streams })),
  pushHeartbeat: (heartbeat) =>
    set((state) => ({ heartbeats: [...state.heartbeats.slice(-20), heartbeat] })),
  setNetworkQuality: (quality) => set({ networkQuality: quality }),
  setScreenShareState: (state) => set({ screenShare: state }),
  reset: () =>
    set({
      ...initialState,
      cameraId: undefined,
      microphoneId: undefined,
      speakerId: undefined,
      cameraPermission: undefined,
      microphonePermission: undefined,
      localCameraStream: undefined,
      localScreenStream: undefined,
      localScreenAudioStream: undefined,
      localMicrophoneStream: undefined,
      remoteCameraStream: undefined,
      remoteScreenStream: undefined,
      screenShare: undefined
    })
}));
