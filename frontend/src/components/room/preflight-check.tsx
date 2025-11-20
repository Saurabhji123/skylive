"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import {
  requestCameraAccess,
  requestMicrophoneAccess,
  requestScreenShareAccess,
  stopMediaStream
} from "@/lib/device-permissions";

interface PreflightCheckProps {
  displayName: string;
  onContinue: (options?: { skipDeviceChecks?: boolean }) => Promise<void>;
}

export function PreflightCheck({ displayName, onContinue }: PreflightCheckProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micAnimationRef = useRef<number | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const cameraRequestIdRef = useRef(0);
  const micRequestIdRef = useRef(0);
  const screenRequestIdRef = useRef(0);

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [screenTestActive, setScreenTestActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isContinuing, setIsContinuing] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [screenBusy, setScreenBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [screenReady, setScreenReady] = useState(false);

  const stopStream = useCallback((stream: MediaStream | null) => {
    stopMediaStream(stream);
  }, []);

  const stopMicAnalyser = useCallback(() => {
    if (micAnimationRef.current) {
      cancelAnimationFrame(micAnimationRef.current);
      micAnimationRef.current = null;
    }
    analyserRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    stopStream(cameraStreamRef.current);
    stopStream(micStreamRef.current);
    stopStream(screenStreamRef.current);
    stopMicAnalyser();
    cameraStreamRef.current = null;
    micStreamRef.current = null;
    screenStreamRef.current = null;
    setCameraStream(null);
    setCameraReady(false);
    setMicReady(false);
    setScreenTestActive(false);
    setScreenReady(false);
    setMicLevel(0);
    setCameraBusy(false);
    setMicBusy(false);
    setScreenBusy(false);
  }, [stopMicAnalyser, stopStream]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;

    if (cameraStream) {
      element.srcObject = cameraStream;
      element.play().catch(() => undefined);
    } else if (element.srcObject) {
      element.srcObject = null;
    }
  }, [cameraStream]);

  const updateMicLevel = useCallback(function pump() {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const value of data) {
      const normalized = value / 128 - 1;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / data.length);
    setMicLevel(Math.min(1, rms * 4));
    micAnimationRef.current = requestAnimationFrame(pump);
  }, []);

  const startCamera = useCallback(async () => {
    if (cameraStreamRef.current || cameraBusy) return;

    const requestId = cameraRequestIdRef.current + 1;
    cameraRequestIdRef.current = requestId;
    setCameraBusy(true);
    setError(null);

    try {
      const result = await requestCameraAccess(10000);

      // Check if this request is still valid (user might have clicked multiple times)
      if (cameraRequestIdRef.current !== requestId) {
        if (result.stream) {
          stopMediaStream(result.stream);
        }
        return;
      }

      // Handle failure cases
      if (!result.success || !result.stream) {
        setCameraReady(false);
        const errorMessage = result.error || "Unable to access the camera.";
        setError(errorMessage);
        return;
      }

      // Success - set up the camera stream
      cameraStreamRef.current = result.stream;
      setCameraStream(result.stream);
      setCameraReady(true);
      setError(null);

      const [videoTrack] = result.stream.getVideoTracks();
      if (videoTrack) {
        videoTrack.addEventListener("ended", () => {
          if (cameraStreamRef.current === result.stream) {
            cameraStreamRef.current = null;
            setCameraStream(null);
            setCameraReady(false);
          }
        });
      }
    } catch (err) {
      if (cameraRequestIdRef.current !== requestId) {
        return;
      }
      setCameraReady(false);
      const message = err instanceof Error ? err.message : "Unable to access the camera.";
      setError(message);
      
      // Clean up any existing stream
      if (cameraStreamRef.current) {
        stopStream(cameraStreamRef.current);
        cameraStreamRef.current = null;
      }
      setCameraStream(null);
    } finally {
      if (cameraRequestIdRef.current === requestId) {
        setCameraBusy(false);
      }
    }
  }, [cameraBusy, stopStream]);

  const stopCamera = useCallback(() => {
    if (!cameraStreamRef.current) return;
    setError(null);
    stopStream(cameraStreamRef.current);
    cameraStreamRef.current = null;
    setCameraStream(null);
    setCameraReady(false);
  }, [stopStream]);

  const startMicrophone = useCallback(async () => {
    if (micStreamRef.current || micBusy) return;

    const requestId = micRequestIdRef.current + 1;
    micRequestIdRef.current = requestId;
    setMicBusy(true);
    setError(null);

    try {
      const result = await requestMicrophoneAccess(10000);

      if (micRequestIdRef.current !== requestId) {
        if (result.stream) {
          stopMediaStream(result.stream);
        }
        stopMicAnalyser();
        return;
      }

      // Handle failure cases
      if (!result.success || !result.stream) {
        setMicReady(false);
        const errorMessage = result.error || "Unable to access the microphone.";
        setError(errorMessage);
        stopMicAnalyser();
        return;
      }

      // Success - set up the microphone stream
      micStreamRef.current = result.stream;
      setMicReady(true);
      setMicLevel(0.15);
      setError(null);

      stopMicAnalyser();
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      await audioContext.resume().catch(() => undefined);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      const source = audioContext.createMediaStreamSource(result.stream);
      source.connect(analyser);
      analyserRef.current = analyser;
      micAnimationRef.current = requestAnimationFrame(updateMicLevel);

      const [audioTrack] = result.stream.getAudioTracks();
      if (audioTrack) {
        audioTrack.addEventListener("ended", () => {
          if (micStreamRef.current === result.stream) {
            stopStream(micStreamRef.current);
            micStreamRef.current = null;
            setMicReady(false);
            setMicLevel(0);
            stopMicAnalyser();
          }
        });
      }
    } catch (err) {
      if (micRequestIdRef.current !== requestId) {
        return;
      }
      setMicReady(false);
      const message = err instanceof Error ? err.message : "Unable to access the microphone.";
      setError(message);
      
      // Clean up any existing stream
      if (micStreamRef.current) {
        stopStream(micStreamRef.current);
        micStreamRef.current = null;
      }
      setMicLevel(0);
      stopMicAnalyser();
    } finally {
      if (micRequestIdRef.current === requestId) {
        setMicBusy(false);
      }
    }
  }, [micBusy, stopMicAnalyser, stopStream, updateMicLevel]);

  const stopMicrophone = useCallback(() => {
    if (!micStreamRef.current) return;
    setError(null);
    stopStream(micStreamRef.current);
    micStreamRef.current = null;
    setMicReady(false);
    setMicLevel(0);
    stopMicAnalyser();
  }, [stopMicAnalyser, stopStream]);

  const startScreenTest = useCallback(async () => {
    if (screenTestActive || screenBusy) return;

    const requestId = screenRequestIdRef.current + 1;
    screenRequestIdRef.current = requestId;
    setScreenBusy(true);
    setError(null);

    try {
      const result = await requestScreenShareAccess(15000);

      if (screenRequestIdRef.current !== requestId) {
        if (result.stream) {
          stopMediaStream(result.stream);
        }
        return;
      }

      // Handle failure cases
      if (!result.success || !result.stream) {
        setScreenReady(false);
        const errorMessage = result.error || "Unable to access screen share.";
        setError(errorMessage);
        return;
      }

      // Success - set up the screen share stream
      screenStreamRef.current = result.stream;
      setScreenTestActive(true);
      setScreenReady(true);
      setError(null);

      const [track] = result.stream.getVideoTracks();
      if (track) {
        track.addEventListener("ended", () => {
          if (screenStreamRef.current === result.stream) {
            stopStream(screenStreamRef.current);
            screenStreamRef.current = null;
            setScreenTestActive(false);
          }
        });
      }
    } catch (err) {
      if (screenRequestIdRef.current !== requestId) {
        return;
      }
      const message = err instanceof Error ? err.message : "Screen share was blocked. Allow capture to continue.";
      setError(message);
      setScreenReady(false);
      
      // Clean up any existing stream
      if (screenStreamRef.current) {
        stopStream(screenStreamRef.current);
        screenStreamRef.current = null;
      }
    } finally {
      if (screenRequestIdRef.current === requestId) {
        setScreenBusy(false);
      }
    }
  }, [screenBusy, screenTestActive, stopStream]);

  const stopScreenTest = useCallback(() => {
    if (!screenTestActive) return;
    setError(null);
    stopStream(screenStreamRef.current);
    screenStreamRef.current = null;
    setScreenTestActive(false);
  }, [screenTestActive, stopStream]);

  const handleContinue = async (options?: { skipDeviceChecks?: boolean }) => {
    setError(null);
    setIsContinuing(true);
    try {
      cleanup();
      await onContinue(options);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start the session. Try again.");
      setIsContinuing(false);
      return;
    }
    setIsContinuing(false);
  };

  const readyState = useMemo(() => cameraReady || micReady, [cameraReady, micReady]);
  const micPercent = useMemo(() => Math.min(100, Math.round(micLevel * 100)), [micLevel]);
  const micLevelClass = useMemo(() => {
    if (micPercent > 70) return "bg-emerald-400";
    if (micPercent > 35) return "bg-amber-300";
    return "bg-white/20";
  }, [micPercent]);
  const micStatusText = useMemo(() => {
    if (!micReady) {
      return "Grant microphone permissions to monitor input.";
    }
    if (micPercent > 12) {
      return "Live input detected.";
    }
    return "Microphone ready — speak to test levels.";
  }, [micPercent, micReady]);
  const screenStatusText = useMemo(() => {
    if (screenReady) {
      return "Permission saved. You can re-run the test anytime.";
    }
    return "We will not broadcast the screen during this check. Once you confirm the browser prompt, your screen capture permission is saved for the session.";
  }, [screenReady]);

  return (
    <main className="flex min-h-screen w-full items-start justify-center px-4 py-10 text-white sm:px-6 sm:py-16 lg:items-center">
      <GlassCard className="w-full max-w-3xl space-y-8 bg-white/10 p-6 sm:p-8">
        <header className="space-y-1 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-skylive-cyan/70">Preflight check</p>
          <h1 className="text-3xl font-semibold">Let&apos;s get you ready, {displayName || "guest"}</h1>
          <p className="text-sm text-white/70">Confirm your camera, microphone, and screen share before entering the room.</p>
        </header>

        <section className="grid gap-6 md:grid-cols-2 md:gap-7">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-medium">Camera preview</h2>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.2em] transition-colors ${
                    cameraReady
                      ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-200"
                      : "border-white/15 bg-white/5 text-white/50"
                  }`}
                >
                  {cameraReady ? "Ready" : "Pending"}
                </span>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button
                  variant="secondary"
                  onClick={() => void startCamera()}
                  disabled={cameraReady || cameraBusy}
                  isLoading={cameraBusy}
                  className="w-full sm:w-auto"
                >
                  Enable
                </Button>
                <Button
                  variant="ghost"
                  className="border border-white/20 w-full sm:w-auto"
                  onClick={() => stopCamera()}
                  disabled={!cameraReady || cameraBusy}
                >
                  Disable
                </Button>
              </div>
            </div>
            <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black/60">
              {cameraReady && cameraStream ? (
                <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-white/50">
                  Camera is currently off
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-medium">Microphone check</h2>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.2em] transition-colors ${
                    micReady ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-200" : "border-white/15 bg-white/5 text-white/50"
                  }`}
                >
                  {micReady ? "Ready" : "Pending"}
                </span>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button
                  variant="secondary"
                  onClick={() => void startMicrophone()}
                  disabled={micReady || micBusy}
                  isLoading={micBusy}
                  className="w-full sm:w-auto"
                >
                  Enable
                </Button>
                <Button
                  variant="ghost"
                  className="border border-white/20 w-full sm:w-auto"
                  onClick={() => stopMicrophone()}
                  disabled={!micReady || micBusy}
                >
                  Disable
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/60 p-5">
              <div className="flex flex-col gap-2 text-sm text-white/70 sm:flex-row sm:items-center sm:justify-between">
                <p>{micStatusText}</p>
                <span className={`text-xs font-medium ${micReady ? "text-emerald-200" : "text-white/40"}`}>{micPercent}%</span>
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full transition-all duration-150 ${micReady ? micLevelClass : "bg-white/15"}`}
                  style={{ width: `${micPercent}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-medium">Screen-share test</h3>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.2em] transition-colors ${
                      screenTestActive || screenReady
                        ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-200"
                        : "border-white/15 bg-white/5 text-white/50"
                    }`}
                  >
                    {screenTestActive ? "Active" : screenReady ? "Ready" : "Optional"}
                  </span>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <Button
                    variant="secondary"
                    onClick={() => void startScreenTest()}
                    disabled={screenTestActive || screenBusy}
                    isLoading={screenBusy}
                    className="w-full sm:w-auto"
                  >
                    Start test
                  </Button>
                  <Button
                    variant="ghost"
                    className="border border-white/20 w-full sm:w-auto"
                    onClick={() => stopScreenTest()}
                    disabled={!screenTestActive || screenBusy}
                  >
                    Stop test
                  </Button>
                </div>
              </div>
              <p className="mt-3 text-sm text-white/70">{screenStatusText}</p>
            </div>
          </div>
        </section>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/50">You can change devices later from the in-room settings.</p>
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Button
              variant="ghost"
              className="border border-white/20"
              onClick={() => void handleContinue({ skipDeviceChecks: true })}
              disabled={isContinuing}
            >
              Skip device setup
            </Button>
            <Button
              variant="contrast"
              className="flex-1"
              onClick={() => void handleContinue()}
              disabled={isContinuing}
              isLoading={isContinuing}
            >
              Enter the screening room
            </Button>
          </div>
          {!readyState ? (
            <p className="text-xs text-amber-200/80">
              Camera or microphone permissions are still pending. Allow access or continue without devices and adjust later from the room controls.
            </p>
          ) : null}
        </div>
      </GlassCard>
    </main>
  );
}
