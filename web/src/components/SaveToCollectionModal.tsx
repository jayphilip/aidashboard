import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Flex,
  Text,
  VStack,
  HStack,
  Input,
  Textarea,
  Spinner,
  Badge,
} from '@chakra-ui/react';
import { BookmarkCheck, Bookmark, X, FolderPlus } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import {
  getUserCollections,
  createCollection,
  addItemToCollection,
  removeItemFromCollection,
  getCollectionsForItem,
  type CollectionWithCount,
} from '@/lib/collections';

interface SaveToCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemTitle: string;
}

export default function SaveToCollectionModal({
  isOpen,
  onClose,
  itemId,
  itemTitle,
}: SaveToCollectionModalProps) {
  const { userId } = useUser();
  const [collections, setCollections] = useState<CollectionWithCount[]>([]);
  const [savedColIds, setSavedColIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cols, savedIds] = await Promise.all([
        getUserCollections(userId),
        getCollectionsForItem(itemId, userId),
      ]);
      setCollections(cols);
      setSavedColIds(new Set(savedIds));
    } catch (err) {
      setError('Failed to load collections');
    } finally {
      setLoading(false);
    }
  }, [userId, itemId]);

  useEffect(() => {
    if (isOpen) {
      void load();
      setShowNewForm(false);
      setNewName('');
      setNewDesc('');
      setError(null);
    }
  }, [isOpen, load]);

  async function toggleCollection(colId: number, isSaved: boolean) {
    setSaving(colId);
    try {
      if (isSaved) {
        await removeItemFromCollection(colId, itemId);
        setSavedColIds((prev) => {
          const next = new Set(prev);
          next.delete(colId);
          return next;
        });
        setCollections((prev) =>
          prev.map((c) => (c.id === colId ? { ...c, itemCount: c.itemCount - 1 } : c))
        );
      } else {
        await addItemToCollection(colId, itemId);
        setSavedColIds((prev) => new Set([...prev, colId]));
        setCollections((prev) =>
          prev.map((c) => (c.id === colId ? { ...c, itemCount: c.itemCount + 1 } : c))
        );
      }
    } catch {
      setError('Failed to update collection');
    } finally {
      setSaving(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const col = await createCollection(userId, newName.trim(), newDesc.trim() || undefined);
      // Also add the item immediately
      await addItemToCollection(col.id, itemId);
      setSavedColIds((prev) => new Set([...prev, col.id]));
      setCollections((prev) => [{ ...col, itemCount: 1 }, ...prev]);
      setShowNewForm(false);
      setNewName('');
      setNewDesc('');
    } catch {
      setError('Failed to create collection');
    } finally {
      setCreating(false);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <Box
        position="fixed"
        inset={0}
        bg="blackAlpha.700"
        zIndex={1000}
        onClick={onClose}
      />

      {/* Modal */}
      <Box
        position="fixed"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        zIndex={1001}
        w={{ base: '90vw', sm: '420px' }}
        maxH="80vh"
        bg="gray.900"
        borderWidth="1px"
        borderColor="gray.700"
        rounded="xl"
        shadow="2xl"
        display="flex"
        flexDirection="column"
      >
        {/* Header */}
        <Flex
          align="center"
          justify="space-between"
          p={4}
          borderBottomWidth="1px"
          borderColor="gray.700"
          flexShrink={0}
        >
          <HStack gap={2}>
            <Bookmark size={18} color="#60a5fa" />
            <Text fontWeight="bold" fontSize="md" color="white">
              Save to Collection
            </Text>
          </HStack>
          <Button
            size="sm"
            variant="ghost"
            color="gray.400"
            _hover={{ color: 'white', bg: 'gray.800' }}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </Button>
        </Flex>

        {/* Item title preview */}
        <Box px={4} pt={3} pb={0} flexShrink={0}>
          <Text fontSize="xs" color="gray.500" mb={1}>
            Saving:
          </Text>
          <Text
            fontSize="sm"
            color="gray.300"
            lineHeight="1.4"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {itemTitle}
          </Text>
        </Box>

        {/* Error */}
        {error && (
          <Box px={4} pt={2} flexShrink={0}>
            <Text fontSize="xs" color="red.400">
              {error}
            </Text>
          </Box>
        )}

        {/* Collections list */}
        <Box flex={1} overflowY="auto" px={4} py={3}>
          {loading ? (
            <Flex justify="center" py={6}>
              <Spinner size="sm" color="blue.400" />
            </Flex>
          ) : collections.length === 0 && !showNewForm ? (
            <Flex
              direction="column"
              align="center"
              gap={3}
              py={6}
              color="gray.500"
            >
              <Bookmark size={32} />
              <Text fontSize="sm">No collections yet</Text>
            </Flex>
          ) : (
            <VStack align="stretch" gap={1}>
              {collections.map((col) => {
                const isSaved = savedColIds.has(col.id);
                const isSaving = saving === col.id;
                return (
                  <Flex
                    key={col.id}
                    align="center"
                    gap={3}
                    p={2.5}
                    rounded="lg"
                    bg={isSaved ? 'blue.900' : 'gray.800'}
                    borderWidth="1px"
                    borderColor={isSaved ? 'blue.700' : 'gray.700'}
                    cursor="pointer"
                    _hover={{ borderColor: isSaved ? 'blue.600' : 'gray.500' }}
                    transition="all 0.15s"
                    onClick={() => !isSaving && toggleCollection(col.id, isSaved)}
                  >
                    {isSaving ? (
                      <Spinner size="xs" color="blue.400" flexShrink={0} />
                    ) : isSaved ? (
                      <BookmarkCheck size={16} color="#60a5fa" style={{ flexShrink: 0 }} />
                    ) : (
                      <Bookmark size={16} color="#9ca3af" style={{ flexShrink: 0 }} />
                    )}
                    <Box flex={1} minW={0}>
                      <Text
                        fontSize="sm"
                        fontWeight="medium"
                        color={isSaved ? 'blue.300' : 'white'}
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {col.name}
                      </Text>
                      {col.description && (
                        <Text
                          fontSize="xs"
                          color="gray.500"
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {col.description}
                        </Text>
                      )}
                    </Box>
                    <Badge
                      bg="gray.700"
                      color="gray.400"
                      fontSize="xs"
                      px={2}
                      rounded="md"
                      flexShrink={0}
                    >
                      {col.itemCount}
                    </Badge>
                  </Flex>
                );
              })}
            </VStack>
          )}

          {/* New collection form */}
          {showNewForm && (
            <Box
              mt={collections.length > 0 ? 3 : 0}
              p={3}
              bg="gray.800"
              borderWidth="1px"
              borderColor="blue.700"
              rounded="lg"
            >
              <form onSubmit={handleCreate}>
                <VStack align="stretch" gap={2}>
                  <Text fontSize="xs" fontWeight="semibold" color="blue.400">
                    New Collection
                  </Text>
                  <Input
                    placeholder="Collection name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    size="sm"
                    bg="gray.900"
                    borderColor="gray.600"
                    color="white"
                    _placeholder={{ color: 'gray.500' }}
                    _focus={{ borderColor: 'blue.500' }}
                    autoFocus
                    required
                  />
                  <Textarea
                    placeholder="Description (optional)"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    size="sm"
                    rows={2}
                    bg="gray.900"
                    borderColor="gray.600"
                    color="white"
                    _placeholder={{ color: 'gray.500' }}
                    _focus={{ borderColor: 'blue.500' }}
                    resize="none"
                  />
                  <HStack gap={2} justify="flex-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      color="gray.400"
                      onClick={() => {
                        setShowNewForm(false);
                        setNewName('');
                        setNewDesc('');
                      }}
                      type="button"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      colorScheme="blue"
                      type="submit"
                      loading={creating}
                      disabled={!newName.trim()}
                    >
                      Create & Save
                    </Button>
                  </HStack>
                </VStack>
              </form>
            </Box>
          )}
        </Box>

        {/* Footer */}
        <Flex
          p={3}
          borderTopWidth="1px"
          borderColor="gray.700"
          justify="space-between"
          align="center"
          flexShrink={0}
        >
          {!showNewForm ? (
            <Button
              size="sm"
              variant="ghost"
              color="blue.400"
              _hover={{ bg: 'blue.900', color: 'blue.300' }}
              onClick={() => setShowNewForm(true)}
            >
              <HStack gap={1.5}>
                <FolderPlus size={14} />
                <span>New Collection</span>
              </HStack>
            </Button>
          ) : (
            <Box />
          )}
          <Button size="sm" colorScheme="blue" onClick={onClose}>
            Done
          </Button>
        </Flex>
      </Box>
    </>
  );
}
