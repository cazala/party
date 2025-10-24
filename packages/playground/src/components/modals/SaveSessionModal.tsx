import React, { useState, useEffect } from "react";
import { Save, AlertCircle } from "lucide-react";
import { useSession } from "../../hooks/useSession";
import { Modal } from "../Modal";
import "../SaveSessionModal.css";

interface SaveSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  particleCount: number;
}

export function SaveSessionModal({ isOpen, onClose, particleCount }: SaveSessionModalProps) {
  const [sessionName, setSessionName] = useState("");
  const [nameError, setNameError] = useState("");
  const [showOverrideWarning, setShowOverrideWarning] = useState(false);
  const { saveCurrentSession, isSaving, saveError, clearErrors, lastSessionName, availableSessions } = useSession();

  // Reset form when modal opens and populate with last session name
  useEffect(() => {
    if (isOpen) {
      setSessionName(lastSessionName || "");
      setNameError("");
      setShowOverrideWarning(false);
      setSaveInitiated(false);
      clearErrors();
    } else {
      // Reset state when modal closes to prevent issues on next open
      setSaveInitiated(false);
      setShowOverrideWarning(false);
      setNameError("");
    }
  }, [isOpen, clearErrors, lastSessionName]);

  // Track if save was initiated to detect successful completion
  const [saveInitiated, setSaveInitiated] = useState(false);


  // Close modal on successful save
  useEffect(() => {
    if (saveInitiated && !isSaving && !saveError && isOpen) {
      onClose();
    }
  }, [saveInitiated, isSaving, saveError, isOpen, onClose]);

  // Check if session name already exists
  const sessionExists = (name: string): boolean => {
    return availableSessions.some(session => session.name.toLowerCase() === name.toLowerCase());
  };

  const validateSessionName = (name: string): string => {
    if (!name.trim()) {
      return "Session name is required";
    }
    if (name.length < 2) {
      return "Session name must be at least 2 characters";
    }
    if (name.length > 100) {
      return "Session name must be less than 100 characters";
    }
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = sessionName.trim();
    const validationError = validateSessionName(trimmedName);
    
    if (validationError) {
      setNameError(validationError);
      return;
    }
    
    // Check if name exists and show warning if not already confirmed
    if (sessionExists(trimmedName) && !showOverrideWarning) {
      setShowOverrideWarning(true);
      setNameError("");
      return;
    }
    
    setNameError("");
    setShowOverrideWarning(false);
    setSaveInitiated(true);
    
    try {
      await saveCurrentSession(trimmedName);
    } catch (error) {
      console.error("Failed to save session:", error);
    }
  };

  const handleOverrideCancel = () => {
    setShowOverrideWarning(false);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSessionName(value);
    setShowOverrideWarning(false); // Hide override warning when name changes
    
    if (nameError) {
      const validationError = validateSessionName(value);
      setNameError(validationError);
    }
  };

  const footer = (
    <>
      <button 
        type="button" 
        className="session-modal-button secondary"
        onClick={onClose}
        disabled={isSaving}
      >
        Cancel
      </button>
      {!showOverrideWarning && (
        <button 
          type="submit" 
          className="session-modal-button primary"
          onClick={handleSubmit}
          disabled={isSaving || !!nameError || !sessionName.trim()}
        >
          {isSaving ? (
            <>
              <div className="spinner" />
              Saving...
            </>
          ) : (
            <>
              <Save size={16} />
              Save Session
            </>
          )}
        </button>
      )}
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Save Session"
      footer={footer}
      width="520px"
      className="save-session-modal"
    >
      <form onSubmit={handleSubmit}>
        <div className="session-metadata">
          <div className="metadata-item">
            <span className="metadata-label">Particles:</span>
            <span className="metadata-value">{particleCount.toLocaleString()}</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Date:</span>
            <span className="metadata-value">{new Date().toLocaleDateString()}</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Save type:</span>
            <span className="metadata-value">
              {particleCount <= 1000 ? "Full particle data" : "Initial configuration only"}
            </span>
          </div>
        </div>
        
        {particleCount > 1000 && (
          <div className="particle-limit-notice">
            <AlertCircle size={16} />
            Since this session has more than 1,000 particles, only the initial configuration will be saved. 
            When loaded, particles will be respawned using the saved settings rather than their exact current positions.
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="session-name">Session Name *</label>
          <input
            id="session-name"
            type="text"
            value={sessionName}
            onChange={handleNameChange}
            placeholder="Enter a name for this session..."
            disabled={isSaving}
            className={nameError ? "error" : ""}
            autoFocus
          />
          {nameError && (
            <div className="error-message">
              <AlertCircle size={16} />
              {nameError}
            </div>
          )}
        </div>
        
        {showOverrideWarning && (
          <div className="override-warning">
            <div>
              <AlertCircle size={16} />
              A session named "{sessionName.trim()}" already exists. Do you want to override it?
            </div>
            <div className="override-actions">
              <button 
                type="button"
                className="session-modal-button primary"
                onClick={handleSubmit}
                disabled={isSaving}
              >
                Yes, Override
              </button>
              <button 
                type="button"
                className="session-modal-button secondary"
                onClick={handleOverrideCancel}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        
        {saveError && (
          <div className="error-message">
            <AlertCircle size={16} />
            {saveError}
          </div>
        )}
      </form>
    </Modal>
  );
}