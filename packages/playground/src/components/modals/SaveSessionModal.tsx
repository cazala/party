import React, { useState, useEffect } from "react";
import { ParticleSystem } from "@party/core";
import { SessionManager } from "../../utils/SessionManager";
import "./Modal.css";

interface SaveSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  system: ParticleSystem | null;
  onSaveSuccess?: (sessionName: string) => void;
}

export function SaveSessionModal({
  isOpen,
  onClose,
  system,
  onSaveSuccess,
}: SaveSessionModalProps) {
  const [sessionName, setSessionName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
  const [existingSession, setExistingSession] = useState<any>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSessionName("");
      setError("");
      setIsLoading(false);
      setShowOverwriteWarning(false);
      setExistingSession(null);
    }
  }, [isOpen]);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, isLoading, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!system) {
      setError("No system available to save");
      return;
    }

    const trimmedName = sessionName.trim();

    if (!trimmedName) {
      setError("Session name is required");
      return;
    }

    if (trimmedName.length < 2) {
      setError("Session name must be at least 2 characters");
      return;
    }

    if (trimmedName.length > 50) {
      setError("Session name must be 50 characters or less");
      return;
    }

    // Check for invalid characters
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmedName)) {
      setError("Session name can only contain letters, numbers, spaces, hyphens, and underscores");
      return;
    }

    if (SessionManager.sessionExists(trimmedName)) {
      if (!showOverwriteWarning) {
        // Show overwrite warning instead of error
        const sessions = SessionManager.getSessionMetadata();
        const existing = sessions.find(s => s.name === trimmedName);
        setExistingSession(existing);
        setShowOverwriteWarning(true);
        setError("");
        return;
      }
      // If we reach here, user has confirmed overwrite
    }

    setIsLoading(true);
    setError("");

    try {
      const result = SessionManager.saveSession(system, trimmedName, showOverwriteWarning);

      if (result.success) {
        onSaveSuccess?.(trimmedName);
        onClose();
      } else {
        setError(result.error || "Failed to save session");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSessionName(e.target.value);
    if (error) {
      setError("");
    }
    if (showOverwriteWarning) {
      setShowOverwriteWarning(false);
      setExistingSession(null);
    }
  };

  const handleCancelOverwrite = () => {
    setShowOverwriteWarning(false);
    setExistingSession(null);
  };

  const handleConfirmOverwrite = () => {
    setShowOverwriteWarning(false);
    handleSubmit(new Event('submit') as any);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60);
      return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    } else if (diffInHours < 168) { // 7 days
      const days = Math.floor(diffInHours / 24);
      return `${days} day${days !== 1 ? "s" : ""} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (!isOpen) return null;

  const particleCount = system?.particles.length || 0;

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">Save Session</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div>
              <label className="modal-label" htmlFor="session-name">
                Session Name
              </label>
              <input
                id="session-name"
                type="text"
                className="modal-input"
                value={sessionName}
                onChange={handleInputChange}
                placeholder="Enter a name for this session"
                disabled={isLoading}
                autoFocus
                maxLength={50}
              />
              {error && <div className="modal-error">{error}</div>}
              
              <div className="modal-info">
                This will save {particleCount} particles and all current settings
              </div>
            </div>
          </div>

          <div className="modal-footer">
            {showOverwriteWarning && existingSession ? (
              <>
                <div className="modal-warning">
                  <div className="modal-warning-title">
                    ⚠️ Session Already Exists
                  </div>
                  <div className="modal-warning-content">
                    A session named "{existingSession.name}" already exists ({existingSession.particleCount} particles, {formatDate(existingSession.timestamp)}).
                  </div>
                </div>
                <div className="modal-warning-actions">
                  <button
                    type="button"
                    className="modal-button modal-button-secondary"
                    onClick={handleCancelOverwrite}
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="modal-button modal-button-warning"
                    onClick={handleConfirmOverwrite}
                    disabled={isLoading}
                  >
                    Overwrite Existing Session
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="modal-button modal-button-secondary"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-button modal-button-primary"
                  disabled={isLoading || !sessionName.trim()}
                >
                  {isLoading ? "Saving..." : "Save Session"}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}