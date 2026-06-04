import { useState, memo } from 'react';
import { Box, Flex, Text, Button, Badge, Icon } from '@chakra-ui/react';
import { getDb } from '@/lib/db';
import { itemLikes } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { useUser } from '@/contexts/UserContext';
import { formatDate, excerpt } from '@/utils/formatting';
import { logger } from '@/utils/logger';
import { ExternalLink, Star, TrendingUp, BookOpen, Mail } from 'lucide-react';
import type { Item } from '@/lib/items';

interface CardOption2Props {
  item: Item;
  sourceName?: string;
  initialLiked?: number | null;
  onLikeChange?: () => void;
}

function getSourceIcon(sourceType: string) {
  switch (sourceType) {
    case 'paper': return BookOpen;
    case 'tweet': return TrendingUp;
    case 'blog': return BookOpen;
    case 'newsletter': return Mail;
    default: return Star;
  }
}

function getGradient(sourceType: string): string {
  switch (sourceType) {
    case 'paper': return 'linear(135deg, purple.600, pink.500)';
    case 'tweet': return 'linear(135deg, blue.500, cyan.400)';
    case 'blog': return 'linear(135deg, orange.500, red.400)';
    case 'newsletter': return 'linear(135deg, green.500, teal.400)';
    default: return 'linear(135deg, gray.600, gray.500)';
  }
}

const CardOption2 = memo(function CardOption2({ item, initialLiked = null, onLikeChange }: CardOption2Props) {
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

  const gradient = getGradient(item.sourceType);
  const SourceIconComponent = getSourceIcon(item.sourceType);

  return (
    <Box
      position="relative"
      bg="gray.900"
      borderWidth="2px"
      borderColor="transparent"
      rounded="2xl"
      overflow="hidden"
      transition="all 0.3s ease"
      _hover={{
        borderColor: 'whiteAlpha.200',
        shadow: '2xl',
        transform: 'scale(1.02)',
      }}
      h="full"
      display="flex"
      flexDirection="column"
    >
      {/* Gradient Top Bar */}
      <Box
        h="6px"
        bgGradient={gradient}
      />

      {/* Content */}
      <Box p={4}>
        {/* Header with Icon */}
        <Flex align="center" gap={2} mb={3}>
          <Flex
            align="center"
            justify="center"
            w={8}
            h={8}
            rounded="lg"
            bgGradient={gradient}
            flexShrink={0}
          >
            <Icon as={SourceIconComponent} color="white" boxSize={4} />
          </Flex>
          <Box flex={1} minW={0}>
            <Text fontSize="2xs" color="gray.500" lineClamp={1}>
              {formatDate(item.publishedAt)}
            </Text>
          </Box>
        </Flex>

        <Text
          fontSize="md"
          fontWeight="800"
          lineHeight="1.2"
          color="white"
          mb={2}
          lineClamp={2}
          bgGradient={gradient}
          bgClip="text"
        >
          {item.title}
        </Text>

        {item.summary && (
          <Text fontSize="xs" lineHeight="1.5" color="gray.400" mb={3} lineClamp={3}>
            {excerpt(item.summary, 100)}
          </Text>
        )}

        {/* Topics with gradient background */}
        {item.topics && item.topics.length > 0 && (
          <Flex gap={1} flexWrap="wrap" mb={3}>
            {item.topics.slice(0, 3).map(topic => (
              <Badge
                key={topic}
                bgGradient={gradient}
                color="white"
                fontSize="2xs"
                px={2}
                py={0.5}
                rounded="full"
                fontWeight="bold"
              >
                #{topic}
              </Badge>
            ))}
          </Flex>
        )}

        {/* Action Buttons */}
        <Flex gap={1.5}>
          <Button
            size="xs"
            onClick={() => toggleLike(1)}
            loading={loading}
            flex={1}
            variant={liked === 1 ? 'solid' : 'outline'}
            colorScheme="green"
            rounded="lg"
          >
            {liked === 1 ? '❤️' : '🤍'}
          </Button>
          <Button
            size="xs"
            onClick={() => toggleLike(-1)}
            loading={loading}
            flex={1}
            variant={liked === -1 ? 'solid' : 'outline'}
            colorScheme="red"
            rounded="lg"
          >
            {liked === -1 ? '👎' : '👋'}
          </Button>
          <Button
            size="xs"
            onClick={() => window.open(item.url, '_blank')}
            bgGradient={gradient}
            color="white"
            flex={1}
            rounded="lg"
          >
            <ExternalLink size={12} />
          </Button>
        </Flex>
      </Box>
    </Box>
  );
});

export default CardOption2;
