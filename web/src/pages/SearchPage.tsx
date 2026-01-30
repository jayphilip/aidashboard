import { useState, useEffect, useCallback } from 'react';
import { Box, Container, Grid, Spinner, Text, Center, Flex, Heading, Badge } from '@chakra-ui/react';
import { AlertCircle, Inbox, Search } from 'lucide-react';
import { useItems } from '@/contexts/ItemsContext';
import { getRecentItems, searchItems } from '@/lib/items';
import { rankItems } from '@/lib/scoring';
import type { Item } from '@/lib/items';
import ItemCard from '@/components/ItemCard';
import Filters, { type FilterOptions } from '@/components/Filters';

export default function SearchPage() {
  const { loading: syncLoading, error: syncError, waitForSync } = useItems();
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    sourceTypes: [],
    topics: [],
    dateRange: { start: null, end: null },
  });

  const handleFilterChange = useCallback((newFilters: FilterOptions) => {
    setFilters(newFilters);
  }, []);

  useEffect(() => {
    async function loadItems() {
      try {
        setIsLoading(true);
        setError(null);

        // Wait for sync to complete
        await waitForSync();

        // Check if filters are active
        const hasActiveFilters =
          filters.sourceTypes.length > 0 ||
          filters.topics.length > 0 ||
          filters.dateRange.start !== null ||
          filters.dateRange.end !== null;

        let loadedItems: Item[];

        if (hasActiveFilters) {
          // Use searchItems with filters
          loadedItems = await searchItems(
            {
              sourceTypes: filters.sourceTypes.length > 0 ? filters.sourceTypes : undefined,
              topics: filters.topics.length > 0 ? filters.topics : undefined,
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

        // Rank items
        const ranked = rankItems(loadedItems);
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
  }, [waitForSync, filters]);

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
            <Spinner size="xl" color="blue.400" borderWidth="3px" speed="0.8s" />
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
            <Text color="gray.400" fontSize="md">
              Filter and explore AI content by source, topic, and date
            </Text>
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
                <ItemCard key={item.id} item={item} />
              ))}
            </Grid>
          )}
        </Container>
      )}
    </Box>
  );
}
