import { useState, useEffect, useMemo } from 'react';
import { Box, Container, Flex, Text, Heading, Badge, Grid, Spinner } from '@chakra-ui/react';
import { TrendingUp, Flame, Sparkles, ArrowUp, ArrowDown } from 'lucide-react';
import { useItems } from '@/contexts/ItemsContext';
import { rankItems } from '@/lib/scoring';
import ItemCard from '@/components/ItemCard';
import HermesSummary from '@/components/HermesSummary';

interface TopicStats {
  topic: string;
  count: number;
  weeklyGrowth: number;
  avgScore: number;
}

export default function TopicsPage() {
  const { items: allItems, loading: syncLoading, sourcesMap, likesMap, readsMap, refreshLikes, refreshReads, trendReport } = useItems();
  const [topicStats, setTopicStats] = useState<TopicStats[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // Calculate topic statistics
  useEffect(() => {
    if (allItems.length === 0) return;

    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

    // Count topics in different time windows
    const topicCounts = new Map<string, { total: number; lastWeek: number; prevWeek: number; scores: number[] }>();

    allItems.forEach(item => {
      if (!item.topics || item.topics.length === 0) return;

      const itemDate = (item.publishedAt || item.createdAt) as Date;
      const itemTime = typeof itemDate === 'string' ? new Date(itemDate).getTime() : itemDate.getTime();
      const isLastWeek = itemTime >= oneWeekAgo;
      const isPrevWeek = itemTime >= twoWeeksAgo && itemTime < oneWeekAgo;

      // Get item score from ranking
      const ranked = rankItems([item]);
      const score = ranked.length > 0 ? ranked[0].score : 0;

      item.topics.forEach(topic => {
        if (!topicCounts.has(topic)) {
          topicCounts.set(topic, { total: 0, lastWeek: 0, prevWeek: 0, scores: [] });
        }
        const stats = topicCounts.get(topic)!;
        stats.total += 1;
        stats.scores.push(score);
        if (isLastWeek) stats.lastWeek += 1;
        if (isPrevWeek) stats.prevWeek += 1;
      });
    });

    // Calculate growth and average scores
    const stats: TopicStats[] = Array.from(topicCounts.entries()).map(([topic, data]) => {
      const weeklyGrowth = data.prevWeek > 0
        ? ((data.lastWeek - data.prevWeek) / data.prevWeek) * 100
        : data.lastWeek > 0 ? 100 : 0;

      const avgScore = data.scores.length > 0
        ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
        : 0;

      return {
        topic,
        count: data.total,
        weeklyGrowth,
        avgScore,
      };
    });

    setTopicStats(stats);
  }, [allItems]);

  // Get top trending topics (by frequency)
  const trendingTopics = useMemo(() => {
    return [...topicStats]
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [topicStats]);

  // Get rising topics (by growth rate)
  const risingTopics = useMemo(() => {
    return [...topicStats]
      .filter(t => t.weeklyGrowth > 0 && t.count >= 3)
      .sort((a, b) => b.weeklyGrowth - a.weeklyGrowth)
      .slice(0, 12);
  }, [topicStats]);

  // Get hot topics (by engagement score)
  const hotTopics = useMemo(() => {
    return [...topicStats]
      .filter(t => t.count >= 3)
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 12);
  }, [topicStats]);

  // Get top items by score
  const topItems = useMemo(() => {
    if (selectedTopic) {
      // Filter by selected topic
      const filtered = allItems.filter(item =>
        item.topics && item.topics.includes(selectedTopic)
      );
      const ranked = rankItems(filtered);
      return ranked.slice(0, 6).map(r => r.item);
    } else {
      // Show overall top items
      const ranked = rankItems(allItems);
      return ranked.slice(0, 6).map(r => r.item);
    }
  }, [allItems, selectedTopic]);

  if (syncLoading) {
    return (
      <Container maxW="7xl" py={12}>
        <Flex justify="center" align="center" minH="400px">
          <Flex direction="column" align="center" gap={4}>
            <Spinner size="xl" color="green.400" borderWidth="3px" />
            <Text color="gray.400">Loading trends data...</Text>
          </Flex>
        </Flex>
      </Container>
    );
  }

  if (allItems.length === 0) {
    return (
      <Container maxW="6xl" py={12}>
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
              <TrendingUp size={48} color="var(--chakra-colors-gray-500)" />
            </Box>
            <Text color="gray.300" fontSize="lg" fontWeight="semibold">
              No trends data yet
            </Text>
            <Text color="gray.500" fontSize="sm" maxW="md">
              Run the backend ingestor to populate your feed with AI content
            </Text>
          </Flex>
        </Box>
      </Container>
    );
  }

  return (
    <Box minH="100vh" bg="gray.950" color="white">
      <Container maxW="7xl" py={8}>
        {/* Header */}
        <Box mb={8}>
          <Flex align="center" gap={3} mb={2}>
            <Box
              p={2}
              bg="gray.800"
              rounded="lg"
              borderWidth="1px"
              borderColor="gray.700"
            >
              <TrendingUp size={24} color="var(--chakra-colors-green-400)" />
            </Box>
            <Heading
              size="xl"
              bgGradient="linear(to-r, green.400, teal.400)"
              bgClip="text"
              fontWeight="black"
            >
              Trends & Analytics
            </Heading>
          </Flex>
          <Text color="gray.400" fontSize="md">
            Discover trending AI topics, popular research areas, and emerging themes
          </Text>
        </Box>

        {/* Hermes summary (synced from the ingestor) */}
        {trendReport && <HermesSummary report={trendReport} />}

        {/* Active Topic Filter */}
        {selectedTopic && (
          <Flex
            align="center"
            gap={3}
            bg="green.900"
            borderWidth="1px"
            borderColor="green.700"
            rounded="lg"
            px={4}
            py={2}
            mb={6}
          >
            <Text color="green.200" fontSize="sm" fontWeight="medium" flex={1}>
              Viewing topic: <Text as="span" fontWeight="bold">"{selectedTopic}"</Text>
            </Text>
            <Box
              as="button"
              onClick={() => setSelectedTopic(null)}
              px={3}
              py={1}
              bg="green.800"
              rounded="md"
              fontSize="xs"
              fontWeight="semibold"
              color="green.200"
              _hover={{ bg: 'green.700' }}
              cursor="pointer"
            >
              Clear filter
            </Box>
          </Flex>
        )}

        {/* Trending Topics */}
        <Box mb={8}>
          <Flex align="center" gap={2} mb={4}>
            <TrendingUp size={20} color="var(--chakra-colors-blue-400)" />
            <Heading size="lg" color="white">
              Trending Topics
            </Heading>
            <Badge colorScheme="blue" ml={2}>
              Most Mentioned
            </Badge>
          </Flex>
          <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }} gap={3}>
            {trendingTopics.map((stat) => (
              <Box
                key={stat.topic}
                as="button"
                onClick={() => setSelectedTopic(stat.topic)}
                bg={selectedTopic === stat.topic ? 'blue.900' : 'gray.800'}
                borderWidth="1px"
                borderColor={selectedTopic === stat.topic ? 'blue.700' : 'gray.700'}
                rounded="lg"
                p={4}
                textAlign="left"
                transition="all 0.2s"
                _hover={{
                  borderColor: 'blue.600',
                  transform: 'translateY(-2px)',
                  shadow: 'lg',
                }}
              >
                <Flex justify="space-between" align="start" mb={2}>
                  <Text fontSize="sm" fontWeight="bold" color="white" flex={1} css={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {stat.topic}
                  </Text>
                  <Badge colorScheme="blue" fontSize="2xs" ml={2}>
                    {stat.count}
                  </Badge>
                </Flex>
                <Flex align="center" gap={1}>
                  {stat.weeklyGrowth > 0 ? (
                    <>
                      <ArrowUp size={12} color="var(--chakra-colors-green-400)" />
                      <Text fontSize="xs" color="green.400" fontWeight="semibold">
                        +{stat.weeklyGrowth.toFixed(0)}%
                      </Text>
                    </>
                  ) : stat.weeklyGrowth < 0 ? (
                    <>
                      <ArrowDown size={12} color="var(--chakra-colors-red-400)" />
                      <Text fontSize="xs" color="red.400" fontWeight="semibold">
                        {stat.weeklyGrowth.toFixed(0)}%
                      </Text>
                    </>
                  ) : (
                    <Text fontSize="xs" color="gray.500">
                      No change
                    </Text>
                  )}
                </Flex>
              </Box>
            ))}
          </Grid>
        </Box>

        {/* Rising Topics */}
        {risingTopics.length > 0 && (
          <Box mb={8}>
            <Flex align="center" gap={2} mb={4}>
              <Sparkles size={20} color="var(--chakra-colors-purple-400)" />
              <Heading size="lg" color="white">
                Rising Topics
              </Heading>
              <Badge colorScheme="purple" ml={2}>
                Fastest Growing
              </Badge>
            </Flex>
            <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }} gap={3}>
              {risingTopics.map((stat) => (
                <Box
                  key={stat.topic}
                  as="button"
                  onClick={() => setSelectedTopic(stat.topic)}
                  bg={selectedTopic === stat.topic ? 'purple.900' : 'gray.800'}
                  borderWidth="1px"
                  borderColor={selectedTopic === stat.topic ? 'purple.700' : 'gray.700'}
                  rounded="lg"
                  p={4}
                  textAlign="left"
                  transition="all 0.2s"
                  _hover={{
                    borderColor: 'purple.600',
                    transform: 'translateY(-2px)',
                    shadow: 'lg',
                  }}
                >
                  <Flex justify="space-between" align="start" mb={2}>
                    <Text fontSize="sm" fontWeight="bold" color="white" flex={1} css={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {stat.topic}
                    </Text>
                    <Badge colorScheme="purple" fontSize="2xs" ml={2}>
                      {stat.count}
                    </Badge>
                  </Flex>
                  <Flex align="center" gap={1}>
                    <ArrowUp size={12} color="var(--chakra-colors-green-400)" />
                    <Text fontSize="xs" color="green.400" fontWeight="bold">
                      +{stat.weeklyGrowth.toFixed(0)}%
                    </Text>
                    <Text fontSize="xs" color="gray.500" ml={1}>
                      this week
                    </Text>
                  </Flex>
                </Box>
              ))}
            </Grid>
          </Box>
        )}

        {/* Hot Topics (by engagement) */}
        {hotTopics.length > 0 && (
          <Box mb={8}>
            <Flex align="center" gap={2} mb={4}>
              <Flame size={20} color="var(--chakra-colors-orange-400)" />
              <Heading size="lg" color="white">
                Hot Topics
              </Heading>
              <Badge colorScheme="orange" ml={2}>
                High Engagement
              </Badge>
            </Flex>
            <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }} gap={3}>
              {hotTopics.map((stat) => (
                <Box
                  key={stat.topic}
                  as="button"
                  onClick={() => setSelectedTopic(stat.topic)}
                  bg={selectedTopic === stat.topic ? 'orange.900' : 'gray.800'}
                  borderWidth="1px"
                  borderColor={selectedTopic === stat.topic ? 'orange.700' : 'gray.700'}
                  rounded="lg"
                  p={4}
                  textAlign="left"
                  transition="all 0.2s"
                  _hover={{
                    borderColor: 'orange.600',
                    transform: 'translateY(-2px)',
                    shadow: 'lg',
                  }}
                >
                  <Flex justify="space-between" align="start" mb={2}>
                    <Text fontSize="sm" fontWeight="bold" color="white" flex={1} css={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {stat.topic}
                    </Text>
                    <Badge colorScheme="orange" fontSize="2xs" ml={2}>
                      {stat.count}
                    </Badge>
                  </Flex>
                  <Flex align="center" gap={1}>
                    <Flame size={12} color="var(--chakra-colors-orange-400)" />
                    <Text fontSize="xs" color="orange.400" fontWeight="semibold">
                      {stat.avgScore.toFixed(2)} score
                    </Text>
                  </Flex>
                </Box>
              ))}
            </Grid>
          </Box>
        )}

        {/* Top Items */}
        <Box>
          <Flex align="center" gap={2} mb={4}>
            <Heading size="lg" color="white">
              {selectedTopic ? `Top Items: ${selectedTopic}` : 'Top Items Overall'}
            </Heading>
            <Badge colorScheme="green">
              {topItems.length}
            </Badge>
          </Flex>
          <Grid
            templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }}
            gap={6}
          >
            {topItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                sourceName={sourcesMap.get(item.sourceId) || 'Unknown'}
                initialLiked={likesMap.get(item.id) || null}
                isRead={readsMap.get(item.id) || false}
                onLikeChange={refreshLikes}
                onReadChange={refreshReads}
              />
            ))}
          </Grid>
        </Box>
      </Container>
    </Box>
  );
}
