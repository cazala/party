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
    
    // Handle quota exceeded error specifically
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      const { usedSessions, totalSize } = getStorageInfo();
      const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
      throw new Error(
        `Storage quota exceeded! You're using ${sizeInMB}MB across ${usedSessions} sessions. ` +
        `Please delete some sessions to free up space, or consider using sessions with fewer particles.`
      );
    }
    
    throw new Error("Failed to save session. Please try again or contact support if the issue persists.");
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
 * Rename a session
 */
export function renameSession(sessionId: string, newName: string): void {
  try {
    // Load the session data
    const sessionData = loadSession(sessionId);
    if (!sessionData) {
      throw new Error("Session not found");
    }

    // Update the session name and last modified time
    sessionData.name = newName;
    sessionData.metadata.lastModified = new Date().toISOString();

    // Save the updated session data
    const sessionKey = getSessionKey(sessionId);
    localStorage.setItem(sessionKey, JSON.stringify(sessionData));

    // Update the session index
    const sessions = getSessionIndex();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex >= 0) {
      sessions[sessionIndex].name = newName;
      sessions[sessionIndex].metadata.lastModified = sessionData.metadata.lastModified;
      updateSessionIndex(sessions);
    }
  } catch (error) {
    console.error("Failed to rename session:", error);
    throw new Error("Failed to rename session");
  }
}

/**
 * Duplicate a session
 */
export function duplicateSession(sessionId: string): string {
  try {
    // Load the existing session data
    const sessionData = loadSession(sessionId);
    if (!sessionData) {
      throw new Error("Session not found");
    }

    // Generate a new ID for the duplicate
    const newSessionId = generateSessionId(sessionData.name);
    const now = new Date().toISOString();

    // Create the duplicate with new timestamps and ID
    const duplicateSessionData: SessionData = {
      ...sessionData,
      id: newSessionId,
      metadata: {
        ...sessionData.metadata,
        createdAt: now,
        lastModified: now,
      },
    };

    // Save the duplicate session
    const duplicateSessionKey = getSessionKey(newSessionId);
    localStorage.setItem(duplicateSessionKey, JSON.stringify(duplicateSessionData));

    // Update the session index
    const sessions = getSessionIndex();
    const duplicateListItem: SessionListItem = {
      id: newSessionId,
      name: duplicateSessionData.name,
      metadata: duplicateSessionData.metadata,
    };
    sessions.push(duplicateListItem);
    updateSessionIndex(sessions);

    return newSessionId;
  } catch (error) {
    console.error("Failed to duplicate session:", error);
    throw new Error("Failed to duplicate session");
  }
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
export function getStorageInfo(): { usedSessions: number; totalSize: number; formattedSize: string; isHighUsage: boolean } {
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
  
  // Add session index size
  try {
    const indexData = localStorage.getItem(SESSION_INDEX_KEY);
    if (indexData) {
      totalSize += indexData.length;
    }
  } catch (error) {
    // Ignore error
  }
  
  // Format size appropriately
  let formattedSize: string;
  let isHighUsage = false;
  
  if (totalSize < 1024) {
    formattedSize = `${totalSize}B`;
  } else if (totalSize < 1024 * 1024) {
    const sizeInKB = (totalSize / 1024).toFixed(1);
    formattedSize = `${sizeInKB}KB`;
    isHighUsage = totalSize > 512 * 1024; // > 512KB
  } else {
    const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
    formattedSize = `${sizeInMB}MB`;
    isHighUsage = totalSize > 2 * 1024 * 1024; // > 2MB
  }
  
  return {
    usedSessions: sessions.length,
    totalSize,
    formattedSize,
    isHighUsage,
  };
}