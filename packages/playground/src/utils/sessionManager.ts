import { SessionData, SessionListItem } from "../types/session";

const SESSION_STORAGE_PREFIX = "party-session-";
const SESSION_INDEX_KEY = "party-sessions-index";

/**
 * Generate a unique session ID based on name and timestamp
 */
export function generateSessionId(name: string): string {
  const timestamp = Date.now();
  const sanitizedName = name.replace(/[^a-zA-Z0-9-_]/g, "-").substring(0, 50);
  return `${sanitizedName}-${timestamp}`;
}

/**
 * Get the localStorage key for a session
 */
function getSessionKey(sessionId: string): string {
  return `${SESSION_STORAGE_PREFIX}${sessionId}`;
}

/**
 * Get the session index from localStorage
 */
function getSessionIndex(): SessionListItem[] {
  try {
    const indexData = localStorage.getItem(SESSION_INDEX_KEY);
    return indexData ? JSON.parse(indexData) : [];
  } catch (error) {
    console.error("Failed to load session index:", error);
    return [];
  }
}

/**
 * Update the session index in localStorage
 */
function updateSessionIndex(sessions: SessionListItem[]): void {
  try {
    localStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error("Failed to update session index:", error);
    throw new Error("Failed to save session index");
  }
}

/**
 * Save a session to localStorage
 */
export function saveSession(sessionData: SessionData): void {
  try {
    const sessionKey = getSessionKey(sessionData.id);
    
    // Save the session data
    localStorage.setItem(sessionKey, JSON.stringify(sessionData));
    
    // Update the session index
    const sessions = getSessionIndex();
    const existingIndex = sessions.findIndex(s => s.id === sessionData.id);
    
    const sessionListItem: SessionListItem = {
      id: sessionData.id,
      name: sessionData.name,
      metadata: sessionData.metadata,
    };
    
    if (existingIndex >= 0) {
      sessions[existingIndex] = sessionListItem;
    } else {
      sessions.push(sessionListItem);
    }
    
    updateSessionIndex(sessions);
  } catch (error) {
    console.error("Failed to save session:", error);
    throw new Error("Failed to save session. Your browser storage might be full.");
  }
}

/**
 * Load a session from localStorage
 */
export function loadSession(sessionId: string): SessionData | null {
  try {
    const sessionKey = getSessionKey(sessionId);
    const sessionData = localStorage.getItem(sessionKey);
    
    if (!sessionData) {
      return null;
    }
    
    return JSON.parse(sessionData);
  } catch (error) {
    console.error("Failed to load session:", error);
    return null;
  }
}

/**
 * Get all saved sessions
 */
export function getAllSessions(): SessionListItem[] {
  return getSessionIndex().sort((a, b) => 
    new Date(b.metadata.lastModified).getTime() - new Date(a.metadata.lastModified).getTime()
  );
}

/**
 * Delete a session from localStorage
 */
export function deleteSession(sessionId: string): void {
  try {
    const sessionKey = getSessionKey(sessionId);
    
    // Remove the session data
    localStorage.removeItem(sessionKey);
    
    // Update the session index
    const sessions = getSessionIndex();
    const filteredSessions = sessions.filter(s => s.id !== sessionId);
    updateSessionIndex(filteredSessions);
  } catch (error) {
    console.error("Failed to delete session:", error);
    throw new Error("Failed to delete session");
  }
}

/**
 * Check if localStorage is available and has space
 */
export function checkStorageAvailability(): { available: boolean; error?: string } {
  try {
    const testKey = "party-storage-test";
    localStorage.setItem(testKey, "test");
    localStorage.removeItem(testKey);
    return { available: true };
  } catch (error) {
    return { 
      available: false, 
      error: error instanceof Error ? error.message : "Storage unavailable" 
    };
  }
}

/**
 * Get storage usage information
 */
export function getStorageInfo(): { usedSessions: number; totalSize: number } {
  const sessions = getSessionIndex();
  let totalSize = 0;
  
  // Calculate approximate storage size
  sessions.forEach(session => {
    try {
      const sessionKey = getSessionKey(session.id);
      const data = localStorage.getItem(sessionKey);
      if (data) {
        totalSize += data.length;
      }
    } catch (error) {
      // Ignore errors for individual sessions
    }
  });
  
  return {
    usedSessions: sessions.length,
    totalSize,
  };
}