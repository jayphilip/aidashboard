import { useState, useEffect, useCallback } from 'react';
import type { FilterOptions } from '@/components/Filters';

const STORAGE_KEY = 'aidashboard_filter_preferences';

interface StoredFilterPreferences {
  sourceTypes: string[];
  topics: string[];
  dateRange: {
    start: string | null;
    end: string | null;
  };
}

export function useFilterPreferences() {
  const [savedFilters, setSavedFilters] = useState<FilterOptions | null>(null);

  // Load saved preferences on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: StoredFilterPreferences = JSON.parse(stored);
        setSavedFilters(parsed);
      }
    } catch (err) {
      console.warn('Failed to load filter preferences:', err);
    }
  }, []);

  // Save preferences to localStorage
  const saveFilters = useCallback((filters: FilterOptions) => {
    try {
      const toStore: StoredFilterPreferences = {
        sourceTypes: filters.sourceTypes,
        topics: filters.topics,
        dateRange: filters.dateRange,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
      setSavedFilters(filters);
    } catch (err) {
      console.warn('Failed to save filter preferences:', err);
    }
  }, []);

  // Clear saved preferences
  const clearFilters = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setSavedFilters(null);
    } catch (err) {
      console.warn('Failed to clear filter preferences:', err);
    }
  }, []);

  return {
    savedFilters,
    saveFilters,
    clearFilters,
  };
}
