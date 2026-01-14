import { SessionData } from "../types/session";
import { migrateSessionDataToLatest } from "../sessions/migrateSessionData";

/**
 * Convert a string to snake_case for filenames
 */
export function toSnakeCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
}

/**
 * Validate if an object has the structure of a valid SessionData
 */
export function isValidSessionData(data: any): data is SessionData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Accept versionless sessions as v1; reject unknown/unsupported versions.
  try {
    migrateSessionDataToLatest(data);
  } catch {
    return false;
  }

  // Check required top-level fields
  const requiredFields = ['id', 'name', 'metadata', 'modules', 'init', 'engine', 'oscillators'];
  for (const field of requiredFields) {
    if (!(field in data)) {
      return false;
    }
  }

  // Check metadata structure
  const metadata = data.metadata;
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }

  const requiredMetadataFields = ['particleCount', 'createdAt', 'lastModified'];
  for (const field of requiredMetadataFields) {
    if (!(field in metadata)) {
      return false;
    }
  }

  // Check that particleCount is a number
  if (typeof metadata.particleCount !== 'number') {
    return false;
  }

  // Check that dates are strings
  if (typeof metadata.createdAt !== 'string' || typeof metadata.lastModified !== 'string') {
    return false;
  }

  // Check that name is a string
  if (typeof data.name !== 'string') {
    return false;
  }

  // Check that required objects exist
  if (!data.modules || typeof data.modules !== 'object') {
    return false;
  }

  if (!data.init || typeof data.init !== 'object') {
    return false;
  }

  if (!data.engine || typeof data.engine !== 'object') {
    return false;
  }

  if (!data.oscillators || typeof data.oscillators !== 'object') {
    return false;
  }

  return true;
}

/**
 * Download a JSON file with the given data and filename
 */
export function downloadJsonFile(data: any, filename: string): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the object URL
  URL.revokeObjectURL(url);
}

/**
 * Read and parse a JSON file
 */
export function readJsonFile(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!file.type.includes('json') && !file.name.endsWith('.json')) {
      reject(new Error('Please select a valid JSON file'));
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        resolve(data);
      } catch (error) {
        reject(new Error('Invalid JSON file format'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
}