import "./GyroscopePermissionBanner.css";

export function GyroscopePermissionBanner(props: {
  isVisible: boolean;
  onRequestPermission: () => void;
  message?: string;
}) {
  const { isVisible, onRequestPermission, message } = props;

  if (!isVisible) return null;

  return (
    <div className="gyroBanner" role="status" aria-live="polite">
      <span className="gyroBanner__icon" aria-hidden="true">
        <svg
          className="gyroBanner__iconSvg"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          focusable="false"
        >
          <path
            fill="currentColor"
            d="M12 2a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8a8.01 8.01 0 0 1-8 8Zm0-14a1 1 0 0 0-1 1v4.09l-2.29 2.3a1 1 0 0 0 1.41 1.41l2.59-2.59A1 1 0 0 0 13 12V7a1 1 0 0 0-1-1Z"
          />
        </svg>
      </span>
      <span className="gyroBanner__text">
        {message ?? "Enable gyroscope for tilt controls."}
      </span>
      <button
        className="gyroBanner__action"
        type="button"
        onClick={onRequestPermission}
      >
        Enable
      </button>
    </div>
  );
}


