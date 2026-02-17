import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Flex,
  Text,
  Button,
  VStack,
  HStack,
  Input,
  Textarea,
  Badge,
  Spinner,
  SimpleGrid,
} from '@chakra-ui/react';
import {
  Bookmark,
  BookmarkCheck,
  Plus,
  Edit2,
  Trash2,
  ArrowLeft,
  ExternalLink,
  FolderOpen,
  Check,
  X,
  FileText,
  Twitter,
  PenTool,
  Mail,
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { useItems } from '@/contexts/ItemsContext';
import {
  getUserCollections,
  getCollectionWithItems,
  createCollection,
  updateCollection,
  deleteCollection,
  removeItemFromCollection,
  type CollectionWithCount,
  type CollectionWithItems,
} from '@/lib/collections';
import { formatDate } from '@/utils/formatting';
import type { Item } from '@/lib/items';

/* ─────────────────────────────── helpers ─────────────────────────── */
function getGradient(sourceType: string): string {
  switch (sourceType) {
    case 'paper': return 'linear-gradient(135deg, #7c3aed, #ec4899)';
    case 'tweet': return 'linear-gradient(135deg, #3b82f6, #22d3ee)';
    case 'blog': return 'linear-gradient(135deg, #f97316, #ef4444)';
    case 'newsletter': return 'linear-gradient(135deg, #22c55e, #14b8a6)';
    default: return 'linear-gradient(135deg, #6b7280, #4b5563)';
  }
}

function SourceIcon({ sourceType }: { sourceType: string }) {
  const icons: Record<string, React.ComponentType<any>> = {
    paper: FileText,
    tweet: Twitter,
    blog: PenTool,
    newsletter: Mail,
  };
  const Ic = icons[sourceType] ?? FileText;
  return <Ic size={14} />;
}

/* ─────────────────────────── inline edit ──────────────────────────── */
interface InlineEditProps {
  initialName: string;
  initialDesc: string;
  onSave: (name: string, desc: string) => Promise<void>;
  onCancel: () => void;
}

function InlineEdit({ initialName, initialDesc, onSave, onCancel }: InlineEditProps) {
  const [name, setName] = useState(initialName);
  const [desc, setDesc] = useState(initialDesc);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSave(name.trim(), desc.trim());
    setSaving(false);
  }

  return (
    <form onSubmit={handleSave} style={{ width: '100%' }}>
      <VStack align="stretch" gap={2}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Collection name"
          size="sm"
          bg="gray.900"
          borderColor="blue.600"
          color="white"
          _placeholder={{ color: 'gray.500' }}
          _focus={{ borderColor: 'blue.400' }}
          autoFocus
          required
        />
        <Textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Description (optional)"
          size="sm"
          rows={2}
          bg="gray.900"
          borderColor="gray.600"
          color="white"
          _placeholder={{ color: 'gray.500' }}
          _focus={{ borderColor: 'blue.400' }}
          resize="none"
        />
        <HStack gap={2} justify="flex-end">
          <Button size="xs" variant="ghost" color="gray.400" onClick={onCancel} type="button">
            <X size={12} />
          </Button>
          <Button
            size="xs"
            colorScheme="blue"
            type="submit"
            loading={saving}
            disabled={!name.trim()}
          >
            <Check size={12} />
          </Button>
        </HStack>
      </VStack>
    </form>
  );
}

/* ─────────────────────── collection card ─────────────────────────── */
interface CollectionCardProps {
  col: CollectionWithCount;
  onOpen: (col: CollectionWithCount) => void;
  onEdit: (col: CollectionWithCount) => void;
  onDelete: (col: CollectionWithCount) => void;
  isEditing: boolean;
  onSave: (name: string, desc: string) => Promise<void>;
  onCancelEdit: () => void;
}

function CollectionCard({
  col,
  onOpen,
  onEdit,
  onDelete,
  isEditing,
  onSave,
  onCancelEdit,
}: CollectionCardProps) {
  return (
    <Box
      bg="gray.800"
      borderWidth="1px"
      borderColor="gray.700"
      rounded="xl"
      overflow="hidden"
      transition="all 0.2s"
      _hover={{ borderColor: 'gray.600', shadow: 'lg' }}
      display="flex"
      flexDirection="column"
    >
      {/* Top accent */}
      <Box h="3px" background="linear-gradient(to right, #3b82f6, #8b5cf6)" />

      <Box p={4} flex={1}>
        {isEditing ? (
          <InlineEdit
            initialName={col.name}
            initialDesc={col.description ?? ''}
            onSave={onSave}
            onCancel={onCancelEdit}
          />
        ) : (
          <>
            <Flex align="flex-start" justify="space-between" gap={2} mb={1}>
              <Text
                fontWeight="bold"
                fontSize="md"
                color="white"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
                lineHeight="1.3"
                cursor="pointer"
                _hover={{ color: 'blue.300' }}
                onClick={() => onOpen(col)}
                flex={1}
              >
                {col.name}
              </Text>
              <HStack gap={1} flexShrink={0}>
                <Button
                  size="xs"
                  variant="ghost"
                  color="gray.500"
                  _hover={{ color: 'blue.300', bg: 'gray.700' }}
                  onClick={() => onEdit(col)}
                  aria-label="Edit collection"
                >
                  <Edit2 size={13} />
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  color="gray.500"
                  _hover={{ color: 'red.400', bg: 'gray.700' }}
                  onClick={() => onDelete(col)}
                  aria-label="Delete collection"
                >
                  <Trash2 size={13} />
                </Button>
              </HStack>
            </Flex>

            {col.description && (
              <Text
                fontSize="xs"
                color="gray.500"
                mb={2}
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {col.description}
              </Text>
            )}

            <HStack gap={2} mt={2}>
              <Badge
                bg="blue.900"
                color="blue.300"
                borderWidth="1px"
                borderColor="blue.800"
                fontSize="xs"
                px={2}
                rounded="md"
              >
                {col.itemCount} {col.itemCount === 1 ? 'item' : 'items'}
              </Badge>
              <Text fontSize="xs" color="gray.600">
                {formatDate(col.updatedAt)}
              </Text>
            </HStack>
          </>
        )}
      </Box>

      {!isEditing && (
        <Flex
          px={4}
          py={2.5}
          borderTopWidth="1px"
          borderColor="gray.700"
          bg="gray.850"
          justify="flex-end"
        >
          <Button
            size="sm"
            colorScheme="blue"
            variant="ghost"
            onClick={() => onOpen(col)}
            fontSize="xs"
          >
            <HStack gap={1.5}>
              <FolderOpen size={13} />
              <span>Open</span>
            </HStack>
          </Button>
        </Flex>
      )}
    </Box>
  );
}

/* ─────────────────────── item row in collection ───────────────────── */
interface CollectionItemRowProps {
  item: Item;
  sourceName: string;
  collectionId: number;
  onRemove: (itemId: string) => void;
}

function CollectionItemRow({ item, sourceName, collectionId, onRemove }: CollectionItemRowProps) {
  const [removing, setRemoving] = useState(false);

  async function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    setRemoving(true);
    await removeItemFromCollection(collectionId, item.id);
    onRemove(item.id);
  }

  const gradient = getGradient(item.sourceType);

  return (
    <Box
      bg="gray.800"
      borderWidth="1px"
      borderColor="gray.700"
      rounded="lg"
      overflow="hidden"
      transition="all 0.15s"
      _hover={{ borderColor: 'gray.600' }}
    >
      <Box h="3px" style={{ background: gradient }} />
      <Flex align="flex-start" gap={3} p={3}>
        <Box
          w={7}
          h={7}
          rounded="md"
          flexShrink={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          style={{ background: gradient }}
          color="white"
          mt={0.5}
        >
          <SourceIcon sourceType={item.sourceType} />
        </Box>

        <Box flex={1} minW={0}>
          <Text
            fontSize="sm"
            fontWeight="semibold"
            color="white"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
            lineHeight="1.4"
            mb={1}
          >
            {item.title}
          </Text>
          <HStack gap={2} flexWrap="wrap">
            <Text fontSize="xs" color="gray.500">
              {sourceName}
            </Text>
            <Text fontSize="xs" color="gray.600">·</Text>
            <Text fontSize="xs" color="gray.600">
              {formatDate(item.publishedAt)}
            </Text>
            {item.topics && item.topics.slice(0, 2).map((t) => (
              <Badge
                key={t}
                bg="gray.700"
                color="gray.400"
                fontSize="2xs"
                px={1.5}
                rounded="sm"
              >
                {t}
              </Badge>
            ))}
          </HStack>
        </Box>

        <HStack gap={1} flexShrink={0}>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px', borderRadius: '4px', color: '#6b7280', cursor: 'pointer', background: 'transparent' }}
            aria-label="Open link"
          >
            <ExternalLink size={13} />
          </a>
          <Button
            size="xs"
            variant="ghost"
            color="gray.500"
            _hover={{ color: 'red.400', bg: 'gray.700' }}
            onClick={handleRemove}
            loading={removing}
            aria-label="Remove from collection"
          >
            <X size={13} />
          </Button>
        </HStack>
      </Flex>
    </Box>
  );
}

/* ─────────────────────────── main page ───────────────────────────── */
type View = 'list' | 'detail';

export default function CollectionsPage() {
  const { userId } = useUser();
  const { sourcesMap } = useItems();

  const [view, setView] = useState<View>('list');
  const [collections, setCollections] = useState<CollectionWithCount[]>([]);
  const [activeCollection, setActiveCollection] = useState<CollectionWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCollections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cols = await getUserCollections(userId);
      setCollections(cols);
    } catch (err) {
      setError('Failed to load collections');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadCollections();
  }, [loadCollections]);

  async function openCollection(col: CollectionWithCount) {
    setDetailLoading(true);
    setView('detail');
    try {
      const data = await getCollectionWithItems(col.id, userId);
      setActiveCollection(data);
    } catch {
      setError('Failed to load collection');
    } finally {
      setDetailLoading(false);
    }
  }

  function backToList() {
    setView('list');
    setActiveCollection(null);
    void loadCollections(); // refresh counts
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const col = await createCollection(userId, newName.trim(), newDesc.trim() || undefined);
      setCollections((prev) => [{ ...col, itemCount: 0 }, ...prev]);
      setShowNewForm(false);
      setNewName('');
      setNewDesc('');
    } catch {
      setError('Failed to create collection');
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit(colId: number, name: string, desc: string) {
    const updated = await updateCollection(colId, userId, { name, description: desc });
    if (updated) {
      setCollections((prev) =>
        prev.map((c) => (c.id === colId ? { ...c, name: updated.name, description: updated.description, updatedAt: updated.updatedAt } : c))
      );
      if (activeCollection?.id === colId) {
        setActiveCollection((prev) => prev ? { ...prev, name: updated.name, description: updated.description } : prev);
      }
    }
    setEditingId(null);
  }

  async function handleDelete(colId: number) {
    setDeletingId(colId);
    try {
      await deleteCollection(colId, userId);
      setCollections((prev) => prev.filter((c) => c.id !== colId));
      if (activeCollection?.id === colId) {
        backToList();
      }
    } catch {
      setError('Failed to delete collection');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  function handleItemRemoved(itemId: string) {
    setActiveCollection((prev) =>
      prev ? { ...prev, items: prev.items.filter((i) => i.id !== itemId) } : prev
    );
    // Update count in list
    setCollections((prev) =>
      prev.map((c) =>
        c.id === activeCollection?.id ? { ...c, itemCount: Math.max(0, c.itemCount - 1) } : c
      )
    );
  }

  /* ── Detail view ── */
  if (view === 'detail') {
    return (
      <Box minH="100vh" bg="gray.950" color="white">
        <Container maxW="4xl" py={8}>
          {/* Back + header */}
          <Flex align="center" gap={3} mb={6}>
            <Button
              size="sm"
              variant="ghost"
              color="gray.400"
              _hover={{ color: 'white', bg: 'gray.800' }}
              onClick={backToList}
            >
              <HStack gap={1.5}>
                <ArrowLeft size={15} />
                <span>Collections</span>
              </HStack>
            </Button>
          </Flex>

          {detailLoading ? (
            <Flex justify="center" py={20}>
              <Spinner size="lg" color="blue.400" />
            </Flex>
          ) : activeCollection ? (
            <>
              <Flex align="flex-start" justify="space-between" gap={4} mb={6}>
                <Box flex={1}>
                  {editingId === activeCollection.id ? (
                    <InlineEdit
                      initialName={activeCollection.name}
                      initialDesc={activeCollection.description ?? ''}
                      onSave={(name, desc) => handleSaveEdit(activeCollection.id, name, desc)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <>
                      <Flex align="center" gap={3} mb={1}>
                        <Bookmark size={22} color="#60a5fa" />
                        <Text fontSize="2xl" fontWeight="black" color="white">
                          {activeCollection.name}
                        </Text>
                      </Flex>
                      {activeCollection.description && (
                        <Text fontSize="sm" color="gray.400" mb={2}>
                          {activeCollection.description}
                        </Text>
                      )}
                      <HStack gap={3}>
                        <Badge bg="blue.900" color="blue.300" borderWidth="1px" borderColor="blue.800" fontSize="xs" px={2} rounded="md">
                          {activeCollection.items.length} {activeCollection.items.length === 1 ? 'item' : 'items'}
                        </Badge>
                        <Text fontSize="xs" color="gray.600">
                          Updated {formatDate(activeCollection.updatedAt)}
                        </Text>
                      </HStack>
                    </>
                  )}
                </Box>

                {editingId !== activeCollection.id && (
                  <HStack gap={2} flexShrink={0}>
                    <Button
                      size="sm"
                      variant="ghost"
                      color="gray.400"
                      _hover={{ color: 'blue.300', bg: 'gray.800' }}
                      onClick={() => setEditingId(activeCollection.id)}
                    >
                      <HStack gap={1.5}>
                        <Edit2 size={14} />
                        <span>Rename</span>
                      </HStack>
                    </Button>
                    {confirmDeleteId === activeCollection.id ? (
                      <HStack gap={1}>
                        <Text fontSize="xs" color="red.400">Delete?</Text>
                        <Button
                          size="xs"
                          colorScheme="red"
                          loading={deletingId === activeCollection.id}
                          onClick={() => handleDelete(activeCollection.id)}
                        >
                          Yes
                        </Button>
                        <Button size="xs" variant="ghost" color="gray.400" onClick={() => setConfirmDeleteId(null)}>
                          No
                        </Button>
                      </HStack>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        color="gray.500"
                        _hover={{ color: 'red.400', bg: 'gray.800' }}
                        onClick={() => setConfirmDeleteId(activeCollection.id)}
                      >
                        <HStack gap={1.5}>
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </HStack>
                      </Button>
                    )}
                  </HStack>
                )}
              </Flex>

              {/* Items */}
              {activeCollection.items.length === 0 ? (
                <Flex
                  direction="column"
                  align="center"
                  gap={4}
                  py={16}
                  color="gray.600"
                >
                  <BookmarkCheck size={40} />
                  <Text fontSize="sm">No items in this collection yet</Text>
                  <Text fontSize="xs" color="gray.700">
                    Use the bookmark button on any item card to save it here
                  </Text>
                </Flex>
              ) : (
                <VStack align="stretch" gap={3}>
                  {activeCollection.items.map((item) => (
                    <CollectionItemRow
                      key={item.id}
                      item={item}
                      sourceName={sourcesMap.get(item.sourceId) ?? item.sourceType}
                      collectionId={activeCollection.id}
                      onRemove={handleItemRemoved}
                    />
                  ))}
                </VStack>
              )}
            </>
          ) : (
            <Text color="gray.500">Collection not found.</Text>
          )}
        </Container>
      </Box>
    );
  }

  /* ── List view ── */
  return (
    <Box minH="100vh" bg="gray.950" color="white">
      <Container maxW="7xl" py={8}>
        {/* Page header */}
        <Flex justify="space-between" align="center" mb={8}>
          <Box>
            <Flex align="center" gap={3} mb={1}>
              <Bookmark size={24} color="#60a5fa" />
              <Text fontSize="2xl" fontWeight="black" color="white">
                Collections
              </Text>
            </Flex>
            <Text fontSize="sm" color="gray.500">
              Save and organise items into named collections
            </Text>
          </Box>

          <Button
            colorScheme="blue"
            size="sm"
            onClick={() => {
              setShowNewForm(true);
              setNewName('');
              setNewDesc('');
            }}
          >
            <HStack gap={2}>
              <Plus size={15} />
              <span>New Collection</span>
            </HStack>
          </Button>
        </Flex>

        {/* Error */}
        {error && (
          <Box
            bg="rgba(220,38,38,0.1)"
            borderWidth="1px"
            borderColor="red.800"
            rounded="lg"
            p={4}
            mb={6}
          >
            <Text color="red.400" fontSize="sm">
              {error}
            </Text>
          </Box>
        )}

        {/* New collection form */}
        {showNewForm && (
          <Box
            bg="gray.800"
            borderWidth="1px"
            borderColor="blue.700"
            rounded="xl"
            p={5}
            mb={6}
          >
            <form onSubmit={handleCreate}>
              <Text fontWeight="semibold" color="blue.300" mb={3} fontSize="sm">
                New Collection
              </Text>
              <VStack align="stretch" gap={3}>
                <Input
                  placeholder="Collection name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
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
                    colorScheme="blue"
                    type="submit"
                    loading={creating}
                    disabled={!newName.trim()}
                  >
                    Create Collection
                  </Button>
                </HStack>
              </VStack>
            </form>
          </Box>
        )}

        {/* Loading */}
        {loading ? (
          <Flex justify="center" py={20}>
            <Spinner size="lg" color="blue.400" />
          </Flex>
        ) : collections.length === 0 ? (
          <Flex
            direction="column"
            align="center"
            gap={5}
            py={20}
            color="gray.600"
          >
            <Bookmark size={52} />
            <Box textAlign="center">
              <Text fontSize="lg" fontWeight="semibold" mb={1} color="gray.500">
                No collections yet
              </Text>
              <Text fontSize="sm">
                Create a collection to start saving items
              </Text>
            </Box>
            <Button
              colorScheme="blue"
              onClick={() => setShowNewForm(true)}
            >
              <HStack gap={2}>
                <Plus size={15} />
                <span>Create your first collection</span>
              </HStack>
            </Button>
          </Flex>
        ) : (
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={4}>
            {collections.map((col) => (
              <CollectionCard
                key={col.id}
                col={col}
                onOpen={openCollection}
                onEdit={(c) => setEditingId(c.id)}
                onDelete={(c) => setConfirmDeleteId(c.id)}
                isEditing={editingId === col.id}
                onSave={(name, desc) => handleSaveEdit(col.id, name, desc)}
                onCancelEdit={() => setEditingId(null)}
              />
            ))}
          </SimpleGrid>
        )}

        {/* Delete confirmation dialog */}
        {confirmDeleteId !== null && editingId !== confirmDeleteId && (
          <>
            <Box
              position="fixed"
              inset={0}
              bg="blackAlpha.700"
              zIndex={1000}
              onClick={() => setConfirmDeleteId(null)}
            />
            <Box
              position="fixed"
              top="50%"
              left="50%"
              transform="translate(-50%, -50%)"
              zIndex={1001}
              bg="gray.900"
              borderWidth="1px"
              borderColor="gray.700"
              rounded="xl"
              p={6}
              w={{ base: '90vw', sm: '380px' }}
              shadow="2xl"
            >
              <Text fontWeight="bold" fontSize="lg" color="white" mb={2}>
                Delete Collection?
              </Text>
              <Text fontSize="sm" color="gray.400" mb={5}>
                This will permanently delete "
                {collections.find((c) => c.id === confirmDeleteId)?.name}" and all its saved items.
                This cannot be undone.
              </Text>
              <HStack gap={3} justify="flex-end">
                <Button
                  variant="ghost"
                  color="gray.400"
                  onClick={() => setConfirmDeleteId(null)}
                >
                  Cancel
                </Button>
                <Button
                  colorScheme="red"
                  loading={deletingId === confirmDeleteId}
                  onClick={() => handleDelete(confirmDeleteId!)}
                >
                  Delete
                </Button>
              </HStack>
            </Box>
          </>
        )}
      </Container>
    </Box>
  );
}
