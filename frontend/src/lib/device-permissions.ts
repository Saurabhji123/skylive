/**
 * Device Permission Utilities
 * Centralized, robust handling for camera, microphone, and screen share permissions
 */

export type DeviceType = "camera" | "microphone" | "screen";
export type PermissionState = "granted" | "denied" | "prompt" | "unknown";

export interface DeviceCheckResult {
  success: boolean;
  stream?: MediaStream;
  error?: string;
  errorCode?: DeviceErrorCode;
  permission?: PermissionState;
}

export type DeviceErrorCode =
  | "NOT_SUPPORTED"
  | "PERMISSION_DENIED"
  | "DEVICE_NOT_FOUND"
  | "DEVICE_IN_USE"
  | "TIMEOUT"
  | "UNKNOWN_ERROR";

/**
 * Check if browser supports media devices API
 */
export function isMediaDevicesSupported(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return Boolean(navigator.mediaDevices);
}

/**
 * Check if getUserMedia is supported
 */
export function isGetUserMediaSupported(): boolean {
  return isMediaDevicesSupported() && typeof navigator.mediaDevices.getUserMedia === "function";
}

/**
 * Check if getDisplayMedia is supported
 */
export function isGetDisplayMediaSupported(): boolean {
  return isMediaDevicesSupported() && typeof navigator.mediaDevices.getDisplayMedia === "function";
}

/**
 * Check if Permissions API is supported
 */
export function isPermissionsAPISupported(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return Boolean(navigator.permissions) && typeof navigator.permissions.query === "function";
}

/**
 * Query device permission state using Permissions API
 * Returns "unknown" if API not supported or query fails
 */
export async function queryPermissionState(device: "camera" | "microphone"): Promise<PermissionState> {
  if (!isPermissionsAPISupported()) {
    return "unknown";
  }

  try {
    const result = await navigator.permissions.query({ name: device as PermissionName });
    return result.state as PermissionState;
  } catch {
    // Some browsers don't support querying camera/microphone permissions
    return "unknown";
  }
}

/**
 * Create a timeout promise that rejects after specified milliseconds
 */
function createTimeoutPromise(ms: number, errorMessage: string): Promise<never> {
  return new Promise<never>((_, reject) => {
    setTimeout(() => {
      const error = new Error(errorMessage) as Error & { code: string };
      error.code = "TIMEOUT";
      reject(error);
    }, ms);
  });
}

/**
 * Safely stop all tracks in a media stream
 */
export function stopMediaStream(stream: MediaStream | null | undefined): void {
  if (!stream) {
    return;
  }

  try {
    const tracks = stream.getTracks();
    tracks.forEach((track) => {
      try {
        track.stop();
      } catch (_error) {
        console.warn("Failed to stop media track:", _error);
      }
    });
  } catch {
    console.warn("Failed to get tracks from stream");
  }
}

/**
 * Parse DOMException error into user-friendly message and error code
 */
function parseDOMException(error: unknown): { message: string; code: DeviceErrorCode } {
  if (!(error instanceof DOMException)) {
    if (error instanceof Error) {
      const err = error as Error & { code?: string };
      if (err.code === "TIMEOUT") {
        return {
          message: error.message,
          code: "TIMEOUT"
        };
      }
      return {
        message: error.message,
        code: "UNKNOWN_ERROR"
      };
    }
    return {
      message: "An unknown error occurred",
      code: "UNKNOWN_ERROR"
    };
  }

  const domError = error as DOMException;

  switch (domError.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return {
        message: "Permission denied. Allow access in your browser settings and try again.",
        code: "PERMISSION_DENIED"
      };

    case "NotFoundError":
    case "DevicesNotFoundError":
      return {
        message: "No device found. Please connect a device and try again.",
        code: "DEVICE_NOT_FOUND"
      };

    case "NotReadableError":
    case "TrackStartError":
      return {
        message: "Device is already in use by another application.",
        code: "DEVICE_IN_USE"
      };

    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return {
        message: "Device doesn't meet the required constraints.",
        code: "DEVICE_NOT_FOUND"
      };

    case "TypeError":
      return {
        message: "Invalid device configuration.",
        code: "UNKNOWN_ERROR"
      };

    case "AbortError":
      return {
        message: "Device access was aborted.",
        code: "UNKNOWN_ERROR"
      };

    default:
      return {
        message: domError.message || "Unable to access device.",
        code: "UNKNOWN_ERROR"
      };
  }
}

/**
 * Request camera access with timeout and fallback logic
 */
export async function requestCameraAccess(timeoutMs: number = 10000): Promise<DeviceCheckResult> {
  // Check browser support
  if (!isGetUserMediaSupported()) {
    return {
      success: false,
      error: "Camera access is not supported in this browser.",
      errorCode: "NOT_SUPPORTED",
      permission: "unknown"
    };
  }

  // Query permission state
  const permission = await queryPermissionState("camera");

  if (permission === "denied") {
    return {
      success: false,
      error: "Camera access is blocked. Enable camera permissions in your browser settings.",
      errorCode: "PERMISSION_DENIED",
      permission: "denied"
    };
  }

  // Preferred constraints (high quality)
  const preferredConstraints: MediaStreamConstraints = {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 }
    },
    audio: false
  };

  // Fallback constraints (basic quality)
  const fallbackConstraints: MediaStreamConstraints = {
    video: true,
    audio: false
  };

  try {
    // Race between getUserMedia and timeout
    const streamPromise = (async (): Promise<MediaStream> => {
      try {
        return await navigator.mediaDevices.getUserMedia(preferredConstraints);
      } catch (error) {
        // Try fallback on OverconstrainedError or NotReadableError
        const domError = error as DOMException;
        if (domError.name === "OverconstrainedError" || domError.name === "NotReadableError") {
          return await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        }
        throw error;
      }
    })();

    const timeoutPromise = createTimeoutPromise(timeoutMs, "Camera permission timeout. Refresh and try again.");

    const stream = await Promise.race([streamPromise, timeoutPromise]);

    return {
      success: true,
      stream,
      permission: "granted"
    };
  } catch (error) {
    const { message, code } = parseDOMException(error);
    return {
      success: false,
      error: message,
      errorCode: code,
      permission: code === "PERMISSION_DENIED" ? "denied" : permission
    };
  }
}

/**
 * Request microphone access with timeout and fallback logic
 */
export async function requestMicrophoneAccess(timeoutMs: number = 10000): Promise<DeviceCheckResult> {
  // Check browser support
  if (!isGetUserMediaSupported()) {
    return {
      success: false,
      error: "Microphone access is not supported in this browser.",
      errorCode: "NOT_SUPPORTED",
      permission: "unknown"
    };
  }

  // Query permission state
  const permission = await queryPermissionState("microphone");

  if (permission === "denied") {
    return {
      success: false,
      error: "Microphone access is blocked. Enable microphone permissions in your browser settings.",
      errorCode: "PERMISSION_DENIED",
      permission: "denied"
    };
  }

  // Preferred constraints (high quality audio)
  const preferredConstraints: MediaStreamConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
      sampleRate: 48000
    },
    video: false
  };

  // Fallback constraints (basic audio)
  const fallbackConstraints: MediaStreamConstraints = {
    audio: true,
    video: false
  };

  try {
    // Race between getUserMedia and timeout
    const streamPromise = (async (): Promise<MediaStream> => {
      try {
        return await navigator.mediaDevices.getUserMedia(preferredConstraints);
      } catch (error) {
        // Try fallback on OverconstrainedError or NotReadableError
        const domError = error as DOMException;
        if (domError.name === "OverconstrainedError" || domError.name === "NotReadableError") {
          return await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        }
        throw error;
      }
    })();

    const timeoutPromise = createTimeoutPromise(timeoutMs, "Microphone permission timeout. Refresh and try again.");

    const stream = await Promise.race([streamPromise, timeoutPromise]);

    return {
      success: true,
      stream,
      permission: "granted"
    };
  } catch (error) {
    const { message, code } = parseDOMException(error);
    return {
      success: false,
      error: message,
      errorCode: code,
      permission: code === "PERMISSION_DENIED" ? "denied" : permission
    };
  }
}

/**
 * Request screen share access with timeout
 */
export async function requestScreenShareAccess(timeoutMs: number = 15000): Promise<DeviceCheckResult> {
  // Check browser support
  if (!isGetDisplayMediaSupported()) {
    return {
      success: false,
      error: "Screen sharing is not supported in this browser.",
      errorCode: "NOT_SUPPORTED",
      permission: "unknown"
    };
  }

  const constraints: DisplayMediaStreamOptions = {
    video: {
      frameRate: { ideal: 60 },
      cursor: "always"
    } as MediaTrackConstraints,
    audio: true
  };

  try {
    // Race between getDisplayMedia and timeout
    const streamPromise = navigator.mediaDevices.getDisplayMedia(constraints);
    const timeoutPromise = createTimeoutPromise(
      timeoutMs,
      "Screen share permission timeout. Allow the browser prompt and try again."
    );

    const stream = await Promise.race([streamPromise, timeoutPromise]);

    return {
      success: true,
      stream,
      permission: "granted"
    };
  } catch (error) {
    const { message, code } = parseDOMException(error);
    return {
      success: false,
      error: message,
      errorCode: code,
      permission: code === "PERMISSION_DENIED" ? "denied" : "unknown"
    };
  }
}

/**
 * Monitor permission state changes
 * Returns cleanup function to stop monitoring
 */
export function monitorPermissionState(
  device: "camera" | "microphone",
  onChange: (state: PermissionState) => void
): () => void {
  if (!isPermissionsAPISupported()) {
    return () => {};
  }

  let permissionStatus: PermissionStatus | null = null;

  (async () => {
    try {
      permissionStatus = await navigator.permissions.query({ name: device as PermissionName });
      onChange(permissionStatus.state as PermissionState);

      permissionStatus.onchange = () => {
        if (permissionStatus) {
          onChange(permissionStatus.state as PermissionState);
        }
      };
    } catch {
      // Permission query not supported
    }
  })();

  return () => {
    if (permissionStatus) {
      permissionStatus.onchange = null;
    }
  };
}
