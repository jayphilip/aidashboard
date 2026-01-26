# Phase 6 – UX Enhancements: Search, Filters & Advanced Features

This phase enhances the user experience with powerful discovery, filtering, and personalization features that turn the dashboard into a true research tool.

## 17. Full-text search across items

**Goal:** Enable users to quickly find specific papers, newsletters, or topics by searching titles, summaries, and content.

**Tasks:**

- **Backend (TypeScript):**
  - Add a search utility function `searchItems(query: string, options?: SearchOptions)` in [web/src/lib/stores/items.ts](web/src/lib/stores/items.ts)
  - Options should include:
    - `sourceTypes: string[]` - filter by paper/newsletter/blog/tweet
    - `dateRange: { start?: Date, end?: Date }` - filter by published date
    - `topics: string[]` - filter by topic tags
  - Use SQL `LIKE` or `ILIKE` for case-insensitive matching across `title`, `summary`, and `body` fields
  - For better performance, consider adding a GIN index on text columns in Postgres
  - Return results ranked by relevance (exact title matches first, then summary matches)

- **Frontend:**
  - Add a global search bar to the navigation header ([Navigation.svelte](web/src/lib/components/Navigation.svelte))
  - Create a new `/search` page ([web/src/routes/search/+page.svelte](web/src/routes/search/+page.svelte))
  - Show search results in a unified list with:
    - Highlighting of matched terms
    - Filter sidebar for source type, date range, topics
    - Result count and search metadata
  - Add keyboard shortcut (Cmd/Ctrl+K) to focus search bar

## 18. Advanced filtering system

**Goal:** Allow users to drill down into content by combining multiple filters.

**Tasks:**

- **Create reusable filter components:**
  - `FilterPanel.svelte` - container for all filters
  - `SourceTypeFilter.svelte` - checkboxes for paper/newsletter/blog/tweet
  - `DateRangeFilter.svelte` - presets (Today, This Week, This Month) + custom date picker
  - `TopicFilter.svelte` - multi-select dropdown or tag cloud of available topics
  - `SourceFilter.svelte` - filter by specific sources (e.g., specific RSS feeds)

- **Add filters to main views:**
  - Update [/today](web/src/routes/today/+page.svelte) with collapsible filter panel
  - Add filter persistence to URL query params for shareable views
  - Show active filters as dismissible tags/chips
  - Add "Clear all filters" button

- **Enhance topics page:**
  - Currently has basic time range + media type filters
  - Add search box to filter topics by name
  - Add minimum item count threshold slider
  - Add sorting options (alphabetical, by count, by growth rate)

## 19. Sorting and view options

**Goal:** Give users control over how content is organized.

**Tasks:**

- **Add sorting options to item lists:**
  - Most Recent (default)
  - Most Liked (by user or community if multi-user later)
  - Relevance Score (using existing `rankItems` function)
  - Alphabetical by Title
  - By Source Name

- **View density controls:**
  - Compact view (smaller cards, no abstracts)
  - Comfortable view (current default)
  - Detailed view (full abstracts, more metadata)
  - Store preference in localStorage

- **List vs Grid toggle:**
  - Current implementation uses grid on [/today](web/src/routes/today/+page.svelte)
  - Add option to view as single-column list for easier reading

## 20. Reading list & bookmarks

**Goal:** Let users save items for later reading.

**Tasks:**

- **Database schema:**
  - Add `item_bookmarks` table (similar to `item_likes`):
    - `id` (UUID PK)
    - `user_id` (text)
    - `item_id` (FK → items.id)
    - `created_at` (timestamptz)
    - `notes` (text, nullable) - optional user notes
    - `read` (boolean, default false) - mark as read

- **Backend (Rust):**
  - Add migration for `item_bookmarks` table
  - Add to Electric replication config

- **Frontend:**
  - Add bookmark button (⭐) to [ItemCard.svelte](web/src/lib/components/ItemCard.svelte)
  - Create new `/reading-list` page showing bookmarked items
  - Organize by:
    - Unread / Read tabs
    - Option to add notes to bookmarks
    - Bulk actions (mark all as read, remove selected)
  - Add quick "Mark as Read" action that removes from main views

## 21. Item detail view with related content

**Goal:** Provide a focused reading experience with context and recommendations.

**Tasks:**

- **Create new route:** `/item/[id]` ([web/src/routes/item/[id]/+page.svelte](web/src/routes/item/[id]/+page.svelte))

- **Detail page should show:**
  - Full title, source, published date
  - Complete summary/abstract (not truncated)
  - Full body content if available (for newsletters/blogs)
  - All topic tags (clickable to filter by topic)
  - Metadata from `raw_metadata`:
    - For papers: arXiv ID, categories, authors, versions
    - For RSS: author, original feed info
  - Action buttons: Open, Like/Dislike, Bookmark, Share

- **Related items section:**
  - "Similar topics" - query `getItemsWithTopics()` with shared topics
  - "From same source" - other recent items from same source
  - Limit to 5-10 related items

- **Navigation:**
  - Previous/Next buttons to navigate through filtered list
  - Back to list button preserving filters

## 22. Responsive mobile experience

**Goal:** Make the dashboard fully usable on mobile devices.

**Tasks:**

- **Layout improvements:**
  - Convert 3-column grid on [/today](web/src/routes/today/+page.svelte) to tabs on mobile
  - Use horizontal swipe gestures to switch between Papers/Newsletters/Social
  - Collapsible filter panels (hidden by default on mobile)
  - Bottom navigation bar for mobile (Today / Topics / Sources / Reading List)

- **Touch interactions:**
  - Swipe actions on cards (swipe right to bookmark, swipe left to dismiss)
  - Pull-to-refresh for manual sync trigger
  - Tap-and-hold for quick actions menu

- **Performance:**
  - Virtual scrolling for long lists (100+ items)
  - Lazy load images if adding thumbnails later
  - Reduce initial data load on mobile (last 24h instead of 7 days)

## 23. Keyboard shortcuts & accessibility

**Goal:** Power user features and full accessibility support.

**Tasks:**

- **Keyboard shortcuts:**
  - `Cmd/Ctrl+K` - Focus search
  - `j/k` - Navigate items (vim-style)
  - `o` - Open current item in new tab
  - `l` - Like current item
  - `b` - Bookmark current item
  - `r` - Refresh / sync data
  - `f` - Toggle filters panel
  - `1/2/3` - Switch to Papers/Newsletters/Social tab
  - `?` - Show keyboard shortcuts help

- **Create shortcuts help modal:**
  - Component: `KeyboardShortcutsModal.svelte`
  - Triggered by `?` key or help button in nav
  - Shows all shortcuts organized by category

- **Accessibility improvements:**
  - Add ARIA labels to all interactive elements
  - Ensure full keyboard navigation (tab order)
  - Add skip-to-content link
  - Proper focus management in modals
  - Screen reader announcements for dynamic content updates
  - High contrast mode support

## 24. Pagination & infinite scroll

**Goal:** Handle large datasets efficiently.

**Tasks:**

- **Backend (TypeScript):**
  - Add pagination parameters to `getRecentItems()` and search functions:
    - `limit: number` (default 50)
    - `offset: number` (default 0)
  - Return total count alongside results

- **Frontend - Infinite scroll:**
  - Implement intersection observer in list components
  - Load next page when user scrolls to bottom
  - Show loading indicator while fetching
  - Add "Back to top" button when scrolled down

- **Pagination controls (alternative):**
  - Add pagination UI as alternative to infinite scroll
  - User preference in settings
  - Show "Page 1 of 10" style navigation

## 25. User preferences & settings

**Goal:** Persistent user customization.

**Tasks:**

- **Create `/settings` page:**
  - Settings stored in localStorage (or later in DB for sync)
  - Organize into sections:

- **Display preferences:**
  - Theme: Dark (default) / Light / Auto
  - View density: Compact / Comfortable / Detailed
  - Default sorting: Most Recent / Most Liked / Relevance
  - Items per page: 25 / 50 / 100
  - Infinite scroll: On / Off

- **Content preferences:**
  - Default time range for [/today](web/src/routes/today/+page.svelte): 24h / 48h / 7 days
  - Hidden sources (exclude specific sources from views)
  - Favorite topics (pin to top of topic list)
  - Minimum score threshold (hide low-scored items)

- **Sync preferences:**
  - Auto-refresh interval: 5min / 15min / 30min / Off
  - Sync on app focus: On / Off
  - Background sync: On / Off

## 26. Advanced topic management

**Goal:** Enhanced topic discovery and organization.

**Tasks:**

- **Topic page enhancements ([/topics](web/src/routes/topics/+page.svelte)):**
  - Add search bar to filter topics by name
  - Add "pin" functionality for favorite topics
  - Show trending topics (highest growth rate this week)
  - Click topic name to see all items with that topic
  - Add topic descriptions (stored in new `topics` table)

- **Topic detail page:** `/topics/[name]`
  - List all items tagged with this topic
  - Show weekly trend chart
  - Option to follow/unfollow topic (affects scoring)
  - Related topics (frequently co-occurring topics)

- **Topic management:**
  - Merge similar topics (admin feature)
  - Rename topics (admin feature)
  - Hide/ignore topics (user preference)

## 27. Performance optimizations

**Goal:** Ensure smooth experience with growing data.

**Tasks:**

- **Query optimization:**
  - Add indexes to frequently filtered columns:
    - `items(source_type, published_at)`
    - `items(published_at DESC)` for recency sorts
    - `item_topics(topic, item_id)`
    - Full-text search index on `items(title, summary)`

- **Frontend optimization:**
  - Implement virtual scrolling for lists >100 items
  - Debounce search input (300ms)
  - Memoize expensive computations (scoring, filtering)
  - Lazy load components below fold
  - Use Svelte's built-in transitions sparingly

- **Data management:**
  - Archive items older than 6 months (keep in DB, exclude from default sync)
  - Add "Load older items" button instead of syncing everything
  - Implement smart sync: only sync sources user interacts with

## 28. Empty states & onboarding

**Goal:** Great first-run experience.

**Tasks:**

- **Empty state components:**
  - When no items match filters: helpful suggestions, "Clear filters" CTA
  - When no sources configured: link to [/sources](web/src/routes/sources/+page.svelte) with instructions
  - When no bookmarks yet: explanation of bookmarking feature
  - When search returns no results: show recent searches or suggested topics

- **Onboarding flow:**
  - First-time user welcome modal
  - Quick tour of main features (optional, dismissible)
  - Suggested sources to enable
  - Suggested topics to follow
  - Skip option with "Don't show again"

- **Loading states:**
  - Replace generic "Loading..." with skeleton screens
  - Show progress indicator during sync
  - Animated transitions between states

---

## Implementation Strategy

**Recommended order:**

1. **Start with Search (Task 17)** - most impactful feature
2. **Filters (Task 18)** - builds on search, enables power users
3. **Bookmarks/Reading List (Task 20)** - high-value, independent feature
4. **Sorting & View Options (Task 19)** - quick wins
5. **Item Detail View (Task 21)** - better reading experience
6. **Settings (Task 25)** - foundation for user preferences
7. **Keyboard Shortcuts (Task 23)** - power user feature
8. **Pagination (Task 24)** - performance improvement
9. **Mobile (Task 22)** - broader accessibility
10. **Advanced Topics (Task 26)** - deeper engagement
11. **Performance (Task 27)** - ongoing optimization
12. **Onboarding (Task 28)** - polish

**Estimated complexity:**
- Quick wins (1-2 days each): Tasks 19, 24, 28
- Medium features (3-5 days each): Tasks 17, 18, 20, 23, 25
- Larger features (5-7 days each): Tasks 21, 22, 26, 27

**Total estimated effort:** 4-6 weeks for complete Phase 6

---

## Quick Start: Highest Impact Features

If you want to implement the most valuable features first, start with these three:

### 1. Search (Task 17)
- Most requested feature for research dashboards
- Enables quick discovery of relevant content
- Foundation for other features

### 2. Bookmarks/Reading List (Task 20)
- Solves "I'll read this later" use case
- Independent feature, doesn't block others
- High user satisfaction

### 3. Filters (Task 18)
- Empowers power users
- Makes large datasets manageable
- Builds on existing UI patterns

These three features together transform the dashboard from a passive feed into an active research tool.