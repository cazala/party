import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  Trash2,
  AlertCircle,
  MoreVertical,
  Edit3,
  Copy,
  Upload,
} from "lucide-react";
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
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(
    null
  );
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(
    null
  );
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const {
    orderedSessions,
    loadSession,
    deleteSession,
    renameSession,
    duplicateSession,
    exportSession,
    importSession,
    reorderSessionsList,
    storageInfo,
    isLoading,
    loadError,
    clearErrors,
    refreshSessions,
  } = useSession();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDeletingSessionId(null);
      setRenamingSessionId(null);
      setOpenDropdownId(null);
      setImportError(null);
      clearErrors();
      refreshSessions();
    }
  }, [isOpen, clearErrors, refreshSessions]);

  // Close dropdown when clicking outside or modal scrolls
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdownId) {
        const target = event.target as Element;
        // Check if click is outside both the trigger button and the portal dropdown
        const isClickOnTrigger = target.closest(".dropdown-trigger");
        const isClickOnDropdown = target.closest(".dropdown-portal");

        if (!isClickOnTrigger && !isClickOnDropdown) {
          setOpenDropdownId(null);
        }
      }
    };

    const handleModalScroll = () => {
      if (openDropdownId) {
        setOpenDropdownId(null);
      }
    };

    if (openDropdownId) {
      document.addEventListener("click", handleClickOutside);
      const modalBody = document.querySelector(
        ".load-session-modal .sessions-list"
      );
      if (modalBody) {
        modalBody.addEventListener("scroll", handleModalScroll);
      }

      return () => {
        document.removeEventListener("click", handleClickOutside);
        if (modalBody) {
          modalBody.removeEventListener("scroll", handleModalScroll);
        }
      };
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
    if (newName.trim() && newName.trim() !== "") {
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

  const handleExportSession = async (sessionId: string) => {
    const success = await exportSession(sessionId);
    if (success) {
      setOpenDropdownId(null);
    }
  };

  const handleImportSession = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError(null);
    const result = await importSession(file);
    
    if (!result.success) {
      setImportError(result.error || "Failed to import session");
    }

    // Reset the file input
    event.target.value = "";
  };

  const triggerImport = () => {
    const fileInput = document.getElementById("session-import-input") as HTMLInputElement;
    fileInput?.click();
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
      return (
        date.toLocaleDateString() +
        " " +
        date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch {
      return "Unknown date";
    }
  };

  const moveSession = (dragIndex: number, hoverIndex: number) => {
    const newOrder = [...orderedSessions];
    const [draggedSession] = newOrder.splice(dragIndex, 1);
    newOrder.splice(hoverIndex, 0, draggedSession);
    reorderSessionsList(newOrder.map((session) => session.id));
  };

  const formatParticleCount = (count: number): string => {
    return count.toLocaleString();
  };

  const footer = (
    <>
      <div
        style={{
          flex: 1,
          fontSize: "12px",
          color: "var(--color-text-secondary)",
        }}
      >
        {orderedSessions.length > 0 && (
          <>
            {`${orderedSessions.length} session${
              orderedSessions.length === 1 ? "" : "s"
            } available`}
            {storageInfo && (
              <>
                {" • "}
                <span
                  style={{
                    color: storageInfo.isHighUsage
                      ? "#ffc107"
                      : "var(--color-text-secondary)",
                    fontWeight: storageInfo.isHighUsage ? "600" : "normal",
                  }}
                >
                  {storageInfo.formattedSize} used
                </span>
              </>
            )}
          </>
        )}
      </div>
      <button
        type="button"
        className="session-modal-button secondary"
        onClick={triggerImport}
        disabled={isLoading}
        title="Import session from JSON file"
      >
        <Upload size={14} />
        Import
      </button>
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
      footer={footer}
      width="700px"
      className="load-session-modal"
    >
      {(loadError || importError) && (
        <div className="error-message" style={{ marginBottom: "16px" }}>
          <AlertCircle size={16} />
          {loadError || importError}
        </div>
      )}

      {/* Hidden file input for import */}
      <input
        id="session-import-input"
        type="file"
        accept=".json,application/json"
        onChange={handleImportSession}
        style={{ display: "none" }}
      />

      {isLoading ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            color: "var(--color-text-secondary)",
          }}
        >
          <div className="spinner" style={{ margin: "0 auto 16px" }} />
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
                handleExportSession={handleExportSession}
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
  handleExportSession: (id: string) => void;
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
  handleExportSession,
  handleDropdownToggle,
  openDropdownId,
  renamingSessionId,
  setRenamingSessionId,
  setOpenDropdownId,
  formatDate,
  formatParticleCount,
  isLoading,
}: SessionRowProps) {
  const [{ isDragging }, drag, dragPreview] = useDrag({
    type: "session",
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: "session",
    hover: (item: { index: number }) => {
      if (item.index !== index) {
        moveSession(item.index, index);
        item.index = index;
      }
    },
  });

  const [renameValue, setRenameValue] = useState(session.name);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    direction: "down" as "down" | "up",
  });
  const [dropdownReady, setDropdownReady] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const lastModified =
    session.metadata.lastModified || session.metadata.createdAt;

  const handleRenameSubmit = () => {
    handleRenameSession(session.id, renameValue);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setRenameValue(session.name);
      setRenamingSessionId(null);
    }
  };

  // Calculate dropdown position when it opens
  useEffect(() => {
    if (openDropdownId === session.id && triggerRef.current) {
      // Reset ready state to hide dropdown during calculation
      setDropdownReady(false);

      // Small delay to ensure DOM is updated
      const calculatePosition = () => {
        const trigger = triggerRef.current;
        if (!trigger) return;

        const triggerRect = trigger.getBoundingClientRect();

        // Dropdown menu dimensions (approximate)
        const dropdownMenuHeight = 120;
        const dropdownMenuWidth = 120;

        // Calculate available space below and above
        const spaceBelow = window.innerHeight - triggerRect.bottom;
        const spaceAbove = triggerRect.top;

        // Determine direction
        const direction =
          spaceBelow >= dropdownMenuHeight || spaceBelow >= spaceAbove
            ? "down"
            : "up";

        // Calculate position
        let top =
          direction === "down"
            ? triggerRect.bottom + 4
            : triggerRect.top - dropdownMenuHeight - 4;

        let left = triggerRect.right - dropdownMenuWidth;

        // Ensure dropdown doesn't go off screen
        if (left < 8) left = 8;
        if (left + dropdownMenuWidth > window.innerWidth - 8) {
          left = window.innerWidth - dropdownMenuWidth - 8;
        }

        setDropdownPosition({ top, left, direction });

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
      ref={(node) => dragPreview(drop(node))}
      className={`session-item ${isDragging ? "dragging" : ""}`}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div
        ref={drag}
        className="session-number drag-handle"
        title="Drag to reorder"
      >
        #{rowNumber}
      </div>

      <div
        className="session-info"
        onClick={(e) => {
          // Don't load if we're in delete/rename mode or if clicking on interactive elements
          if (
            deletingSessionId === session.id ||
            renamingSessionId === session.id
          )
            return;

          // Don't load if clicking on the rename input
          if ((e.target as Element).closest(".rename-input-container")) return;

          handleLoadSession(session.id);
        }}
        style={{
          cursor:
            deletingSessionId === session.id || renamingSessionId === session.id
              ? "default"
              : "pointer",
        }}
        title={
          deletingSessionId === session.id || renamingSessionId === session.id
            ? ""
            : "Click to load session"
        }
      >
        {deletingSessionId === session.id ? (
          <div className="delete-confirmation-text">
            Are you sure you want to delete "{session.name}"? This action cannot
            be undone.
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
              <span>
                {formatParticleCount(session.metadata.particleCount)} particles
              </span>
              <span>•</span>
              <span>
                {session.metadata.hasParticleData !== undefined
                  ? session.metadata.hasParticleData
                    ? "Full data"
                    : "Config only"
                  : "Config only"}
              </span>
              <span>•</span>
              <span>Last updated {formatDate(lastModified)}</span>
            </div>
          </>
        )}
      </div>

      <div
        className={`session-actions ${
          deletingSessionId === session.id
            ? "delete-mode"
            : renamingSessionId === session.id
            ? "rename-mode"
            : openDropdownId === session.id
            ? "dropdown-open"
            : ""
        }`}
      >
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
                ref={triggerRef}
                className="session-modal-button secondary dropdown-trigger"
                onClick={() => handleDropdownToggle(session.id)}
                disabled={isLoading}
              >
                <MoreVertical size={14} />
              </button>
              {openDropdownId === session.id &&
                dropdownReady &&
                createPortal(
                  <div
                    className={`dropdown-portal dropdown-menu ${
                      dropdownPosition.direction === "up"
                        ? "dropdown-up"
                        : "dropdown-down"
                    } dropdown-ready`}
                    style={{
                      position: "fixed",
                      top: `${dropdownPosition.top}px`,
                      left: `${dropdownPosition.left}px`,
                      zIndex: 10000,
                    }}
                  >
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
                      className="dropdown-item"
                      onClick={() => handleExportSession(session.id)}
                    >
                      <Download size={12} />
                      Export
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
                  </div>,
                  document.body
                )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
