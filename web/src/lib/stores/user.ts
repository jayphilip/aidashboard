import { writable } from 'svelte/store';
import { logger } from '$lib/utils/logger';

const USER_ID_KEY = 'aidashboard_user_id';

/**
 * Get or create a persistent user ID for the current client.
 * Uses localStorage to persist the ID across sessions.
 */
function getUserId(): string {
  if (typeof window === 'undefined') {
    return 'user_server'; // fallback for SSR
  }

  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    // Generate a new user ID using crypto.randomUUID()
    userId = `user_${crypto.randomUUID()}`;
    localStorage.setItem(USER_ID_KEY, userId);
    logger.log('[User Store] Created new user ID:', userId);
  }
  return userId;
}

export const userId = writable<string>(getUserId());

/**
 * Reset the user ID (for testing purposes).
 */
export function resetUserId() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(USER_ID_KEY);
    const newId = getUserId();
    userId.set(newId);
    logger.log('[User Store] Reset user ID to:', newId);
  }
}
