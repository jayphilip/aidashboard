import { Box, Container, Heading, Text, Flex, Spinner, Center, Grid } from '@chakra-ui/react';
import { Newspaper, Mail, FileText, Twitter, AlertCircle } from 'lucide-react';
import { useItems } from '@/contexts/ItemsContext';
import type { Item } from '@/lib/items';
import ItemCard from '@/components/ItemCard';

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
  const { items: allItems, loading: syncLoading, error: syncError } = useItems();

  const getItemsByType = (type: string) => {
    // Get last 30 days of items for this type
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return allItems
      .filter(item => {
        const itemDate = item.publishedAt || item.createdAt;
        return item.sourceType === type && itemDate >= thirtyDaysAgo;
      })
      .slice(0, 6);
  };

  return (
    <Box minH="100vh" bg="gray.950" color="white">
      {/* Loading overlay */}
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
        <Box>
          {/* Hero Section */}
          <Box
            bg="gray.900"
            borderBottomWidth="1px"
            borderColor="gray.800"
            py={12}
            mb={8}
          >
            <Container maxW="7xl">
              <Flex direction="column" align="center" textAlign="center" gap={4}>
                <Heading
                  size="2xl"
                  bgGradient="linear(to-r, blue.400, cyan.400, purple.400)"
                  bgClip="text"
                  fontWeight="black"
                  letterSpacing="tight"
                >
                  Today's AI Updates
                </Heading>
                <Text color="gray.400" fontSize="lg" maxW="2xl">
                  Your curated feed of the latest AI research, insights, and discussions
                </Text>
              </Flex>
            </Container>
          </Box>

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
                {CONTENT_SECTIONS.map((section) => {
                  const items = getItemsByType(section.type);
                  if (items.length === 0) return null;

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
                          <ItemCard key={item.id} item={item} />
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
      )}
    </Box>
  );
}
