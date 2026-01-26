import type { SearchOptions } from '$lib/stores/items';

/**
 * Convert filter options to URL search params
 */
export function filtersToParams(filters: SearchOptions): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.query) {
    params.set('q', filters.query);
  }

  if (filters.sourceTypes && filters.sourceTypes.length > 0) {
    params.set('types', filters.sourceTypes.join(','));
  }

  if (filters.dateRange?.start) {
    const year = filters.dateRange.start.getFullYear();
    const month = String(filters.dateRange.start.getMonth() + 1).padStart(2, '0');
    const day = String(filters.dateRange.start.getDate()).padStart(2, '0');
    params.set('from', `${year}-${month}-${day}`);
  }

  if (filters.dateRange?.end) {
    const year = filters.dateRange.end.getFullYear();
    const month = String(filters.dateRange.end.getMonth() + 1).padStart(2, '0');
    const day = String(filters.dateRange.end.getDate()).padStart(2, '0');
    params.set('to', `${year}-${month}-${day}`);
  }

  if (filters.topics && filters.topics.length > 0) {
    params.set('topics', filters.topics.join(','));
  }

  if (filters.sourceIds && filters.sourceIds.length > 0) {
    params.set('sources', filters.sourceIds.join(','));
  }

  if (filters.likeStatus) {
    params.set('like', filters.likeStatus);
  }

  if (filters.page && filters.page > 1) {
    params.set('page', String(filters.page));
  }

  return params;
}

/**
 * Convert URL search params to filter options
 */
export function paramsToFilters(params: URLSearchParams): SearchOptions {
  const filters: SearchOptions = {};

  const query = params.get('q');
  if (query) {
    filters.query = query;
  }

  const types = params.get('types');
  if (types) {
    filters.sourceTypes = types.split(',').filter(t => t.length > 0);
  }

  const topics = params.get('topics');
  if (topics) {
    filters.topics = topics.split(',').filter(t => t.length > 0);
  }

  const sources = params.get('sources');
  if (sources) {
    filters.sourceIds = sources
      .split(',')
      .filter(s => s.length > 0)
      .map(s => parseInt(s, 10))
      .filter(n => !isNaN(n));
  }

  const from = params.get('from');
  const to = params.get('to');
  if (from || to) {
    filters.dateRange = {};
    if (from) {
      // Parse as local date (YYYY-MM-DD format)
      const [year, month, day] = from.split('-').map(Number);
      filters.dateRange.start = new Date(year, month - 1, day);
    }
    if (to) {
      // Parse as local date (YYYY-MM-DD format)
      const [year, month, day] = to.split('-').map(Number);
      filters.dateRange.end = new Date(year, month - 1, day);
    }
  }

  const like = params.get('like');
  if (like && ['liked', 'disliked', 'unrated'].includes(like)) {
    filters.likeStatus = like as 'liked' | 'disliked' | 'unrated';
  }

  const page = params.get('page');
  if (page) {
    const pageNum = parseInt(page, 10);
    if (!isNaN(pageNum) && pageNum >= 1) {
      filters.page = pageNum;
    }
  }

  return filters;
}

/**
 * Check if there are any active filters
 */
export function hasActiveFilters(filters: SearchOptions): boolean {
  return !!(
    filters.query ||
    (filters.sourceTypes && filters.sourceTypes.length > 0) ||
    (filters.topics && filters.topics.length > 0) ||
    (filters.sourceIds && filters.sourceIds.length > 0) ||
    filters.dateRange?.start ||
    filters.dateRange?.end ||
    filters.likeStatus
  );
}

/**
 * Get readable filter labels for display
 */
export function getFilterLabels(filters: SearchOptions): string[] {
  const labels: string[] = [];

  if (filters.query) {
    labels.push(`Search: "${filters.query}"`);
  }

  if (filters.sourceTypes && filters.sourceTypes.length > 0) {
    const typeLabel = filters.sourceTypes.length === 1
      ? filters.sourceTypes[0]
      : `${filters.sourceTypes.length} types`;
    labels.push(`Type: ${typeLabel}`);
  }

  if (filters.topics && filters.topics.length > 0) {
    const topicLabel = filters.topics.length === 1
      ? filters.topics[0]
      : `${filters.topics.length} topics`;
    labels.push(`Topics: ${topicLabel}`);
  }

  if (filters.dateRange?.start && filters.dateRange?.end) {
    labels.push(`Dates: ${filters.dateRange.start.toLocaleDateString()} - ${filters.dateRange.end.toLocaleDateString()}`);
  } else if (filters.dateRange?.start) {
    labels.push(`From: ${filters.dateRange.start.toLocaleDateString()}`);
  } else if (filters.dateRange?.end) {
    labels.push(`Until: ${filters.dateRange.end.toLocaleDateString()}`);
  }

  if (filters.likeStatus) {
    const likeLabels: { [key: string]: string } = {
      liked: 'Liked',
      disliked: 'Disliked',
      unrated: 'Not yet rated',
    };
    labels.push(`Rating: ${likeLabels[filters.likeStatus]}`);
  }

  return labels;
}
