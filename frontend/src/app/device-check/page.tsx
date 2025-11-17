"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { useRtcStore } from "@/store/rtc-store";
import { clientLog } from "@/lib/logger";

type StoredPreflightState = {
  camera: boolean;
  microphone: boolean;
  screen: boolean;
};

const PREFLIGHT_STORAGE_KEY = "skylive-preflight-state";

function loadStoredState(): StoredPreflightState {
  if (typeof window === "undefined") {
    return { camera: false, microphone: false, screen: false };
  }

  try {
    const raw = window.sessionStorage.getItem(PREFLIGHT_STORAGE_KEY);
    if (!raw) {
      return { camera: false, microphone: false, screen: false };
    }
    const parsed = JSON.parse(raw) as Partial<StoredPreflightState>;
    return {
      camera: Boolean(parsed.camera),
      microphone: Boolean(parsed.microphone),
      screen: Boolean(parsed.screen)
    };
  } catch {
    return { camera: false, microphone: false, screen: false };
  }
}

export default function DeviceCheckPage() {
  const router = useRouter();
  const rtcStore = useRtcStore();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [screenReady, setScreenReady] = useState(false);
  const [screenTesting, setScreenTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const persistState = useCallback((updates: Partial<StoredPreflightState>) => {
    if (typeof window === "undefined") {
      return;
    }
    const next = { ...loadStoredState(), ...updates } satisfies StoredPreflightState;
    try {
      window.sessionStorage.setItem(PREFLIGHT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  }, []);

  const stopStream = (stream: MediaStream | null) => {
    stream?.getTracks().forEach((track) => track.stop());
  };

  const teardownAudio = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    analyserRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  };

  const prepareCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });
      stopStream(cameraStreamRef.current);
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      rtcStore.setStreamState({ localCameraStream: stream });
      setCameraReady(true);
      persistState({ camera: true });
    } catch (err) {
      clientLog("error", "Camera preflight failed", err);
      setError("Camera access blocked. Please enable permissions.");
      setCameraReady(false);
      persistState({ camera: false });
    }
  }, [persistState, rtcStore]);

  const prepareMicrophone = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48_000
        },
        video: false
      });
      stopStream(microphoneStreamRef.current);
      microphoneStreamRef.current = stream;
      if (audioRef.current) {
        audioRef.current.srcObject = stream;
        audioRef.current.muted = true;
        await audioRef.current.play().catch(() => undefined);
      }
      rtcStore.setStreamState({ localMicrophoneStream: stream });
      setMicReady(true);
      persistState({ microphone: true });

      teardownAudio();
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      const buffer = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) {
          return;
        }
        analyserRef.current.getByteTimeDomainData(buffer);
        let sum = 0;
        for (let index = 0; index < buffer.length; index += 1) {
          const value = buffer[index] - 128;
          sum += value * value;
        }
        const rms = Math.sqrt(sum / buffer.length) / 128;
        setMicLevel(Number(rms.toFixed(2)));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      clientLog("error", "Microphone preflight failed", err);
      setError("Microphone access blocked. Please enable permissions.");
      setMicReady(false);
      persistState({ microphone: false });
      teardownAudio();
    }
  }, [persistState, rtcStore]);

  const prepareScreen = useCallback(async () => {
    setScreenTesting(true);
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setScreenReady(true);
      persistState({ screen: true });
    } catch (err) {
      clientLog("error", "Screen-share preflight failed", err);
      setError("Screen-share permission denied. Try again and enable \"Share Audio\".");
      setScreenReady(false);
      persistState({ screen: false });
    } finally {
      setScreenTesting(false);
    }
  }, [persistState]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = loadStoredState();
      if (stored.screen) {
        setScreenReady(true);
      }
    }
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      await prepareCamera();
      await prepareMicrophone();
    };

    void bootstrap();

    return () => {
      stopStream(cameraStreamRef.current);
      stopStream(microphoneStreamRef.current);
      teardownAudio();
    };
  }, [prepareCamera, prepareMicrophone]);

  useEffect(() => {
    if (rtcStore.localCameraStream) {
      setCameraReady(true);
      persistState({ camera: true });
    }
  }, [persistState, rtcStore.localCameraStream]);

  useEffect(() => {
    if (rtcStore.localMicrophoneStream) {
      setMicReady(true);
      persistState({ microphone: true });
    }
  }, [persistState, rtcStore.localMicrophoneStream]);

  const micPercent = useMemo(() => Math.min(100, Math.max(0, Math.round(micLevel * 120))), [micLevel]);
  const allReady = cameraReady && micReady && screenReady;
  const statusCopy = useMemo(
    () => ({
      camera: cameraReady ? "Frame looks great" : "Enable to preview your shot",
      microphone: micReady ? "Live input detected" : "Grant microphone permissions",
      screen: screenReady ? "Permission saved" : "Run a quick capture test"
    }),
    [cameraReady, micReady, screenReady]
  );

  const handleContinue = () => {
    router.push("/rooms/create");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-black/70 via-black/40 to-transparent px-6 py-16">
      <GlassCard className="w-full max-w-5xl space-y-10 bg-white/10 p-10">
        <header className="space-y-2 text-center">
          <p className="text-sm uppercase tracking-[0.4em] text-skylive-cyan/80">Pre-flight check</p>
          <h1 className="text-4xl font-semibold text-white">Let&apos;s get everything ready</h1>
          <p className="mx-auto max-w-3xl text-white/70">
            Confirm your camera, microphone, and screen-share permissions so the screening room opens without prompts. You can
            adjust devices again once you are inside the session.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section className="space-y-6">
            <DeviceTile title="Camera" ready={cameraReady} helper={statusCopy.camera}>
              <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black/70">
                <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
                <Button variant="ghost" size="sm" className="border border-white/15" onClick={() => void prepareCamera()}>
                  Rerun camera test
                </Button>
                <span>Check framing and lighting before you go live.</span>
              </div>
            </DeviceTile>
          </section>
          <section className="space-y-6">
            <DeviceTile title="Microphone" ready={micReady} helper={statusCopy.microphone}>
              <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/70 p-4">
                <div className="space-y-2">
                  <div className="relative h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-emerald-400 via-skylive-cyan to-sky-500 transition-[width]",
                        micPercent > 5 ? "opacity-100" : "opacity-60"
                      )}
                      style={{ width: `${Math.max(4, micPercent)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>Silence</span>
                    <span aria-live="polite">{micPercent}% level</span>
                  </div>
                </div>
                <p className="text-xs text-white/50">Keep speaking—this percentage should bounce with your voice.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
                <Button variant="ghost" size="sm" className="border border-white/15" onClick={() => void prepareMicrophone()}>
                  Rerun mic test
                </Button>
                <span>{micReady ? "We&apos;re hearing you loud and clear." : "Allow the browser to use your microphone."}</span>
              </div>
              <audio ref={audioRef} autoPlay muted />
            </DeviceTile>
            <DeviceTile title="Screen share" ready={screenReady} helper={statusCopy.screen}>
              <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/70 p-4 text-sm text-white/70">
                <p>
                  We&apos;ll ask for capture permission just once. Tick the “Share audio” checkbox so trailers stay in sync.
                </p>
                <Button variant="secondary" onClick={() => void prepareScreen()} isLoading={screenTesting}>
                  {screenReady ? "Re-run test" : "Start screen-share test"}
                </Button>
              </div>
            </DeviceTile>
          </section>
        </div>

        {error ? (
          <p className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>
        ) : null}

        <div className="flex flex-col items-end gap-3 text-sm text-white/70">
          <p>All checks must be ready before launching your screening room.</p>
          <Button size="lg" onClick={handleContinue} disabled={!allReady} variant={allReady ? "contrast" : "secondary"}>
            Enter the screening room
          </Button>
        </div>
      </GlassCard>
    </main>
  );
}

function DeviceTile({
  title,
  ready,
  helper,
  children
}: {
  title: string;
  ready: boolean;
  helper: string;
  children: ReactNode;
}) {
  return (
    <GlassCard className={cn("space-y-4", ready ? "border-emerald-400/60" : "border-white/12")}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/60">{title}</p>
          <p className="text-xs text-white/50">{helper}</p>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            ready ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-white/70"
          )}
        >
          {ready ? "Ready" : "Not ready"}
        </span>
      </div>
      {children}
    </GlassCard>
  );
}
