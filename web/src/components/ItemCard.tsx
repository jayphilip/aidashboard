import { useState, memo } from 'react';
import { Box, Flex, Text, Button, Badge, Icon } from '@chakra-ui/react';
import { getDb } from '@/lib/db';
import { itemLikes } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { useUser } from '@/contexts/UserContext';
import { useItems } from '@/contexts/ItemsContext';
import { formatDate, excerpt } from '@/utils/formatting';
import { logger } from '@/utils/logger';
import { ExternalLink, ThumbsUp, ThumbsDown, FileText, Twitter, PenTool, Mail, Bookmark } from 'lucide-react';
import type { Item } from '@/lib/items';
import SaveToCollectionModal from './SaveToCollectionModal';

interface ItemCardProps {
  item: Item;
  sourceName?: string;
  initialLiked?: number | null;
  isRead?: boolean;
  onLikeChange?: () => void;
  onReadChange?: () => void;
  onClick?: () => void;
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

function getGradient(sourceType: string): string {
  switch (sourceType) {
    case 'paper': return 'linear(135deg, purple.600, pink.500)';
    case 'tweet': return 'linear(135deg, blue.500, cyan.400)';
    case 'blog': return 'linear(135deg, orange.500, red.400)';
    case 'newsletter': return 'linear(135deg, green.500, teal.400)';
    default: return 'linear(135deg, gray.600, gray.500)';
  }
}

const ItemCard = memo(function ItemCard({ item, sourceName = 'Unknown', initialLiked = null, isRead = false, onLikeChange, onReadChange, onClick }: ItemCardProps) {
  const { userId } = useUser();
  const { markAsRead } = useItems();
  const [liked, setLiked] = useState<number | null>(initialLiked);
  const [loading, setLoading] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);

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

  async function handleExternalLinkClick(e: React.MouseEvent) {
    e.stopPropagation();

    // Mark as read before opening the link
    if (!isRead) {
      await markAsRead(item.id);
      if (onReadChange) onReadChange();
    }

    window.open(item.url, '_blank');
  }

  const gradient = getGradient(item.sourceType);
  const SourceIconComponent = getSourceIcon(item.sourceType);

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
        cursor: onClick ? 'pointer' : 'default',
      }}
      h="full"
      display="flex"
      flexDirection="column"
      onClick={onClick}
    >
      {/* Gradient Top Bar with Read Indicator */}
      <Box h="4px" bgGradient={gradient} opacity={isRead ? 0.5 : 1} />

      {/* Icon Header Bar */}
      <Flex
        bg="gray.850"
        borderBottomWidth="1px"
        borderColor="gray.700"
        align="center"
        gap={2}
        p={2.5}
        px={3}
      >
        <Flex
          align="center"
          justify="center"
          w={7}
          h={7}
          rounded="md"
          bgGradient={gradient}
          flexShrink={0}
        >
          <Icon as={SourceIconComponent} color="white" boxSize={4} />
        </Flex>
        <Box flex={1} minW={0}>
          <Text fontSize="2xs" color="gray.400" fontWeight="semibold" noOfLines={1}>
            {sourceName}
          </Text>
        </Box>
        <Text fontSize="2xs" color="gray.600" flexShrink={0}>
          {formatDate(item.publishedAt)}
        </Text>
      </Flex>

      {/* Content */}
      <Box p={3} flex={1}>
        <Text
          fontSize="sm"
          fontWeight="bold"
          lineHeight="1.3"
          color={isRead ? 'gray.500' : 'white'}
          mb={2}
          noOfLines={3}
        >
          {item.title}
        </Text>

        {item.summary && (
          <Text fontSize="xs" lineHeight="1.4" color="gray.400" noOfLines={3} mb={3}>
            {excerpt(item.summary, 100)}
          </Text>
        )}

        {/* Topics with subtle gradient */}
        {item.topics && item.topics.length > 0 && (
          <Flex gap={1} flexWrap="wrap">
            {item.topics.slice(0, 3).map(topic => (
              <Badge
                key={topic}
                bg="gray.700"
                color="gray.300"
                fontSize="2xs"
                px={2}
                py={0.5}
                rounded="md"
                borderWidth="1px"
                borderColor="gray.600"
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
            onClick={(e) => {
              e.stopPropagation();
              toggleLike(1);
            }}
            loading={loading}
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
            onClick={(e) => {
              e.stopPropagation();
              toggleLike(-1);
            }}
            loading={loading}
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
            onClick={(e) => {
              e.stopPropagation();
              setSaveModalOpen(true);
            }}
            bg="gray.700"
            color="white"
            flex={1}
            fontSize="xs"
            _hover={{
              bg: 'gray.600',
              transform: 'scale(1.05)',
            }}
            aria-label="Save to collection"
          >
            <Bookmark size={16} />
          </Button>
          <Button
            size="sm"
            onClick={handleExternalLinkClick}
            bgGradient={gradient}
            color="white"
            flex={1}
            fontSize="xs"
            _hover={{
              transform: 'scale(1.05)',
              opacity: 0.9,
            }}
          >
            <ExternalLink size={16} />
          </Button>
        </Flex>
      </Box>

      <SaveToCollectionModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        itemId={item.id}
        itemTitle={item.title}
      />
    </Box>
  );
});

export default ItemCard;
