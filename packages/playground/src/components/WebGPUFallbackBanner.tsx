import { useState } from 'react';
import './WebGPUFallbackBanner.css';

export type RuntimeFallbackBannerProps = {
  /**
   * Custom message to display. If not provided, a message will be generated
   * based on requestedRuntime and actualRuntime.
   */
  message?: string;
  /**
   * The runtime the user requested (e.g., "auto", "webgpu", "webgl2", "cpu").
   */
  requestedRuntime?: "auto" | "webgpu" | "webgl2" | "cpu";
  /**
   * The actual runtime being used after fallback (e.g., "webgpu", "webgl2", "cpu").
   */
  actualRuntime?: "webgpu" | "webgl2" | "cpu";
  /**
   * Controlled "dismissed" state. When provided, the banner visibility is driven by this prop.
   */
  dismissed?: boolean;
  /**
   * Called when the user clicks dismiss.
   */
  onDismiss?: () => void;
};

/**
 * Generate a fallback message based on runtime selection.
 */
function getFallbackMessage(
  requestedRuntime?: "auto" | "webgpu" | "webgl2" | "cpu",
  actualRuntime?: "webgpu" | "webgl2" | "cpu"
): string {
  if (!requestedRuntime || !actualRuntime) {
    return "Runtime fallback occurred.";
  }

  if (requestedRuntime === "auto") {
    if (actualRuntime === "webgl2") {
      return "WebGPU not supported, using WebGL2.";
    } else if (actualRuntime === "cpu") {
      return "WebGPU and WebGL2 not supported, using CPU.";
    }
  } else if (requestedRuntime === "webgpu") {
    if (actualRuntime === "webgl2") {
      return "WebGPU not available, fell back to WebGL2.";
    } else if (actualRuntime === "cpu") {
      return "WebGPU not available, fell back to CPU.";
    }
  } else if (requestedRuntime === "webgl2") {
    if (actualRuntime === "cpu") {
      return "WebGL2 not available, fell back to CPU.";
    }
  }

  return "Runtime fallback occurred.";
}

// Legacy type alias for backward compatibility
export type WebGPUFallbackBannerProps = RuntimeFallbackBannerProps;

export function WebGPUFallbackBanner({
  message,
  requestedRuntime,
  actualRuntime,
  dismissed,
  onDismiss,
}: RuntimeFallbackBannerProps) {
  const displayMessage = message || getFallbackMessage(requestedRuntime, actualRuntime);
  const [internalDismissed, setInternalDismissed] = useState(false);
  const isDismissed = dismissed ?? internalDismissed;

  if (isDismissed) return null;

  return (
    <div className="webgpuFallbackBanner" role="status" aria-live="polite">
      <span className="webgpuFallbackBanner__icon" aria-hidden="true">
        <svg
          className="webgpuFallbackBanner__iconSvg"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          focusable="false"
        >
          <path
            fill="currentColor"
            d="M1.5 20.5L12 2.25l10.5 18.25H1.5Zm10.5-3.25a1.2 1.2 0 1 0 0 2.4a1.2 1.2 0 0 0 0-2.4Zm-1.15-7.75l.25 6h1.8l.25-6V7h-2.3v2.5Z"
          />
        </svg>
      </span>
      <span className="webgpuFallbackBanner__text">{displayMessage}</span>
      <button
        className="webgpuFallbackBanner__close"
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          setInternalDismissed(true);
          onDismiss?.();
        }}
      >
        <svg
          className="webgpuFallbackBanner__closeSvg"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          focusable="false"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M18.3 5.7a1 1 0 0 1 0 1.4L13.4 12l4.9 4.9a1 1 0 1 1-1.4 1.4L12 13.4l-4.9 4.9a1 1 0 1 1-1.4-1.4L10.6 12 5.7 7.1a1 1 0 0 1 1.4-1.4L12 10.6l4.9-4.9a1 1 0 0 1 1.4 0Z"
          />
        </svg>
      </button>
    </div>
  );
}

export default WebGPUFallbackBanner;
