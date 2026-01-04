import { useCallback, useEffect, useMemo, useState } from "react";
import { useEngine } from "../hooks/useEngine";
import { useEnvironment } from "../hooks/modules/useEnvironment";
import { GyroscopePermissionBanner } from "./GyroscopePermissionBanner";
import { useGyroscope } from "../hooks/useGyroscope";
import { isMobileDevice } from "../utils/deviceCapabilities";
import { useRender } from "../hooks/useRender";

/**
 * CPU fallback demo controller:
 * - Only active on the homepage when WebGPU is not available
 * - Uses device orientation (gyroscope) to drive gravity direction
 * - Shows a small top banner to request permission (iOS) only when needed
 */
export function CpuGyroDemoController(props: { isHomepage: boolean }) {
  const { isHomepage } = props;
  const { isWebGPU, isInitialized, isInitializing, spawnParticles } = useEngine();
  const { setInvertColors } = useRender();
  const { setGravityStrength, setMode, setCustomAngleDegrees } = useEnvironment();
  const [hasRequestedPermission, setHasRequestedPermission] = useState<boolean>(false);

  const enabled = useMemo(
    () => isHomepage && isInitialized && !isInitializing && !isWebGPU,
    [isHomepage, isInitialized, isInitializing, isWebGPU]
  );

  const gyro = useGyroscope({ enabled });

  // Configure CPU fallback "demo" gravity settings once when enabled.
  useEffect(() => {
    if (!enabled) return;
    setGravityStrength(1000);
    setMode("custom");
    setCustomAngleDegrees(90);
    setInvertColors(true);
    setTimeout(() => {
      spawnParticles({
        numParticles: isMobileDevice() ? 600 : 1000,
        shape: "circle",
        spacing: 0,
        particleSize: 5,
        radius: 100,
      })
    }, 16);
  }, [enabled, setGravityStrength, setMode, setCustomAngleDegrees, spawnParticles, setInvertColors]);

  // Drive gravity direction from gyroscope angle.
  useEffect(() => {
    if (!enabled) return;
    if (!gyro.data) return;
    setCustomAngleDegrees(gyro.data.angle);
  }, [enabled, gyro.data, setCustomAngleDegrees]);

  const shouldShowBanner =
    enabled &&
    gyro.requiresPermission &&
    !hasRequestedPermission &&
    gyro.permissionState !== "granted" &&
    gyro.permissionState !== "unsupported" &&
    gyro.permissionState !== "insecure_context"
    && gyro.isSecureContext;



  const onRequestPermission = useCallback(() => {
    gyro
      .requestPermission()
      .catch((err: unknown) => {
        const msg =
          err instanceof Error ? err.message : "Failed to request permission.";
        alert(msg);
      }).then(() => {
        setHasRequestedPermission(true);
      });
  }, [gyro]);

  return (
    <GyroscopePermissionBanner
      isVisible={shouldShowBanner}
      onRequestPermission={onRequestPermission}
      message="Enable Gyroscope"
    />

  );
}


