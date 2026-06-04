import { useState, memo } from 'react';
import { Box, Flex, Text, Button, Badge, HStack } from '@chakra-ui/react';
import { getDb } from '@/lib/db';
import { itemLikes } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { useUser } from '@/contexts/UserContext';
import { formatDate, excerpt } from '@/utils/formatting';
import { logger } from '@/utils/logger';
import { ExternalLink, Heart, X } from 'lucide-react';
import type { Item } from '@/lib/items';

interface CardOption1Props {
  item: Item;
  sourceName?: string;
  initialLiked?: number | null;
  onLikeChange?: () => void;
}

function getSourceTypeLabel(sourceType: string): string {
  switch (sourceType) {
    case 'paper': return 'Paper';
    case 'tweet': return 'Social';
    case 'blog': return 'Blog';
    case 'newsletter': return 'Newsletter';
    default: return 'Other';
  }
}

function getSourceTypeColor(sourceType: string): string {
  switch (sourceType) {
    case 'paper': return 'purple';
    case 'tweet': return 'blue';
    case 'blog': return 'orange';
    case 'newsletter': return 'green';
    default: return 'gray';
  }
}

const CardOption1 = memo(function CardOption1({ item, initialLiked = null, onLikeChange }: CardOption1Props) {
  const { userId } = useUser();
  const [liked, setLiked] = useState<number | null>(initialLiked);
  const [loading, setLoading] = useState(false);

  async function toggleLike(score: number) {
    if (loading) return;
    setLoading(true);

    try {
      const db = await getDb();
      const existing = await db
        .select()
        .from(itemLikes)
        .where(and(eq(itemLikes.itemId, item.id), eq(itemLikes.userId, userId)))
        .limit(1);

      if (existing.length > 0) {
        if (existing[0].score === score) {
          await db.delete(itemLikes).where(and(eq(itemLikes.itemId, item.id), eq(itemLikes.userId, userId)));
          setLiked(null);
        } else {
          await db.update(itemLikes).set({ score, createdAt: new Date() }).where(and(eq(itemLikes.itemId, item.id), eq(itemLikes.userId, userId)));
          setLiked(score);
        }
      } else {
        await db.insert(itemLikes).values({ userId, itemId: item.id, score, createdAt: new Date() } as any);
        setLiked(score);
      }
      if (onLikeChange) onLikeChange();
    } catch (err) {
      logger.error('Failed to toggle like:', err);
    } finally {
      setLoading(false);
    }
  }

  const sourceTypeColor = getSourceTypeColor(item.sourceType);

  return (
    <Box
      bg="white"
      bgGradient="linear(to-br, gray.50, white)"
      borderWidth="1px"
      borderColor="gray.200"
      rounded="xl"
      overflow="hidden"
      transition="all 0.3s ease"
      _hover={{
        borderColor: 'gray.300',
        shadow: '2xl',
        transform: 'translateY(-4px)',
      }}
      h="full"
      display="flex"
      flexDirection="column"
    >
      {/* Header - Clean & Minimal */}
      <Box p={4}>
        <HStack mb={2} gap={1.5}>
          <Badge
            colorScheme={sourceTypeColor}
            fontSize="2xs"
            px={2}
            py={0.5}
            rounded="full"
            fontWeight="semibold"
            textTransform="uppercase"
          >
            {getSourceTypeLabel(item.sourceType)}
          </Badge>
          <Text fontSize="2xs" color="gray.500" ml="auto">
            {formatDate(item.publishedAt)}
          </Text>
        </HStack>

        <Text
          fontSize="md"
          fontWeight="700"
          lineHeight="1.3"
          color="gray.900"
          mb={2}
          lineClamp={2}
        >
          {item.title}
        </Text>

        {item.summary && (
          <Text fontSize="xs" lineHeight="1.5" color="gray.600" mb={3} lineClamp={3}>
            {excerpt(item.summary, 100)}
          </Text>
        )}

        {/* Topics */}
        {item.topics && item.topics.length > 0 && (
          <Flex gap={1} flexWrap="wrap" mb={3}>
            {item.topics.slice(0, 3).map(topic => (
              <Badge
                key={topic}
                bg="gray.100"
                color="gray.700"
                fontSize="2xs"
                px={2}
                py={0.5}
                rounded="md"
                fontWeight="medium"
              >
                {topic}
              </Badge>
            ))}
          </Flex>
        )}

        {/* Footer - Compact Buttons */}
        <Flex gap={1.5}>
          <Button
            size="xs"
            onClick={() => toggleLike(1)}
            loading={loading}
            variant={liked === 1 ? 'solid' : 'ghost'}
            colorScheme={liked === 1 ? 'green' : 'gray'}
            flex={1}
          >
            <Heart size={12} fill={liked === 1 ? 'currentColor' : 'none'} />
          </Button>
          <Button
            size="xs"
            onClick={() => toggleLike(-1)}
            loading={loading}
            variant={liked === -1 ? 'solid' : 'ghost'}
            colorScheme={liked === -1 ? 'red' : 'gray'}
            flex={1}
          >
            <X size={12} />
          </Button>
          <Button
            size="xs"
            onClick={() => window.open(item.url, '_blank')}
            colorScheme="blue"
            flex={1}
          >
            <ExternalLink size={12} />
          </Button>
        </Flex>
      </Box>
    </Box>
  );
});

export default CardOption1;
