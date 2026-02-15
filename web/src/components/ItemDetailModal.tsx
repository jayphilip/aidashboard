import { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Text,
  Button,
  Badge,
  Icon,
  Separator,
  Spinner,
  DialogRoot,
  DialogBackdrop,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogCloseTrigger,
  DialogPositioner,
} from '@chakra-ui/react';
import { getDb } from '@/lib/db';
import { items as itemsTable, itemLikes } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { useUser } from '@/contexts/UserContext';
import { useItems } from '@/contexts/ItemsContext';
import { formatDate } from '@/utils/formatting';
import { logger } from '@/utils/logger';
import { ExternalLink, ThumbsUp, ThumbsDown, FileText, Twitter, PenTool, Mail, BookOpen, BookOpenCheck } from 'lucide-react';
import type { Item } from '@/lib/items';
import ItemCard from './ItemCard';

interface ItemDetailModalProps {
  item: Item | null;
  sourceName?: string;
  initialLiked?: number | null;
  initialRead?: boolean;
  open: boolean;
  onClose: () => void;
  onLikeChange?: () => void;
  onReadChange?: () => void;
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

export default function ItemDetailModal({
  item,
  sourceName = 'Unknown',
  initialLiked = null,
  initialRead = false,
  open,
  onClose,
  onLikeChange,
  onReadChange,
}: ItemDetailModalProps) {
  const { userId } = useUser();
  const { markAsRead, markAsUnread } = useItems();
  const [liked, setLiked] = useState<number | null>(initialLiked);
  const [isRead, setIsRead] = useState(initialRead);
  const [loading, setLoading] = useState(false);
  const [relatedItems, setRelatedItems] = useState<Array<Item & { sourceName: string }>>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  useEffect(() => {
    setLiked(initialLiked);
  }, [initialLiked]);

  useEffect(() => {
    setIsRead(initialRead);
  }, [initialRead]);

  // Auto-mark as read when modal opens
  useEffect(() => {
    if (item && open && !isRead) {
      markAsRead(item.id);
      setIsRead(true);
      if (onReadChange) onReadChange();
    }
  }, [item, open, isRead, markAsRead, onReadChange]);

  // Load related items when modal opens
  useEffect(() => {
    if (!item || !open) {
      setRelatedItems([]);
      return;
    }

    async function loadRelatedItems() {
      if (!item || !item.topics || item.topics.length === 0) return;

      setLoadingRelated(true);
      try {
        const db = await getDb();

        // Find items with overlapping topics (excluding current item)
        const related = await db
          .select()
          .from(itemsTable)
          .where(
            and(
              sql`${itemsTable.id} != ${item.id}`,
              sql`${itemsTable.topics} && ${item.topics}`
            )
          )
          .orderBy(sql`(
            SELECT COUNT(*)
            FROM unnest(${itemsTable.topics}) topic
            WHERE topic = ANY(${item.topics})
          ) DESC`)
          .limit(6);

        // Add source names
        const relatedWithSources = related.map(r => ({
          ...r,
          sourceName: 'Related Source', // You can enhance this with actual source lookup
        }));

        setRelatedItems(relatedWithSources);
      } catch (err) {
        logger.error('Failed to load related items:', err);
      } finally {
        setLoadingRelated(false);
      }
    }

    loadRelatedItems();
  }, [item, open]);

  async function toggleLike(score: number) {
    if (!item || loading) return;
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

  if (!item) return null;

  const gradient = getGradient(item.sourceType);
  const SourceIconComponent = getSourceIcon(item.sourceType);

  return (
    <DialogRoot open={open} onOpenChange={(e) => !e.open && onClose()} size="xl">
      <DialogBackdrop bg="blackAlpha.700" backdropFilter="blur(4px)" />
      <DialogPositioner>
        <DialogContent bg="gray.900" borderWidth="1px" borderColor="gray.700" maxW="900px" maxH="90vh">
        <DialogHeader
          bg="gray.850"
          borderBottomWidth="1px"
          borderColor="gray.700"
          p={4}
        >
          <Flex align="center" gap={3}>
            <Flex
              align="center"
              justify="center"
              w={10}
              h={10}
              rounded="lg"
              bgGradient={gradient}
              flexShrink={0}
            >
              <Icon as={SourceIconComponent} color="white" boxSize={5} />
            </Flex>
            <Box flex={1} minW={0}>
              <Text fontSize="sm" color="gray.400" fontWeight="semibold">
                {sourceName}
              </Text>
              <Text fontSize="xs" color="gray.600">
                {formatDate(item.publishedAt)}
              </Text>
            </Box>
          </Flex>
        </DialogHeader>
        <DialogCloseTrigger color="gray.400" _hover={{ color: 'white' }} />

        <DialogBody p={6} overflowY="auto">
          {/* Title */}
          <Text
            fontSize="2xl"
            fontWeight="bold"
            lineHeight="1.3"
            color="white"
            mb={4}
          >
            {item.title}
          </Text>

          {/* Topics */}
          {item.topics && item.topics.length > 0 && (
            <Flex gap={2} flexWrap="wrap" mb={4}>
              {item.topics.map(topic => (
                <Badge
                  key={topic}
                  bg="gray.700"
                  color="gray.300"
                  fontSize="xs"
                  px={3}
                  py={1}
                  rounded="md"
                  borderWidth="1px"
                  borderColor="gray.600"
                >
                  {topic}
                </Badge>
              ))}
            </Flex>
          )}

          {/* Summary */}
          {item.summary && (
            <Box mb={4}>
              <Text fontSize="md" lineHeight="1.6" color="gray.300">
                {item.summary}
              </Text>
            </Box>
          )}

          {/* Full Body */}
          {item.body && (
            <Box mb={6}>
              <Separator mb={4} borderColor="gray.700" />
              <Text fontSize="sm" lineHeight="1.7" color="gray.400" whiteSpace="pre-wrap">
                {item.body}
              </Text>
            </Box>
          )}

          {/* Action Buttons */}
          <Flex gap={3} mb={3} flexWrap="wrap">
            <Button
              size="md"
              onClick={() => toggleLike(1)}
              loading={loading}
              bg="gray.700"
              color="white"
              flex={1}
              minW="120px"
              _hover={{
                bg: 'gray.600',
                transform: 'scale(1.02)',
              }}
              opacity={liked === 1 ? 1 : 0.7}
            >
              <ThumbsUp size={18} fill={liked === 1 ? 'currentColor' : 'none'} />
              <Text ml={2}>Like</Text>
            </Button>
            <Button
              size="md"
              onClick={() => toggleLike(-1)}
              loading={loading}
              bg="gray.700"
              color="white"
              flex={1}
              minW="120px"
              _hover={{
                bg: 'gray.600',
                transform: 'scale(1.02)',
              }}
              opacity={liked === -1 ? 1 : 0.7}
            >
              <ThumbsDown size={18} fill={liked === -1 ? 'currentColor' : 'none'} />
              <Text ml={2}>Dislike</Text>
            </Button>
            <Button
              size="md"
              onClick={() => window.open(item.url, '_blank')}
              bgGradient={gradient}
              color="white"
              flex={1}
              minW="120px"
              _hover={{
                transform: 'scale(1.02)',
                opacity: 0.9,
              }}
            >
              <ExternalLink size={18} />
              <Text ml={2}>Open</Text>
            </Button>
          </Flex>

          {/* Read Status Button */}
          <Flex mb={6}>
            <Button
              size="sm"
              onClick={async () => {
                if (isRead) {
                  await markAsUnread(item.id);
                  setIsRead(false);
                } else {
                  await markAsRead(item.id);
                  setIsRead(true);
                }
                if (onReadChange) onReadChange();
              }}
              bg={isRead ? 'green.700' : 'gray.700'}
              color="white"
              w="full"
              _hover={{
                bg: isRead ? 'green.600' : 'gray.600',
              }}
            >
              <BookOpenCheck size={16} />
              <Text ml={2}>{isRead ? 'Mark as Unread' : 'Mark as Read'}</Text>
            </Button>
          </Flex>

          {/* Related Items */}
          {item.topics && item.topics.length > 0 && (
            <>
              <Separator mb={4} borderColor="gray.700" />
              <Flex align="center" gap={2} mb={4}>
                <Icon as={BookOpen} color="gray.400" boxSize={5} />
                <Text fontSize="lg" fontWeight="bold" color="white">
                  Related Items
                </Text>
              </Flex>

              {loadingRelated ? (
                <Flex justify="center" py={8}>
                  <Spinner size="lg" color="blue.500" />
                </Flex>
              ) : relatedItems.length > 0 ? (
                <Box
                  display="grid"
                  gridTemplateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }}
                  gap={4}
                >
                  {relatedItems.map(relatedItem => (
                    <ItemCard
                      key={relatedItem.id}
                      item={relatedItem}
                      sourceName={relatedItem.sourceName}
                    />
                  ))}
                </Box>
              ) : (
                <Text color="gray.500" textAlign="center" py={4}>
                  No related items found
                </Text>
              )}
            </>
          )}
        </DialogBody>
      </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  );
}
