import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Container, Grid, Spinner, Text, Center, Flex, Heading, Badge } from '@chakra-ui/react';
import { AlertCircle, Inbox, Search, X } from 'lucide-react';
import { useItems } from '@/contexts/ItemsContext';
import { getRecentItems, searchItems } from '@/lib/items';
import { rankItems } from '@/lib/scoring';
import type { Item } from '@/lib/items';
import ItemCard from '@/components/ItemCard';
import ItemDetailModal from '@/components/ItemDetailModal';
import SearchBar from '@/components/SearchBar';
import Filters, { type FilterOptions } from '@/components/Filters';
import { paramsToFilters, filtersToParams } from '@/lib/utils/urlParams';
import { useFilterPreferences } from '@/hooks/useFilterPreferences';

export default function SearchPage() {
  const { loading: syncLoading, error: syncError, waitForSync, sourcesMap, likesMap, readsMap, refreshLikes, refreshReads } = useItems();
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { savedFilters, saveFilters } = useFilterPreferences();

  const handleItemClick = useCallback((item: Item) => {
    setSelectedItem(item);
    setModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setTimeout(() => setSelectedItem(null), 200);
  }, []);

  // Initialize filters from URL params on mount, fallback to saved preferences
  const initialFiltersFromUrl = useMemo(() => {
    const urlFilters = paramsToFilters(searchParams);
    const hasUrlFilters = urlFilters.sourceTypes || urlFilters.topics || urlFilters.sourceIds || urlFilters.dateRange;

    // If URL has filters, use them; otherwise use saved preferences
    if (hasUrlFilters) {
      return {
        sourceTypes: urlFilters.sourceTypes || [],
        topics: urlFilters.topics || [],
        sourceIds: urlFilters.sourceIds || [],
        dateRange: {
          start: urlFilters.dateRange?.start
            ? urlFilters.dateRange.start.toISOString().split('T')[0]
            : null,
          end: urlFilters.dateRange?.end
            ? urlFilters.dateRange.end.toISOString().split('T')[0]
            : null,
        },
        readStatus: 'all' as const,
      };
    } else if (savedFilters) {
      return savedFilters;
    } else {
      return {
        sourceTypes: [],
        topics: [],
        sourceIds: [],
        dateRange: { start: null, end: null },
        readStatus: 'all' as const,
      };
    }
  }, [searchParams, savedFilters]); // Include savedFilters

  const [filters, setFilters] = useState<FilterOptions>(initialFiltersFromUrl);

  // Get search query from URL
  const searchQuery = searchParams.get('q') || '';

  const handleFilterChange = useCallback((newFilters: FilterOptions) => {
    setFilters(newFilters);

    // Save to localStorage
    saveFilters(newFilters);

    // Convert FilterOptions to SearchOptions for URL params
    const searchOptions = {
      sourceTypes: newFilters.sourceTypes.length > 0 ? newFilters.sourceTypes : undefined,
      topics: newFilters.topics.length > 0 ? newFilters.topics : undefined,
      sourceIds: newFilters.sourceIds.length > 0 ? newFilters.sourceIds : undefined,
      dateRange: (newFilters.dateRange.start || newFilters.dateRange.end) ? {
        start: newFilters.dateRange.start ? new Date(newFilters.dateRange.start) : undefined,
        end: newFilters.dateRange.end ? new Date(newFilters.dateRange.end) : undefined,
      } : undefined,
    };

    // Update URL params (replace: true prevents history pollution)
    const params = filtersToParams(searchOptions);
    setSearchParams(params, { replace: true });
  }, [setSearchParams, saveFilters]);

  // Sync filters when URL changes externally (e.g., bookmark navigation)
  useEffect(() => {
    const urlFilters = paramsToFilters(searchParams);
    const newFilters = {
      sourceTypes: urlFilters.sourceTypes || [],
      topics: urlFilters.topics || [],
      sourceIds: urlFilters.sourceIds || [],
      dateRange: {
        start: urlFilters.dateRange?.start
          ? urlFilters.dateRange.start.toISOString().split('T')[0]
          : null,
        end: urlFilters.dateRange?.end
          ? urlFilters.dateRange.end.toISOString().split('T')[0]
          : null,
      },
    };
    setFilters(newFilters);
  }, [searchParams]);

  useEffect(() => {
    async function loadItems() {
      try {
        setIsLoading(true);
        setError(null);

        // Wait for sync to complete
        await waitForSync();

        // Check if filters or search query are active
        const hasActiveFilters =
          filters.sourceTypes.length > 0 ||
          filters.topics.length > 0 ||
          filters.sourceIds.length > 0 ||
          filters.dateRange.start !== null ||
          filters.dateRange.end !== null ||
          searchQuery.trim() !== '';

        let loadedItems: Item[];

        if (hasActiveFilters) {
          // Use searchItems with filters and query
          loadedItems = await searchItems(
            {
              query: searchQuery.trim() || undefined,
              sourceTypes: filters.sourceTypes.length > 0 ? filters.sourceTypes : undefined,
              topics: filters.topics.length > 0 ? filters.topics : undefined,
              sourceIds: filters.sourceIds.length > 0 ? filters.sourceIds : undefined,
              dateRange:
                filters.dateRange.start || filters.dateRange.end
                  ? {
                      start: filters.dateRange.start ? new Date(filters.dateRange.start) : undefined,
                      end: filters.dateRange.end ? new Date(filters.dateRange.end) : undefined,
                    }
                  : undefined,
              limit: 100,
              offset: 0,
            },
            'default-user'
          );
        } else {
          // Get recent items from last 30 days
          loadedItems = await getRecentItems(720, 100, 0);
        }

        // Filter by read status if needed
        let filteredItems = loadedItems;
        if (filters.readStatus === 'read') {
          filteredItems = loadedItems.filter(item => readsMap.get(item.id));
        } else if (filters.readStatus === 'unread') {
          filteredItems = loadedItems.filter(item => !readsMap.get(item.id));
        }

        // Rank items
        const ranked = rankItems(filteredItems);
        const finalItems = ranked.map(r => r.item);
        setItems(finalItems);
      } catch (err) {
        console.error('Failed to load items:', err);
        setError((err as Error)?.message ?? String(err));
      } finally {
        setIsLoading(false);
      }
    }

    loadItems();
  }, [waitForSync, filters, readsMap, searchQuery]);

  const showError = syncError || error;

  return (
    <Box minH="100vh" bg="gray.950" color="white">
      {/* Loading overlay - only for initial sync */}
      {syncLoading && (
        <Center
          position="fixed"
          inset={0}
          bg="rgba(0, 0, 0, 0.9)"
          backdropFilter="blur(4px)"
          zIndex={70}
        >
          <Flex direction="column" align="center" gap={4}>
            <Spinner size="xl" color="blue.400" borderWidth="3px" />
            <Text color="gray.300" fontSize="lg" fontWeight="medium">
              Loading AI content...
            </Text>
          </Flex>
        </Center>
      )}

      {!syncLoading && (
        <Container maxW="6xl" py={8}>
          {/* Page Header */}
          <Box mb={6}>
            <Flex align="center" gap={3} mb={2}>
              <Box
                p={2}
                bg="gray.800"
                rounded="lg"
                borderWidth="1px"
                borderColor="gray.700"
              >
                <Search size={24} color="var(--chakra-colors-blue-400)" />
              </Box>
              <Box flex={1}>
                <Heading
                  size="xl"
                  bgGradient="linear(to-r, blue.400, cyan.400)"
                  bgClip="text"
                  fontWeight="black"
                >
                  Search & Filter
                </Heading>
                {!isLoading && items.length > 0 && (
                  <Flex align="center" gap={2} mt={1}>
                    <Text color="gray.500" fontSize="sm">
                      Found
                    </Text>
                    <Badge
                      colorScheme="blue"
                      variant="subtle"
                      px={2}
                      py={0.5}
                      rounded="full"
                      fontSize="xs"
                      fontWeight="bold"
                    >
                      {items.length}
                    </Badge>
                    <Text color="gray.500" fontSize="sm">
                      items
                    </Text>
                  </Flex>
                )}
              </Box>
            </Flex>
            <Text color="gray.400" fontSize="md" mb={4}>
              Filter and explore AI content by source, topic, and date
            </Text>

            {/* Search Bar */}
            <Box mb={4}>
              <SearchBar />
            </Box>

            {/* Active Search Query Display */}
            {searchQuery && (
              <Flex
                align="center"
                gap={2}
                bg="blue.900"
                borderWidth="1px"
                borderColor="blue.700"
                rounded="lg"
                px={4}
                py={2}
                mb={4}
              >
                <Search size={16} color="var(--chakra-colors-blue-300)" />
                <Text color="blue.200" fontSize="sm" fontWeight="medium" flex={1}>
                  Searching for: <Text as="span" fontWeight="bold">"{searchQuery}"</Text>
                </Text>
                <Box
                  as="button"
                  onClick={() => {
                    const newParams = new URLSearchParams(searchParams);
                    newParams.delete('q');
                    setSearchParams(newParams);
                  }}
                  p={1}
                  rounded="md"
                  _hover={{ bg: 'blue.800' }}
                  cursor="pointer"
                >
                  <X size={16} color="var(--chakra-colors-blue-300)" />
                </Box>
              </Flex>
            )}
          </Box>

          {/* Filters */}
          <Filters onFilterChange={handleFilterChange} initialFilters={filters} />

          {/* Loading indicator for filter changes */}
          {isLoading && (
            <Flex justify="center" py={12}>
              <Flex direction="column" align="center" gap={3}>
                <Spinner size="lg" color="blue.400" borderWidth="3px" />
                <Text color="gray.500" fontSize="sm">Loading items...</Text>
              </Flex>
            </Flex>
          )}

          {/* Error message */}
          {showError && !isLoading && (
            <Box
              bg="rgba(220, 38, 38, 0.1)"
              borderWidth="1px"
              borderColor="red.800"
              rounded="lg"
              p={6}
              mb={6}
            >
              <Flex gap={3} align="flex-start">
                <AlertCircle size={24} color="var(--chakra-colors-red-400)" />
                <Box>
                  <Text color="red.400" fontWeight="semibold" mb={1}>
                    Error Loading Items
                  </Text>
                  <Text color="red.300" fontSize="sm">
                    {showError}
                  </Text>
                </Box>
              </Flex>
            </Box>
          )}

          {/* Empty state */}
          {items.length === 0 && !showError && !isLoading && (
            <Box
              bg="gray.900"
              borderWidth="1px"
              borderColor="gray.700"
              rounded="lg"
              p={12}
              textAlign="center"
            >
              <Flex direction="column" align="center" gap={4}>
                <Box p={4} bg="gray.800" rounded="full">
                  <Inbox size={48} color="var(--chakra-colors-gray-500)" />
                </Box>
                <Box>
                  <Text color="gray.300" fontSize="lg" fontWeight="semibold" mb={2}>
                    No items found
                  </Text>
                  <Text color="gray.500" fontSize="sm" maxW="md">
                    Try adjusting your filters or check back later for new content
                  </Text>
                </Box>
              </Flex>
            </Box>
          )}

          {/* Items grid */}
          {items.length > 0 && !isLoading && (
            <Grid
              templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }}
              gap={6}
            >
              {items.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  sourceName={sourcesMap.get(item.sourceId) || 'Unknown'}
                  initialLiked={likesMap.get(item.id) || null}
                  isRead={readsMap.get(item.id) || false}
                  onLikeChange={refreshLikes}
                  onReadChange={refreshReads}
                  onClick={() => handleItemClick(item)}
                />
              ))}
            </Grid>
          )}
        </Container>
      )}

      {/* Item Detail Modal */}
      <ItemDetailModal
        item={selectedItem}
        sourceName={selectedItem ? sourcesMap.get(selectedItem.sourceId) || 'Unknown' : undefined}
        initialLiked={selectedItem ? likesMap.get(selectedItem.id) || null : null}
        initialRead={selectedItem ? readsMap.get(selectedItem.id) || false : false}
        open={modalOpen}
        onClose={handleModalClose}
        onLikeChange={refreshLikes}
        onReadChange={refreshReads}
      />
    </Box>
  );
}
