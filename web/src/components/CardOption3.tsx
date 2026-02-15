import { useState, memo } from 'react';
import { Box, Flex, Text, Button, Badge, Icon } from '@chakra-ui/react';
import { getDb } from '@/lib/db';
import { itemLikes } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { useUser } from '@/contexts/UserContext';
import { formatDate, excerpt } from '@/utils/formatting';
import { logger } from '@/utils/logger';
import { ExternalLink, ThumbsUp, ThumbsDown, FileText, Twitter, PenTool, Mail } from 'lucide-react';
import type { Item } from '@/lib/items';

interface CardOption3Props {
  item: Item;
  sourceName?: string;
  initialLiked?: number | null;
  onLikeChange?: () => void;
}

function getSourceIcon(sourceType: string) {
  switch (sourceType) {
    case 'paper': return FileText;
    case 'tweet': return Twitter;
    case 'blog': return PenTool;
    case 'newsletter': return Mail;
    default: return FileText;
  }
}

function getSourceColor(sourceType: string): string {
  switch (sourceType) {
    case 'paper': return 'purple.400';
    case 'tweet': return 'blue.400';
    case 'blog': return 'orange.400';
    case 'newsletter': return 'green.400';
    default: return 'gray.400';
  }
}

const CardOption3 = memo(function CardOption3({ item, sourceName = 'Unknown', initialLiked = null, onLikeChange }: CardOption3Props) {
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

  const SourceIconComponent = getSourceIcon(item.sourceType);
  const sourceColor = getSourceColor(item.sourceType);

  return (
    <Box
      bg="gray.800"
      borderWidth="1px"
      borderColor="gray.700"
      rounded="lg"
      overflow="hidden"
      transition="all 0.2s"
      _hover={{
        borderColor: sourceColor,
        shadow: 'lg',
      }}
      h="full"
      display="flex"
      flexDirection="column"
    >
      {/* Icon Header Bar */}
      <Flex
        bg="gray.850"
        borderBottomWidth="1px"
        borderColor="gray.700"
        align="center"
        gap={2}
        p={3}
      >
        <Icon as={SourceIconComponent} color={sourceColor} boxSize={5} />
        <Box flex={1} minW={0}>
          <Text fontSize="2xs" color="gray.500" noOfLines={1}>
            {formatDate(item.publishedAt)}
          </Text>
        </Box>
      </Flex>

      {/* Content */}
      <Box p={3} flex={1}>
        <Text
          fontSize="sm"
          fontWeight="bold"
          lineHeight="1.3"
          color="white"
          mb={2}
          noOfLines={3}
        >
          {item.title}
        </Text>

        {item.summary && (
          <Text fontSize="xs" lineHeight="1.4" color="gray.400" noOfLines={3} mb={3}>
            {excerpt(item.summary, 90)}
          </Text>
        )}

        {/* Topics */}
        {item.topics && item.topics.length > 0 && (
          <Flex gap={1} flexWrap="wrap">
            {item.topics.slice(0, 2).map(topic => (
              <Badge
                key={topic}
                bg="gray.700"
                color="gray.300"
                fontSize="2xs"
                px={1.5}
                py={0.5}
                rounded="sm"
              >
                {topic}
              </Badge>
            ))}
          </Flex>
        )}
      </Box>

      {/* Footer Actions */}
      <Box p={2.5} borderTopWidth="1px" borderColor="gray.700" bg="gray.850">
        <Flex gap={2}>
          <Button
            size="sm"
            onClick={() => toggleLike(1)}
            isLoading={loading}
            bg="gray.700"
            color="white"
            flex={1}
            fontSize="xs"
            _hover={{
              bg: 'gray.600',
              transform: 'scale(1.05)',
            }}
            opacity={liked === 1 ? 1 : 0.7}
          >
            <ThumbsUp size={16} fill={liked === 1 ? 'currentColor' : 'none'} />
          </Button>
          <Button
            size="sm"
            onClick={() => toggleLike(-1)}
            isLoading={loading}
            bg="gray.700"
            color="white"
            flex={1}
            fontSize="xs"
            _hover={{
              bg: 'gray.600',
              transform: 'scale(1.05)',
            }}
            opacity={liked === -1 ? 1 : 0.7}
          >
            <ThumbsDown size={16} fill={liked === -1 ? 'currentColor' : 'none'} />
          </Button>
          <Button
            size="sm"
            onClick={() => window.open(item.url, '_blank')}
            bg="gray.700"
            color="white"
            flex={1}
            fontSize="xs"
            _hover={{
              bg: 'gray.600',
              transform: 'scale(1.05)',
            }}
          >
            <ExternalLink size={16} />
          </Button>
        </Flex>
      </Box>
    </Box>
  );
});

export default CardOption3;
