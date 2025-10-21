import React, { useState, useEffect } from "react";
import { X, Save, AlertCircle } from "lucide-react";
import { useSession } from "../../hooks/useSession";
import { ModalPortal } from "./ModalPortal";
import "./Modal.css";

interface SaveSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  particleCount: number;
}

export function SaveSessionModal({ isOpen, onClose, particleCount }: SaveSessionModalProps) {
  const [sessionName, setSessionName] = useState("");
  const [nameError, setNameError] = useState("");
  const { saveCurrentSession, isSaving, saveError, clearErrors } = useSession();

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSessionName("");
      setNameError("");
      setSaveInitiated(false);
      clearErrors();
    }
  }, [isOpen, clearErrors]);

  // Track if save was initiated to detect successful completion
  const [saveInitiated, setSaveInitiated] = useState(false);

  // Close modal on successful save
  useEffect(() => {
    if (saveInitiated && !isSaving && !saveError && isOpen) {
      // Save completed successfully - close modal after short delay
      const timer = setTimeout(() => {
        onClose();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [saveInitiated, isSaving, saveError, isOpen, onClose]);

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
    
    setNameError("");
    setSaveInitiated(true);
    await saveCurrentSession(trimmedName);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSessionName(value);
    
    if (nameError) {
      const validationError = validateSessionName(value);
      setNameError(validationError);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="session-modal-overlay">
        <div className="session-modal-content save-session-modal">
          <div className="session-modal-header">
            <h2>Save Session</h2>
            <button 
              className="session-modal-close-button"
              onClick={onClose}
              disabled={isSaving}
            >
              <X size={20} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="session-modal-body">
          <div className="session-metadata">
            <div className="metadata-item">
              <span className="metadata-label">Particles:</span>
              <span className="metadata-value">{particleCount.toLocaleString()}</span>
            </div>
            <div className="metadata-item">
              <span className="metadata-label">Date:</span>
              <span className="metadata-value">{new Date().toLocaleDateString()}</span>
            </div>
          </div>
          
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
          
          {saveError && (
            <div className="error-message">
              <AlertCircle size={16} />
              {saveError}
            </div>
          )}
          </form>
          
          <div className="session-modal-footer">
            <button 
              type="button" 
              className="session-modal-button secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
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
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}