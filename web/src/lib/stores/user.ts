import { writable } from 'svelte/store';

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
    // Generate a new user ID: "user_" + random hex string
    userId = `user_${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(USER_ID_KEY, userId);
    console.log('[User Store] Created new user ID:', userId);
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
    console.log('[User Store] Reset user ID to:', newId);
  }
}
