import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type GyroData = { beta: number; gamma: number; angle: number };

export type GyroscopePermissionState =
  | "unsupported"
  | "insecure_context"
  | "unknown"
  | "prompt"
  | "granted"
  | "denied";

function getOrientationOffsetDegrees(): number {
  // Prefer screen.orientation.angle when available
  const screenAngle =
    typeof screen !== "undefined" &&
    "orientation" in screen &&
    screen.orientation &&
    typeof screen.orientation.angle === "number"
      ? screen.orientation.angle
      : undefined;

  // Fall back to legacy window.orientation (iOS Safari)
  const windowOrientation =
    typeof window !== "undefined" && "orientation" in window
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).orientation
      : undefined;

  const angle =
    typeof windowOrientation === "number"
      ? windowOrientation
      : typeof screenAngle === "number"
        ? screenAngle
        : 0;

  // Normalize to 0..359
  return ((angle % 360) + 360) % 360;
}

function computeGravityAngleDeg(beta: number, gamma: number): number {
  // Angle system:
  // 0° = right, 90° = down, 180° = left, 270° = up
  const orientationOffset = getOrientationOffsetDegrees();

  let angleDeg = 90; // default down
  if (Math.abs(beta) > 1 || Math.abs(gamma) > 1) {
    const tiltAngleRad = Math.atan2(gamma, beta);
    const tiltAngleDeg = (tiltAngleRad * 180) / Math.PI;
    angleDeg = (90 - tiltAngleDeg + 360) % 360;
    angleDeg = (angleDeg - orientationOffset + 360) % 360;
  } else {
    angleDeg = (90 - orientationOffset + 360) % 360;
  }

  return angleDeg;
}

function isSecureContextForGyro(): boolean {
  return (
    window.isSecureContext ||
    location.protocol === "https:" ||
    location.hostname === "localhost"
  );
}

function needsIOSPermission(): boolean {
  // iOS 13+ uses DeviceOrientationEvent.requestPermission()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof (DeviceOrientationEvent as any)?.requestPermission === "function";
}

export function useGyroscope(options: { enabled: boolean }) {
  const { enabled } = options;

  const [permissionState, setPermissionState] =
    useState<GyroscopePermissionState>("unknown");
  const [data, setData] = useState<GyroData | null>(null);
  const [hasReceivedEvent, setHasReceivedEvent] = useState(false);

  const listenerAddedRef = useRef(false);

  const isSupported = useMemo(
    () => typeof DeviceOrientationEvent !== "undefined",
    []
  );
  const isSecure = useMemo(() => isSecureContextForGyro(), []);
  const requiresPermission = useMemo(() => needsIOSPermission(), []);

  const isReceivingData = useMemo(() => {
    if (!data) return false;
    return Math.abs(data.beta) > 0.1 || Math.abs(data.gamma) > 0.1;
  }, [data]);

  const requestPermission = useCallback(async (): Promise<void> => {
    if (!isSupported) {
      setPermissionState("unsupported");
      throw new Error("DeviceOrientationEvent is not supported on this device.");
    }
    if (!isSecure) {
      setPermissionState("insecure_context");
      throw new Error("Gyroscope requires a secure context (HTTPS or localhost).");
    }
    if (!requiresPermission) {
      // Nothing to do; listener should start automatically.
      setPermissionState("granted");
      return;
    }

    setPermissionState("prompt");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (DeviceOrientationEvent as any).requestPermission();
      if (response === "granted") {
        setPermissionState("granted");
      } else {
        setPermissionState("denied");
        throw new Error(
          "Permission denied. Enable Motion & Orientation Access in Safari Settings."
        );
      }
    } catch (err) {
      setPermissionState("denied");
      throw err;
    }
  }, [isSupported, isSecure, requiresPermission]);

  useEffect(() => {
    if (!enabled) return;

    if (!isSupported) {
      setPermissionState("unsupported");
      return;
    }
    if (!isSecure) {
      setPermissionState("insecure_context");
      return;
    }

    const handler = (event: DeviceOrientationEvent) => {
      const beta = event.beta ?? 0;
      const gamma = event.gamma ?? 0;
      const angle = computeGravityAngleDeg(beta, gamma);
      setHasReceivedEvent(true);
      setData({ beta, gamma, angle });
    };

    const addListener = () => {
      if (listenerAddedRef.current) return;
      window.addEventListener("deviceorientation", handler, { passive: true });
      listenerAddedRef.current = true;
    };

    // If iOS permission is required, only start after permission is granted.
    if (requiresPermission) {
      if (permissionState === "granted") {
        addListener();
      } else {
        setPermissionState("prompt");
      }
    } else {
      setPermissionState("granted");
      addListener();
    }

    return () => {
      if (listenerAddedRef.current) {
        window.removeEventListener("deviceorientation", handler);
        listenerAddedRef.current = false;
      }
    };
  }, [enabled, isSupported, isSecure, requiresPermission, permissionState]);

  return {
    data,
    hasReceivedEvent,
    isReceivingData,
    isSupported,
    isSecureContext: isSecure,
    requiresPermission,
    permissionState,
    requestPermission,
  };
}


