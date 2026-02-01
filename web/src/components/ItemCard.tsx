import { useState, useEffect } from 'react';
import { Box, Flex, Text, Button, Badge } from '@chakra-ui/react';
import { getDb } from '@/lib/db';
import { itemLikes } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { useUser } from '@/contexts/UserContext';
import { getSourceNameById } from '@/lib/sources';
import { formatDate, excerpt } from '@/utils/formatting';
import { logger } from '@/utils/logger';
import { ExternalLink, ThumbsUp, ThumbsDown } from 'lucide-react';
import type { Item } from '@/lib/items';

interface ItemCardProps {
  item: Item;
}

function getSourceIcon(sourceType: string): string {
  switch (sourceType) {
    case 'paper':
      return '📄';
    case 'newsletter':
      return '📧';
    case 'blog':
      return '✍️';
    case 'tweet':
      return '🐦';
    default:
      return '📌';
  }
}

function getSourceTypeLabel(sourceType: string): string {
  switch (sourceType) {
    case 'paper':
      return 'Paper';
    case 'tweet':
      return 'Social';
    case 'blog':
      return 'Blog';
    case 'newsletter':
      return 'Newsletter';
    default:
      return 'Other';
  }
}

function getSourceTypeColor(sourceType: string): string {
  switch (sourceType) {
    case 'paper':
      return 'purple';
    case 'tweet':
      return 'blue';
    case 'blog':
      return 'orange';
    case 'newsletter':
      return 'green';
    default:
      return 'gray';
  }
}

export default function ItemCard({ item }: ItemCardProps) {
  const { userId } = useUser();
  const [liked, setLiked] = useState<number | null>(null);
  const [sourceName, setSourceName] = useState('Unknown');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadCardData() {
      try {
        // Get source name
        const name = await getSourceNameById(item.sourceId);
        setSourceName(name);

        // Get like status
        const db = await getDb();
        const result = await db
          .select()
          .from(itemLikes)
          .where(and(
            eq(itemLikes.itemId, item.id),
            eq(itemLikes.userId, userId)
          ))
          .limit(1);

        if (result.length > 0) {
          setLiked(result[0].score);
        }
      } catch (err) {
        logger.error('Failed to load card data:', err);
      }
    }

    loadCardData();
  }, [item.id, item.sourceId, userId]);

  async function toggleLike(score: number) {
    if (loading) return;
    setLoading(true);

    try {
      const db = await getDb();

      // Check if like exists
      const existing = await db
        .select()
        .from(itemLikes)
        .where(and(
          eq(itemLikes.itemId, item.id),
          eq(itemLikes.userId, userId)
        ))
        .limit(1);

      if (existing.length > 0) {
        // Update or delete
        if (existing[0].score === score) {
          // Delete if same score clicked again (toggle off)
          await db
            .delete(itemLikes)
            .where(and(
              eq(itemLikes.itemId, item.id),
              eq(itemLikes.userId, userId)
            ));
          setLiked(null);
        } else {
          // Update
          await db
            .update(itemLikes)
            .set({ score, createdAt: new Date() })
            .where(and(
              eq(itemLikes.itemId, item.id),
              eq(itemLikes.userId, userId)
            ));
          setLiked(score);
        }
      } else {
        // Insert
        await db.insert(itemLikes).values({
          userId,
          itemId: item.id,
          score,
          createdAt: new Date(),
        } as any);
        setLiked(score);
      }
    } catch (err) {
      logger.error('Failed to toggle like:', err);
    } finally {
      setLoading(false);
    }
  }

  const categories = item.rawMetadata?.categories;
  const sourceTypeColor = getSourceTypeColor(item.sourceType);

  return (
    <Box
      bg="gray.800"
      borderWidth="1px"
      borderColor="gray.700"
      rounded="lg"
      overflow="hidden"
      transition="all 0.2s"
      _hover={{
        borderColor: 'gray.600',
        shadow: 'lg',
        transform: 'translateY(-2px)',
      }}
      h="full"
      display="flex"
      flexDirection="column"
    >
      {/* Header */}
      <Box p={4} borderBottomWidth="1px" borderColor="gray.700">
        <Flex align="flex-start" gap={3} mb={2}>
          <Text
            fontSize="md"
            fontWeight="bold"
            lineHeight="1.4"
            color="gray.50"
            flex={1}
            minW={0}
          >
            {item.title}
          </Text>
        </Flex>

        <Flex align="center" gap={2} wrap="wrap">
          <Badge
            colorScheme={sourceTypeColor}
            variant="subtle"
            fontSize="xs"
            px={2}
            py={0.5}
            rounded="md"
            fontWeight="semibold"
          >
            {getSourceIcon(item.sourceType)} {getSourceTypeLabel(item.sourceType)}
          </Badge>
          {categories && categories.length > 0 && (
            <Badge
              fontSize="xs"
              px={2}
              py={0.5}
              rounded="md"
              bg="gray.700"
              color="gray.300"
              borderWidth="1px"
              borderColor="gray.600"
            >
              {categories[0]}
            </Badge>
          )}
          <Text fontSize="xs" color="gray.500" ml="auto">
            {formatDate(item.publishedAt)}
          </Text>
        </Flex>
      </Box>

      {/* Body */}
      <Box p={4} flex={1}>
        <Text fontSize="xs" color="gray.500" mb={2} fontWeight="medium">
          {sourceName}
        </Text>

        {/* Summary */}
        {item.summary && (
          <Text fontSize="sm" lineHeight="1.6" color="gray.300" mb={3}>
            {excerpt(item.summary, 150)}
          </Text>
        )}

        {/* Topics */}
        {item.topics && item.topics.length > 0 && (
          <Flex gap={1.5} flexWrap="wrap">
            {item.topics.map(topic => (
              <Badge
                key={topic}
                colorScheme="purple"
                variant="subtle"
                fontSize="xs"
                px={2}
                py={0.5}
                rounded="md"
              >
                {topic}
              </Badge>
            ))}
          </Flex>
        )}
      </Box>

      {/* Footer */}
      <Box p={4} pt={3} borderTopWidth="1px" borderColor="gray.700" bg="gray.850">
        <Flex justify="space-between" align="center" gap={2}>
          <Flex gap={1.5}>
            <Button
              size="sm"
              onClick={() => toggleLike(1)}
              isLoading={loading}
              minW="60px"
              title={liked === 1 ? "Remove like" : "Like this"}
              bg={liked === 1 ? 'green.600' : 'transparent'}
              color={liked === 1 ? 'white' : 'green.400'}
              borderWidth="1px"
              borderColor={liked === 1 ? 'green.600' : 'green.700'}
              _hover={{
                bg: liked === 1 ? 'green.500' : 'green.900',
                borderColor: liked === 1 ? 'green.500' : 'green.600',
              }}
            >
              <Flex gap={1.5} align="center">
                <ThumbsUp size={14} />
                <Text fontSize="xs">Like</Text>
              </Flex>
            </Button>
            <Button
              size="sm"
              onClick={() => toggleLike(-1)}
              isLoading={loading}
              minW="70px"
              title={liked === -1 ? "Remove dislike" : "Dislike this"}
              bg={liked === -1 ? 'red.600' : 'transparent'}
              color={liked === -1 ? 'white' : 'red.400'}
              borderWidth="1px"
              borderColor={liked === -1 ? 'red.600' : 'red.700'}
              _hover={{
                bg: liked === -1 ? 'red.500' : 'red.900',
                borderColor: liked === -1 ? 'red.500' : 'red.600',
              }}
            >
              <Flex gap={1.5} align="center">
                <ThumbsDown size={14} />
                <Text fontSize="xs">Dislike</Text>
              </Flex>
            </Button>
          </Flex>
          <Button
            size="sm"
            onClick={() => window.open(item.url, '_blank')}
            title="Open in new tab"
            bg="blue.600"
            color="white"
            _hover={{ bg: 'blue.500' }}
          >
            <Flex gap={1.5} align="center">
              <Text fontSize="xs">Open</Text>
              <ExternalLink size={14} />
            </Flex>
          </Button>
        </Flex>
      </Box>
    </Box>
  );
}
