import { useCallback } from "react";
import { useAppSelector } from "../hooks/useAppSelector";
import { selectIsWebGPU } from "../slices/engine";
import "./GyroscopeDebugLabel.css";

interface GyroscopeDebugLabelProps {
  gyroData: { beta: number; gamma: number; angle: number } | null;
}

export function GyroscopeDebugLabel({ gyroData }: GyroscopeDebugLabelProps) {
  const isWebGPU = useAppSelector(selectIsWebGPU);

  // Check if we're getting actual data (not just defaults)
  const isReceivingData = gyroData ? (Math.abs(gyroData.beta) > 0.1 || Math.abs(gyroData.gamma) > 0.1) : false;
  const isSecureContext = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';

  const handleRequestPermission = useCallback(async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        console.log('[Gyroscope] Manual permission request result:', response);
        if (response === 'granted') {
          alert('Permission granted! Try tilting your device.');
        } else {
          alert('Permission denied. Please enable Motion & Orientation Access in Safari Settings.');
        }
      } catch (error) {
        console.error('[Gyroscope] Permission request error:', error);
        alert('Error requesting permission. Check console for details.');
      }
    } else {
      console.log('[Gyroscope] Device orientation status:', {
        apiAvailable: typeof DeviceOrientationEvent !== 'undefined',
        needsPermission: typeof (DeviceOrientationEvent as any)?.requestPermission === 'function',
        isSecureContext,
        protocol: location.protocol,
        hostname: location.hostname,
      });
      alert('Check console for device orientation status. Some devices require user interaction to start.');
    }
  }, [isSecureContext]);

  // Only show in CPU mode
  if (isWebGPU || !gyroData) return null;

  return (
    <div className="gyroscope-debug-label">
      <div>Gyro: β={gyroData.beta.toFixed(1)}° γ={gyroData.gamma.toFixed(1)}°</div>
      <div>Angle: {gyroData.angle.toFixed(1)}°</div>
      {!isReceivingData && (
        <div style={{ marginTop: '4px' }}>
          <div style={{ fontSize: '10px', color: '#ff6b6b', marginBottom: '4px' }}>
            {!isSecureContext ? '⚠️ HTTPS required' : '⚠️ No data'}
          </div>
          <button
            onClick={handleRequestPermission}
            style={{
              fontSize: '10px',
              padding: '4px 8px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '3px',
              cursor: 'pointer',
              pointerEvents: 'auto',
            }}
          >
            Request Permission
          </button>
        </div>
      )}
    </div>
  );
}

