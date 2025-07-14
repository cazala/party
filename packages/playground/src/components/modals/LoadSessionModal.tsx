import React, { useState, useEffect } from "react";
import { ParticleSystem } from "@party/core";
import { SessionManager } from "../../utils/SessionManager";
import { SessionMetadata } from "../../types/session";
import "./Modal.css";

interface LoadSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  system: ParticleSystem | null;
  onLoadSuccess?: (sessionName: string) => void;
}

export function LoadSessionModal({
  isOpen,
  onClose,
  system,
  onLoadSuccess,
}: LoadSessionModalProps) {
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Load sessions when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSessions();
      setError("");
      setDeleteConfirm(null);
    }
  }, [isOpen]);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        if (deleteConfirm) {
          setDeleteConfirm(null);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, isLoading, deleteConfirm, onClose]);

  const loadSessions = () => {
    try {
      const metadata = SessionManager.getSessionMetadata();
      setSessions(metadata.sort((a, b) => b.timestamp - a.timestamp)); // Most recent first
    } catch (error) {
      setError("Failed to load sessions");
      console.error("Error loading sessions:", error);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      if (deleteConfirm) {
        setDeleteConfirm(null);
      } else {
        onClose();
      }
    }
  };

  const handleLoadSession = async (sessionName: string) => {
    if (!system) {
      setError("No system available to load into");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = SessionManager.loadSession(system, sessionName);

      if (result.success) {
        onLoadSuccess?.(sessionName);
        onClose();
      } else {
        setError(result.error || "Failed to load session");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (sessionName: string) => {
    setIsLoading(true);
    setError("");

    try {
      const result = SessionManager.deleteSession(sessionName);

      if (result.success) {
        setDeleteConfirm(null);
        loadSessions(); // Refresh the list
      } else {
        setError(result.error || "Failed to delete session");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
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

  const storageInfo = SessionManager.getStorageInfo();

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">Load Session</h2>
        </div>

        <div className="modal-body">
          {error && <div className="modal-error">{error}</div>}

          {/* Storage Info */}
          <div className="storage-info">
            <div className="storage-info-title">Storage Information</div>
            <div className={`storage-info-details ${storageInfo.isNearLimit ? "storage-warning" : ""}`}>
              {storageInfo.sessionCount} session{storageInfo.sessionCount !== 1 ? "s" : ""} • 
              {storageInfo.estimatedSize} used
              {storageInfo.isNearLimit && " • Storage space running low"}
            </div>
          </div>

          {sessions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💾</div>
              <div className="empty-state-text">No saved sessions</div>
              <div className="empty-state-subtext">
                Save your current playground state to load it later
              </div>
            </div>
          ) : (
            <div className="session-list">
              {sessions.map((session) => (
                <div key={session.name} className="session-item">
                  <div className="session-info">
                    <div className="session-name">{session.name}</div>
                    <div className="session-meta">
                      {session.particleCount} particles • {formatDate(session.timestamp)}
                    </div>
                  </div>
                  <div className="session-actions">
                    <button
                      className="session-button session-button-load"
                      onClick={() => handleLoadSession(session.name)}
                      disabled={isLoading}
                    >
                      Load
                    </button>
                    <button
                      className="session-button session-button-delete"
                      onClick={() => setDeleteConfirm(session.name)}
                      disabled={isLoading}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="modal-button modal-button-secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Close
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Session</h3>
            </div>
            <div className="modal-body">
              <p style={{ color: "#e8e8f0", margin: 0 }}>
                Are you sure you want to delete "{deleteConfirm}"? This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="modal-button modal-button-secondary"
                onClick={() => setDeleteConfirm(null)}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-button modal-button-danger"
                onClick={() => handleDeleteSession(deleteConfirm)}
                disabled={isLoading}
              >
                {isLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}