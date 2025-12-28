import "./GyroscopePermissionBanner.css";

export function GyroscopePermissionBanner(props: {
  isVisible: boolean;
  onRequestPermission: () => void;
  message?: string;
}) {
  const { isVisible, onRequestPermission, message } = props;

  if (!isVisible) return null;

  return (
    <div className="gyro-banner" role="region" aria-label="Gyroscope permission">
      <div className="gyro-banner__content">
        <div className="gyro-banner__text">
          {message ?? "Enable gyroscope for tilt controls."}
        </div>
        <button className="gyro-banner__button" onClick={onRequestPermission}>
          Enable
        </button>
      </div>
    </div>
  );
}


