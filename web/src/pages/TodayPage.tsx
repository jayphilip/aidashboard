import { useMemo, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Container, Heading, Text, Flex, Spinner, Grid, Link as ChakraLink } from '@chakra-ui/react';
import { Newspaper, Mail, FileText, Twitter, AlertCircle, ArrowRight } from 'lucide-react';
import { useItems } from '@/contexts/ItemsContext';
import ItemCard from '@/components/ItemCard';
import ItemDetailModal from '@/components/ItemDetailModal';
import type { Item } from '@/lib/items';

interface ContentSection {
  type: 'paper' | 'newsletter' | 'blog' | 'tweet';
  title: string;
  icon: any;
  gradient: string;
}

const CONTENT_SECTIONS: ContentSection[] = [
  { type: 'paper', title: 'Research Papers', icon: Newspaper, gradient: 'linear(to-r, purple.400, pink.400)' },
  { type: 'newsletter', title: 'Newsletters', icon: Mail, gradient: 'linear(to-r, green.400, teal.400)' },
  { type: 'blog', title: 'Blog Posts', icon: FileText, gradient: 'linear(to-r, orange.400, yellow.400)' },
  { type: 'tweet', title: 'Social Posts', icon: Twitter, gradient: 'linear(to-r, blue.400, cyan.400)' },
];

export default function TodayPage() {
  // Get items directly from context - already sorted by COALESCE(published_at, created_at) DESC
  const { items: allItems, loading: syncLoading, error: syncError, sourcesMap, likesMap, readsMap, refreshLikes, refreshReads } = useItems();
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Debug logging for mobile
  console.log('[TodayPage] Render:', {
    totalItems: allItems.length,
    loading: syncLoading,
    error: syncError,
    sourcesCount: sourcesMap.size,
  });

  const handleItemClick = useCallback((item: Item) => {
    setSelectedItem(item);
    setModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    // Delay clearing selected item to allow modal close animation
    setTimeout(() => setSelectedItem(null), 200);
  }, []);

  // Memoize the filtering logic to avoid recalculating on every render
  const getItemsByType = useCallback((type: string) => {
    // Get last 30 days of items for this type
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    console.log(`[TodayPage] Filtering for type "${type}":`, {
      totalItems: allItems.length,
      cutoffDate: thirtyDaysAgo.toISOString(),
      matchingType: allItems.filter(i => i.sourceType === type).length,
    });

    // Sample the first item of this type for debugging
    const sampleItem = allItems.find(i => i.sourceType === type);
    if (sampleItem) {
      const sampleDateRaw = sampleItem.publishedAt || sampleItem.createdAt;
      const sampleDate = typeof sampleDateRaw === 'string' ? new Date(sampleDateRaw) : sampleDateRaw;
      console.log(`[TodayPage] Sample ${type} item:`, {
        title: sampleItem.title.substring(0, 50),
        dateRaw: sampleDateRaw,
        dateType: typeof sampleDateRaw,
        dateParsed: sampleDate.toISOString(),
        isRecent: sampleDate >= thirtyDaysAgo,
      });
    }

    const filtered = allItems.filter(item => {
      const itemDateRaw = item.publishedAt || item.createdAt;
      // Ensure date is a Date object for comparison
      const itemDate = typeof itemDateRaw === 'string' ? new Date(itemDateRaw) : itemDateRaw;
      const matchesType = item.sourceType === type;
      const isRecent = itemDate >= thirtyDaysAgo;

      return matchesType && isRecent;
    }).slice(0, 6);

    console.log(`[TodayPage] Found ${filtered.length} items for type "${type}"`);
    return filtered;
  }, [allItems]);

  // Memoize items by section to avoid recalculating on every render
  const itemsBySection = useMemo(() => {
    return CONTENT_SECTIONS.map(section => ({
      section,
      items: getItemsByType(section.type)
    })).filter(({ items }) => items.length > 0);
  }, [getItemsByType]);

  return (
    <Box minH="100vh" bg="gray.950" color="white">
      {/* Subtle sync indicator (non-blocking) */}
      {syncLoading && (
        <Box
          position="fixed"
          top={4}
          right={4}
          bg="gray.800"
          borderWidth="1px"
          borderColor="gray.700"
          rounded="lg"
          px={4}
          py={2}
          zIndex={50}
          boxShadow="lg"
        >
          <Flex align="center" gap={2}>
            <Spinner size="sm" color="blue.400" />
            <Text color="gray.300" fontSize="sm" fontWeight="medium">
              Syncing...
            </Text>
          </Flex>
        </Box>
      )}

      <Box>

          <Container maxW="7xl" pb={12}>
            {/* Error message */}
            {syncError && (
              <Box
                bg="rgba(220, 38, 38, 0.1)"
                borderWidth="1px"
                borderColor="red.800"
                rounded="lg"
                p={6}
                mb={8}
              >
                <Flex gap={3} align="flex-start">
                  <AlertCircle size={24} color="var(--chakra-colors-red-400)" />
                  <Box>
                    <Text color="red.400" fontWeight="semibold" mb={1}>
                      Error Loading Items
                    </Text>
                    <Text color="red.300" fontSize="sm">
                      {syncError}
                    </Text>
                  </Box>
                </Flex>
              </Box>
            )}

            {/* Content Sections */}
            {!syncError && (
              <Flex direction="column" gap={12}>
                {itemsBySection.map(({ section, items }) => {
                  const Icon = section.icon;

                  return (
                    <Box key={section.type}>
                      {/* Section Header */}
                      <Flex align="center" gap={3} mb={6}>
                        <Box
                          p={2}
                          bg="gray.800"
                          rounded="lg"
                          borderWidth="1px"
                          borderColor="gray.700"
                        >
                          <Icon size={24} color="var(--chakra-colors-gray-400)" />
                        </Box>
                        <Box flex={1}>
                          <Heading
                            size="lg"
                            bgGradient={section.gradient}
                            bgClip="text"
                            fontWeight="black"
                          >
                            {section.title}
                          </Heading>
                          <Text color="gray.500" fontSize="sm">
                            {items.length} item{items.length !== 1 ? 's' : ''}
                          </Text>
                        </Box>
                      </Flex>

                      {/* "More" button - only show if we have exactly 6 items */}
                      {items.length === 6 && (
                        <Flex justify="flex-end" mb={4}>
                          <ChakraLink
                            asChild
                            display="flex"
                            alignItems="center"
                            gap={2}
                            px={4}
                            py={2}
                            fontSize="sm"
                            fontWeight="semibold"
                            color="gray.400"
                            bg="gray.800"
                            rounded="lg"
                            borderWidth="1px"
                            borderColor="gray.700"
                            _hover={{
                              bg: "gray.750",
                              color: "white",
                              borderColor: "gray.600",
                              textDecoration: "none",
                              transform: "translateX(2px)",
                            }}
                            transition="all 0.2s"
                          >
                            <Link to={`/search?types=${section.type}`}>
                              <Text>More {section.title}</Text>
                              <ArrowRight size={16} />
                            </Link>
                          </ChakraLink>
                        </Flex>
                      )}

                      {/* Items Grid */}
                      <Grid
                        templateColumns={{
                          base: '1fr',
                          md: 'repeat(2, 1fr)',
                          lg: 'repeat(3, 1fr)',
                        }}
                        gap={6}
                      >
                        {items.map((item) => (
                          <ItemCard
                            key={item.id}
                            item={item}
                            sourceName={sourcesMap.get(item.sourceId) || 'Unknown'}
                            initialLiked={likesMap.get(item.id) || null}
                            isRead={readsMap.get(item.id) || false}
                            onLikeChange={refreshLikes}
                            onClick={() => handleItemClick(item)}
                          />
                        ))}
                      </Grid>
                    </Box>
                  );
                })}

                {/* Empty state */}
                {allItems.length === 0 && (
                  <Box
                    bg="gray.900"
                    borderWidth="1px"
                    borderColor="gray.700"
                    rounded="lg"
                    p={16}
                    textAlign="center"
                  >
                    <Flex direction="column" align="center" gap={4}>
                      <Box p={5} bg="gray.800" rounded="full">
                        <Newspaper size={48} color="var(--chakra-colors-gray-500)" />
                      </Box>
                      <Box>
                        <Text color="gray.300" fontSize="lg" fontWeight="semibold" mb={2}>
                          No content yet
                        </Text>
                        <Text color="gray.500" fontSize="sm" maxW="md">
                          Run the backend ingestor to populate your feed with AI content
                        </Text>
                      </Box>
                    </Flex>
                  </Box>
                )}
              </Flex>
            )}
          </Container>
        </Box>

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
