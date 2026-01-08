import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Copy } from "lucide-react";
import "./InAppBrowserBlocker.css";
import { shouldBlockInAppBrowserForWebGPU } from "../utils/deviceCapabilities";

type InAppBrowserBlockerProps = {
  /**
   * Optional escape hatch (e.g. for debugging).
   */
  disabled?: boolean;
};

export function InAppBrowserBlocker({ disabled }: InAppBrowserBlockerProps) {
  const [copied, setCopied] = useState(false);

  const forceShow = useMemo(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    // Allow `?showInAppBrowserBlocker` (or with any value) to force it on for testing.
    return params.has("showInAppBrowserBlocker");
  }, []);

  const shouldShow = useMemo(() => {
    if (disabled) return false;
    if (forceShow) return true;
    return shouldBlockInAppBrowserForWebGPU();
  }, [disabled, forceShow]);

  // Prevent background scroll when blocking.
  useEffect(() => {
    if (!shouldShow) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [shouldShow]);

  if (!shouldShow) return null;

  const url = typeof window !== "undefined" ? window.location.href : "";

  const onCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard may be unavailable in some in-app contexts; fall back to prompt.
      // eslint-disable-next-line no-alert
      window.prompt("Copy this link:", url);
    }
  };

  const onReload = () => {
    window.location.reload();
  };

  return (
    <div className="inAppBrowserBlocker" role="dialog" aria-modal="true">
      <div className="inAppBrowserBlocker__card">
        <div className="inAppBrowserBlocker__titleRow">
          <ExternalLink className="inAppBrowserBlocker__icon" aria-hidden="true" />
          <h2 className="inAppBrowserBlocker__title">Open in your browser to continue</h2>
        </div>

        <p className="inAppBrowserBlocker__text">
          WebGPU is disabled in many in-app browsers.
          <br />
          <strong>Open in browser</strong> to continue.
        </p>

        <div className="inAppBrowserBlocker__actions">
          <button
            type="button"
            className="inAppBrowserBlocker__button inAppBrowserBlocker__buttonPrimary"
            onClick={onCopyLink}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Copy width={16} height={16} aria-hidden="true" />
              {copied ? "Copied!" : "Copy link"}
            </span>
          </button>
          <button type="button" className="inAppBrowserBlocker__button" onClick={onReload}>
            Reload
          </button>
        </div>

        <div className="inAppBrowserBlocker__hint">
          Tip: use “Open in browser” if available — otherwise copy the link and paste it into Safari/Chrome.
        </div>
      </div>
    </div>
  );
}

export default InAppBrowserBlocker;
