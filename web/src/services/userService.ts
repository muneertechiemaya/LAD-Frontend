import { safeStorage } from '@lad/shared/storage';  
import { getApiUrl, defaultFetchOptions } from '../config/api';
import { User } from '../store/slices/usersSlice';
import { logger } from '@/lib/logger';
// Remove mockUserSettings, use API for user preferences
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return safeStorage.getItem('token') || safeStorage.getItem('token');
}
/**
 * Same-origin path in the browser, so the call goes through the Next.js /api
 * proxy (cookie auth) like the SDK's apiClient. getApiUrl() points the browser
 * straight at NEXT_PUBLIC_BACKEND_URL - a cross-origin request that fails
 * wherever the backend does not allow the page's origin, and the Pipeline board
 * treated that failed users list as fatal.
 */
function sameOriginUrl(path: string): string {
  return typeof window === 'undefined' ? getApiUrl(path) : path;
}
const DEFAULT_FETCH_TIMEOUT_MS = 20000;
async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
// Pipeline Preferences Helper Functions
interface PipelinePreferences {
  viewMode:  'list' | 'kanban' ;
  visibleColumns: Record<string, boolean>;
  filters: {
    statuses: string[];
    priorities: string[];
    sources: string[];
    assignees: string[];
    dateRange: { start: string | null; end: string | null };
  };
  sortConfig: {
    field: string;
    direction: 'asc' | 'desc';
  };
  uiSettings: {
    zoom: number;
    autoRefresh: boolean;
    refreshInterval: number;
    compactView: boolean;
    showCardCount: boolean;
    showStageValue: boolean;
    enableDragAndDrop: boolean;
  };
}
export async function getPipelinePreferences(): Promise<PipelinePreferences> {
  try {
    const token = getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    const response = await fetchWithTimeout(sameOriginUrl('/api/deals-pipeline/settings'), {
      credentials: 'include',
      ...defaultFetchOptions(),
      headers: {
        ...defaultFetchOptions().headers,
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) {
      throw new Error('Failed to get pipeline settings');
    }
    const result = await response.json();
    const settings = result.settings || {};
    // Return the settings directly since backend now returns the correct structure
    return settings;
  } catch (error) {
    return getPipelineDefaults();
  }
}
export async function savePipelinePreferences(preferences: PipelinePreferences): Promise<PipelinePreferences> {
  try {
    const token = getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    // Send preferences as structured object (not flattened)
    const response = await fetchWithTimeout(sameOriginUrl('/api/deals-pipeline/settings'), {
      credentials: 'include',
      ...defaultFetchOptions(),
      method: 'PUT',
      headers: {
        ...defaultFetchOptions().headers,
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(preferences)
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to save pipeline preferences: ${response.status} ${response.statusText} - ${errorText}`);
    }
    await response.json();
    return preferences;
  } catch (error) {
    logger.error('Failed to save pipeline preferences:', error);
    throw error;
  }
}
// Helper: Count nested properties recursively
function countNestedProperties(obj: Record<string, unknown>): number {
  let count = 0;
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      count += countNestedProperties(obj[key] as Record<string, unknown>);
    } else {
      count++;
    }
  }
  return count;
}
// Helper: Get default pipeline preferences
function getPipelineDefaults(): PipelinePreferences {
  return {
    viewMode: 'kanban',
    visibleColumns: {
      name: true,
      stage: true,
      status: true,
      assignee: true,
      amount: true,
      closeDate: true,
      source: true,
      priority: true,
      tags: false,
      company: false,
      phone: false,
      email: false,
      description: false,
      createdAt: false,
      updatedAt: false
    },
    filters: {
      statuses: [],
      priorities: [],
      sources: [],
      assignees: [],
      dateRange: { start: null, end: null }
    },
    sortConfig: {
      field: 'createdAt',
      direction: 'desc'
    },
    uiSettings: {
      zoom: 1.0,
      autoRefresh: true,
      refreshInterval: 30,
      compactView: false,
      showCardCount: true,
      showStageValue: true,
      enableDragAndDrop: true
    }
  };
}
export async function getAllUsers(): Promise<User[]> {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetchWithTimeout(sameOriginUrl('/api/users'), {
    credentials: 'include',
    ...defaultFetchOptions(),
    headers: {
      ...defaultFetchOptions().headers,
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) throw new Error('Failed to fetch users');
  return await response.json();
}
// Auto-save with debouncing for pipeline preferences
let debouncedSave: ReturnType<typeof setTimeout> | null = null;
export function autoSavePipelinePreferences(preferences: PipelinePreferences, delay = 2000): void {
  if (debouncedSave) {
    clearTimeout(debouncedSave);
  }
  debouncedSave = setTimeout(() => {
    savePipelinePreferences(preferences)
      .catch(error => {
        logger.error('Auto-save pipeline preferences failed:', error);
      });
  }, delay);
}
