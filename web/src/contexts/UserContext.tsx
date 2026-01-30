import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { logger } from '@/utils/logger';

const USER_ID_KEY = 'aidashboard_user_id';

/**
 * Generate a UUID v4 string as fallback
 */
function generateUUID(): string {
  // Use crypto.randomUUID if available, otherwise fall back to simple generation
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback: simple UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
    // Generate a new user ID with fallback for browsers without crypto.randomUUID
    userId = `user_${generateUUID()}`;
    localStorage.setItem(USER_ID_KEY, userId);
    logger.log('[User Context] Created new user ID:', userId);
  }
  return userId;
}

interface UserContextType {
  userId: string;
  resetUserId: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string>(getUserId());

  const resetUserId = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(USER_ID_KEY);
      const newId = getUserId();
      setUserId(newId);
      logger.log('[User Context] Reset user ID to:', newId);
    }
  };

  return (
    <UserContext.Provider value={{ userId, resetUserId }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
