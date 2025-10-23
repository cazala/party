import { useState, useEffect, useRef } from "react";
import { Download, Trash2, AlertCircle, RefreshCw, MoreVertical, Edit3, Copy } from "lucide-react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
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
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const { 
    orderedSessions, 
    loadSession, 
    deleteSession, 
    renameSession,
    duplicateSession,
    refreshSessions,
    reorderSessionsList,
    isLoading, 
    loadError, 
    clearErrors 
  } = useSession();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDeletingSessionId(null);
      setRenamingSessionId(null);
      setOpenDropdownId(null);
      clearErrors();
      refreshSessions();
    }
  }, [isOpen, clearErrors, refreshSessions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdownId && !(event.target as Element).closest('.dropdown-container')) {
        setOpenDropdownId(null);
      }
    };

    if (openDropdownId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openDropdownId]);

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
      setOpenDropdownId(null);
    }
  };

  const handleRenameSession = async (sessionId: string, newName: string) => {
    if (newName.trim() && newName.trim() !== '') {
      const success = await renameSession(sessionId, newName.trim());
      if (success) {
        setRenamingSessionId(null);
        setOpenDropdownId(null);
      }
    }
  };

  const handleDuplicateSession = async (sessionId: string) => {
    const success = await duplicateSession(sessionId);
    if (success) {
      setOpenDropdownId(null);
    }
  };

  const handleDropdownToggle = (sessionId: string) => {
    setOpenDropdownId(openDropdownId === sessionId ? null : sessionId);
    // Reset other states when opening dropdown
    setDeletingSessionId(null);
    setRenamingSessionId(null);
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

  const moveSession = (dragIndex: number, hoverIndex: number) => {
    const newOrder = [...orderedSessions];
    const [draggedSession] = newOrder.splice(dragIndex, 1);
    newOrder.splice(hoverIndex, 0, draggedSession);
    reorderSessionsList(newOrder.map(session => session.id));
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
        {orderedSessions.length > 0 && `${orderedSessions.length} session${orderedSessions.length === 1 ? '' : 's'} available`}
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
      ) : orderedSessions.length === 0 ? (
        <div className="empty-sessions">
          No saved sessions found.
          <br />
          Save your first session to get started!
        </div>
      ) : (
        <DndProvider backend={HTML5Backend}>
          <div className="sessions-list">
            {orderedSessions.map((session: SessionListItem, index: number) => (
              <SessionRow
                key={session.id}
                session={session}
                index={index}
                rowNumber={index + 1}
                moveSession={moveSession}
                deletingSessionId={deletingSessionId}
                setDeletingSessionId={setDeletingSessionId}
                handleLoadSession={handleLoadSession}
                handleDeleteSession={handleDeleteSession}
                handleRenameSession={handleRenameSession}
                handleDuplicateSession={handleDuplicateSession}
                handleDropdownToggle={handleDropdownToggle}
                openDropdownId={openDropdownId}
                renamingSessionId={renamingSessionId}
                setRenamingSessionId={setRenamingSessionId}
                setOpenDropdownId={setOpenDropdownId}
                formatDate={formatDate}
                formatParticleCount={formatParticleCount}
                isLoading={isLoading}
              />
            ))}
          </div>
        </DndProvider>
      )}
    </Modal>
  );
}

interface SessionRowProps {
  session: SessionListItem;
  index: number;
  rowNumber: number;
  moveSession: (dragIndex: number, hoverIndex: number) => void;
  deletingSessionId: string | null;
  setDeletingSessionId: (id: string | null) => void;
  handleLoadSession: (id: string) => void;
  handleDeleteSession: (id: string) => void;
  handleRenameSession: (id: string, newName: string) => void;
  handleDuplicateSession: (id: string) => void;
  handleDropdownToggle: (id: string) => void;
  openDropdownId: string | null;
  renamingSessionId: string | null;
  setRenamingSessionId: (id: string | null) => void;
  setOpenDropdownId: (id: string | null) => void;
  formatDate: (date: string) => string;
  formatParticleCount: (count: number) => string;
  isLoading: boolean;
}

function SessionRow({
  session,
  index,
  rowNumber,
  moveSession,
  deletingSessionId,
  setDeletingSessionId,
  handleLoadSession,
  handleDeleteSession,
  handleRenameSession,
  handleDuplicateSession,
  handleDropdownToggle,
  openDropdownId,
  renamingSessionId,
  setRenamingSessionId,
  setOpenDropdownId,
  formatDate,
  formatParticleCount,
  isLoading,
}: SessionRowProps) {
  const [{ isDragging }, drag] = useDrag({
    type: 'session',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'session',
    hover: (item: { index: number }) => {
      if (item.index !== index) {
        moveSession(item.index, index);
        item.index = index;
      }
    },
  });

  const [renameValue, setRenameValue] = useState(session.name);
  const [dropdownPosition, setDropdownPosition] = useState<'down' | 'up'>('down');
  const [dropdownReady, setDropdownReady] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lastModified = session.metadata.lastModified || session.metadata.createdAt;

  const handleRenameSubmit = () => {
    handleRenameSession(session.id, renameValue);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setRenameValue(session.name);
      setRenamingSessionId(null);
    }
  };

  // Calculate dropdown position when it opens
  useEffect(() => {
    if (openDropdownId === session.id && dropdownRef.current) {
      // Reset ready state to hide dropdown during calculation
      setDropdownReady(false);
      
      // Small delay to ensure DOM is updated
      const calculatePosition = () => {
        const dropdownContainer = dropdownRef.current;
        if (!dropdownContainer) return;
        
        const containerRect = dropdownContainer.getBoundingClientRect();
        
        // Find the sessions list container to get the scrollable area bounds
        const sessionsList = dropdownContainer.closest('.sessions-list');
        const modalBody = dropdownContainer.closest('.modal-body');
        
        let availableSpace = window.innerHeight - containerRect.bottom;
        
        // If we're inside a modal or scrollable container, use that as the boundary
        if (sessionsList) {
          const sessionsListRect = sessionsList.getBoundingClientRect();
          availableSpace = sessionsListRect.bottom - containerRect.bottom;
        } else if (modalBody) {
          const modalRect = modalBody.getBoundingClientRect();
          availableSpace = modalRect.bottom - containerRect.bottom;
        }
        
        // Dropdown menu height (approximate) - 3 items × ~40px each
        const dropdownMenuHeight = 120;
        
        if (availableSpace < dropdownMenuHeight) {
          setDropdownPosition('up');
        } else {
          setDropdownPosition('down');
        }
        
        // Show the dropdown now that positioning is calculated
        setDropdownReady(true);
      };
      
      // Use requestAnimationFrame to ensure positioning happens after render
      requestAnimationFrame(calculatePosition);
    } else {
      // Reset when dropdown closes
      setDropdownReady(false);
    }
  }, [openDropdownId, session.id]);

  return (
    <div
      ref={(node) => drag(drop(node))}
      className={`session-item ${isDragging ? 'dragging' : ''}`}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div className="session-number">#{rowNumber}</div>
      
      <div className="session-info">
        {deletingSessionId === session.id ? (
          <div className="delete-confirmation-text">
            Are you sure you want to delete "{session.name}"? This action cannot be undone.
          </div>
        ) : renamingSessionId === session.id ? (
          <div className="rename-input-container">
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              className="rename-input"
              autoFocus
            />
          </div>
        ) : (
          <>
            <div className="session-name">{session.name}</div>
            <div className="session-details">
              <span>{formatParticleCount(session.metadata.particleCount)} particles</span>
              <span>•</span>
              <span>
                {session.metadata.hasParticleData !== undefined 
                  ? (session.metadata.hasParticleData ? "Full data" : "Config only")
                  : "Config only"}
              </span>
              <span>•</span>
              <span>Last updated {formatDate(lastModified)}</span>
            </div>
          </>
        )}
      </div>
      
      <div className={`session-actions ${
        deletingSessionId === session.id ? 'delete-mode' : 
        renamingSessionId === session.id ? 'rename-mode' : ''
      }`}>
        {deletingSessionId === session.id ? (
          <>
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
          </>
        ) : renamingSessionId === session.id ? (
          <>
            <button 
              className="session-modal-button primary"
              onClick={handleRenameSubmit}
            >
              Confirm
            </button>
            <button 
              className="session-modal-button secondary"
              onClick={() => {
                setRenameValue(session.name);
                setRenamingSessionId(null);
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button 
              className="session-modal-button primary"
              onClick={() => handleLoadSession(session.id)}
              disabled={isLoading}
            >
              <Download size={14} />
              Load
            </button>
            <div className="dropdown-container" ref={dropdownRef}>
              <button 
                className="session-modal-button secondary dropdown-trigger"
                onClick={() => handleDropdownToggle(session.id)}
                disabled={isLoading}
              >
                <MoreVertical size={14} />
              </button>
              {openDropdownId === session.id && (
                <div className={`dropdown-menu ${dropdownPosition === 'up' ? 'dropdown-up' : 'dropdown-down'} ${dropdownReady ? 'dropdown-ready' : 'dropdown-calculating'}`}>
                  <button 
                    className="dropdown-item"
                    onClick={() => {
                      setRenamingSessionId(session.id);
                      setOpenDropdownId(null);
                    }}
                  >
                    <Edit3 size={12} />
                    Rename
                  </button>
                  <button 
                    className="dropdown-item"
                    onClick={() => handleDuplicateSession(session.id)}
                  >
                    <Copy size={12} />
                    Duplicate
                  </button>
                  <button 
                    className="dropdown-item danger"
                    onClick={() => {
                      setDeletingSessionId(session.id);
                      setOpenDropdownId(null);
                    }}
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}