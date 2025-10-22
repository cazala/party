import { useState, useEffect } from "react";
import { Download, Trash2, AlertCircle, RefreshCw } from "lucide-react";
import { useSession } from "../../hooks/useSession";
import { SessionListItem } from "../../types/session";
import { Modal } from "../Modal";
import "../LoadSessionModal.css";

interface LoadSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoadSessionModal({ isOpen, onClose }: LoadSessionModalProps) {
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const { 
    availableSessions, 
    loadSession, 
    deleteSession, 
    refreshSessions,
    isLoading, 
    loadError, 
    clearErrors 
  } = useSession();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDeletingSessionId(null);
      clearErrors();
      refreshSessions();
    }
  }, [isOpen, clearErrors, refreshSessions]);

  const handleLoadSession = async (sessionId: string) => {
    const success = await loadSession(sessionId);
    if (success) {
      onClose();
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    const success = await deleteSession(sessionId);
    if (success) {
      setDeletingSessionId(null);
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return "Unknown date";
    }
  };

  const formatParticleCount = (count: number): string => {
    return count.toLocaleString();
  };

  const headerActions = (
    <button 
      className="session-modal-button secondary"
      onClick={refreshSessions}
      disabled={isLoading}
      title="Refresh sessions"
    >
      <RefreshCw size={14} />
    </button>
  );

  const footer = (
    <>
      <div style={{ flex: 1, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
        {availableSessions.length > 0 && `${availableSessions.length} session${availableSessions.length === 1 ? '' : 's'} available`}
      </div>
      <button 
        type="button" 
        className="session-modal-button secondary"
        onClick={onClose}
        disabled={isLoading}
      >
        Close
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Load Session"
      headerActions={headerActions}
      footer={footer}
      width="700px"
      className="load-session-modal"
    >
      {loadError && (
        <div className="error-message" style={{ marginBottom: '16px' }}>
          <AlertCircle size={16} />
          {loadError}
        </div>
      )}
      
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-secondary)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          Loading session...
        </div>
      ) : availableSessions.length === 0 ? (
        <div className="empty-sessions">
          No saved sessions found.
          <br />
          Save your first session to get started!
        </div>
      ) : (
        <div className="sessions-list">
          {availableSessions.map((session: SessionListItem) => (
            <div key={session.id} className="session-item">
              <div className="session-info">
                <div className="session-name">{session.name}</div>
                <div className="session-details">
                  <span>{formatParticleCount(session.metadata.particleCount)} particles</span>
                  <span>•</span>
                  <span>Saved {formatDate(session.metadata.createdAt)}</span>
                  {session.metadata.lastModified !== session.metadata.createdAt && (
                    <>
                      <span>•</span>
                      <span>Modified {formatDate(session.metadata.lastModified)}</span>
                    </>
                  )}
                </div>
                
                {deletingSessionId === session.id && (
                  <div className="delete-confirmation">
                    Are you sure you want to delete "{session.name}"? This action cannot be undone.
                    <div className="delete-actions">
                      <button 
                        className="session-modal-button danger"
                        onClick={() => handleDeleteSession(session.id)}
                      >
                        Yes, Delete
                      </button>
                      <button 
                        className="session-modal-button secondary"
                        onClick={() => setDeletingSessionId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {deletingSessionId !== session.id && (
                <div className="session-actions">
                  <button 
                    className="session-modal-button primary"
                    onClick={() => handleLoadSession(session.id)}
                    disabled={isLoading}
                  >
                    <Download size={14} />
                    Load
                  </button>
                  <button 
                    className="session-modal-button danger"
                    onClick={() => setDeletingSessionId(session.id)}
                    disabled={isLoading}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}