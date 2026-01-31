'use client';

import React, { useEffect, useState } from 'react';
import {
  VStack,
  HStack,
  Button,
  useDisclosure,
  Box,
  Container,
  Flex,
  Heading,
  Text,
  Badge,
  Grid,
  SimpleGrid,
  Spinner,
  Switch as ChakraSwitch,
} from '@chakra-ui/react';
import {
  Database,
  Rss,
  FileText,
  MessageSquare,
  AlertCircle,
  Newspaper,
  Link as LinkIcon,
  Plus,
  Edit,
  Trash2,
} from 'lucide-react';
import {
  getAllSources,
  createSource,
  updateSource,
  toggleSourceActive,
  deleteSource,
  type Source,
} from '@/lib/sources';
import SourceModal from '@/components/SourceModal';
import ErrorBoundary from '@/components/ErrorBoundary';

const SOURCE_TYPE_ICONS: Record<string, React.ComponentType<any>> = {
  arxiv: Newspaper,
  rss: Rss,
  twitter_api: MessageSquare,
  manual: FileText,
};

const SOURCE_TYPE_COLORS: Record<string, string> = {
  arxiv: 'purple',
  rss: 'blue',
  twitter_api: 'cyan',
  manual: 'orange',
};

const MEDIUM_COLORS: Record<string, string> = {
  paper: 'purple',
  newsletter: 'green',
  blog: 'orange',
  tweet: 'blue',
};

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const disclosure = useDisclosure();
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reloadSources() {
    try {
      setIsLoading(true);
      setError(null);
      const allSources = await getAllSources();
      setSources(allSources);
    } catch (err) {
      console.error('Failed to load sources:', err);
      setError((err as Error)?.message ?? String(err));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void reloadSources();
  }, []);

  return (
    <ErrorBoundary>
      <Box minH="100vh" bg="gray.950" color="white">
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
                bgGradient="linear(to-r, orange.400, yellow.400)"
                bgClip="text"
                fontWeight="black"
                letterSpacing="tight"
              >
                Content Sources
              </Heading>
              <Text color="gray.400" fontSize="lg" maxW="2xl">
                Your configured AI content sources and ingestion endpoints
              </Text>
            </Flex>
          </Container>
        </Box>

        <Container maxW="7xl" pb={12}>
          <Flex justify="flex-end" mb={6}>
            <Button
              colorScheme="orange"
              onClick={() => {
                setSelectedSource(null);
                disclosure.onOpen();
              }}
            >
              <HStack gap={2} align="center">
                <Plus size={16} />
                <span>New Source</span>
              </HStack>
            </Button>
          </Flex>

          {error && (
            <Box
              bg="rgba(220, 38, 38, 0.1)"
              borderWidth="1px"
              borderColor="red.800"
              rounded="lg"
              p={6}
              mb={8}
            >
              <Flex gap={3} align="flex-start">
                <AlertCircle
                  size={24}
                  color="var(--chakra-colors-red-400)"
                />
                <Box>
                  <Text
                    color="red.400"
                    fontWeight="semibold"
                    mb={1}
                  >
                    Error Loading Sources
                  </Text>
                  <Text color="red.300" fontSize="sm">
                    {error}
                  </Text>
                </Box>
              </Flex>
            </Box>
          )}

          {isLoading && !error && (
            <Flex justify="center" py={16}>
              <Flex direction="column" align="center" gap={3}>
                <Spinner size="lg" color="orange.400" borderWidth="3px" />
                <Text color="gray.500" fontSize="sm">
                  Loading sources...
                </Text>
              </Flex>
            </Flex>
          )}

          {!isLoading && !error && sources.length > 0 && (
            <Grid
              templateColumns={{
                base: '1fr',
                md: 'repeat(2, 1fr)',
                xl: 'repeat(3, 1fr)',
              }}
              gap={6}
            >
              {sources.map((source) => {
                const TypeIcon =
                  SOURCE_TYPE_ICONS[source.type] || Database;
                const typeColor =
                  SOURCE_TYPE_COLORS[source.type] || 'gray';
                const mediumColor =
                  MEDIUM_COLORS[source.medium] || 'gray';

                return (
                  <Box
                    key={source.id}
                    bg="gray.900"
                    borderWidth="1px"
                    borderColor="gray.700"
                    rounded="lg"
                    p={6}
                    _hover={{
                      borderColor: 'gray.600',
                      transform: 'translateY(-2px)',
                      shadow: 'lg',
                    }}
                    transition="all 0.2s"
                  >
                    <VStack align="stretch" gap={4}>
                      <Flex
                        align="flex-start"
                        justify="space-between"
                      >
                        <Flex align="center" gap={3} flex={1}>
                          <Box
                            p={2.5}
                            bg="gray.800"
                            rounded="lg"
                            borderWidth="1px"
                            borderColor="gray.700"
                          >
                            <TypeIcon
                              size={20}
                              color="var(--chakra-colors-gray-400)"
                            />
                          </Box>
                          <Box flex={1}>
                            <Text
                              color="gray.100"
                              fontWeight="bold"
                              fontSize="lg"
                              mb={1}
                            >
                              {source.name}
                            </Text>
                            <HStack gap={2}>
                              <Badge
                                colorScheme={typeColor}
                                variant="subtle"
                                fontSize="xs"
                              >
                                {source.type}
                              </Badge>
                              <Badge
                                colorScheme={mediumColor}
                                variant="subtle"
                                fontSize="xs"
                              >
                                {source.medium}
                              </Badge>
                            </HStack>
                          </Box>
                        </Flex>
                      </Flex>

                      <SimpleGrid columns={1} gap={3}>
                        {source.ingestUrl && (
                          <Box>
                            <Flex
                              align="center"
                              gap={2}
                              mb={1}
                            >
                              <LinkIcon
                                size={14}
                                color="var(--chakra-colors-gray-500)"
                              />
                              <Text
                                color="gray.500"
                                fontSize="xs"
                                fontWeight="semibold"
                                textTransform="uppercase"
                              >
                                Ingest URL
                              </Text>
                            </Flex>
                            <Text
                              color="blue.400"
                              fontSize="sm"
                              title={source.ingestUrl}
                            >
                              {source.ingestUrl}
                            </Text>
                          </Box>
                        )}
                        {source.frequency && (
                          <Box>
                            <Text
                              color="gray.500"
                              fontSize="xs"
                              fontWeight="semibold"
                              textTransform="uppercase"
                              mb={1}
                            >
                              Frequency
                            </Text>
                            <Text
                              color="gray.300"
                              fontSize="sm"
                            >
                              {source.frequency}
                            </Text>
                          </Box>
                        )}
                                                <HStack align="center" gap={2}>
                          <Badge
                            colorScheme={
                              source.active ? 'green' : 'gray'
                            }
                            variant="subtle"
                            fontSize="xs"
                          >
                            {source.active ? 'Active' : 'Inactive'}
                          </Badge>

                          <ChakraSwitch.Root
                            checked={!!source.active}
                            colorPalette="blue"
 onCheckedChange={async (details) => {
    const next = details.checked;

    // optimistic local update, no loading spinner
    setSources((prev) =>
      prev.map((s) =>
        s.id === source.id ? { ...s, active: next } : s,
      ),
    );

    try {
      await toggleSourceActive(source.id, next);
      // optional: silent refresh without touching isLoading
      // void reloadSources();
    } catch (err) {
      console.error('Failed to toggle active:', err);
      // rollback on error
      setSources((prev) =>
        prev.map((s) =>
          s.id === source.id ? { ...s, active: !next } : s,
        ),
      );
    }
  }}
                          >
                            <ChakraSwitch.HiddenInput />
                            <ChakraSwitch.Control>
                              <ChakraSwitch.Thumb />
                            </ChakraSwitch.Control>
                          </ChakraSwitch.Root>

                          <Button
                            aria-label="edit"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedSource(source);
                              disclosure.onOpen();
                            }}
                          >
                            <Edit size={16} />
                          </Button>
                          <Button
                            aria-label="delete"
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              // eslint-disable-next-line no-restricted-globals
                              const ok = confirm(
                                `Delete source "${source.name}"? This cannot be undone.`,
                              );
                              if (!ok) return;
                              try {
                                await deleteSource(source.id);
                                void reloadSources();
                              } catch (err) {
                                console.error(
                                  'Failed to delete source:',
                                  err,
                                );
                              }
                            }}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </HStack>
                      </SimpleGrid>

                      <Flex
                        justify="space-between"
                        pt={2}
                        borderTopWidth="1px"
                        borderColor="gray.800"
                      >
                        <Text
                          color="gray.600"
                          fontSize="xs"
                        >
                          ID: {source.id}
                        </Text>
                        <Text
                          color="gray.600"
                          fontSize="xs"
                        >
                          Updated{' '}
                          {new Date(
                            source.updatedAt,
                          ).toLocaleDateString()}
                        </Text>
                      </Flex>
                    </VStack>
                  </Box>
                );
              })}
            </Grid>
          )}

          {!isLoading && !error && sources.length === 0 && (
            <Box
              bg="gray.900"
              borderWidth="1px"
              borderColor="gray.700"
              rounded="lg"
              p={16}
              textAlign="center"
            >
              <Flex
                direction="column"
                align="center"
                gap={4}
              >
                <Box p={5} bg="gray.800" rounded="full">
                  <Database
                    size={48}
                    color="var(--chakra-colors-gray-500)"
                  />
                </Box>
                <Box>
                  <Text
                    color="gray.300"
                    fontSize="lg"
                    fontWeight="semibold"
                    mb={2}
                  >
                    No sources configured
                  </Text>
                  <Text
                    color="gray.500"
                    fontSize="sm"
                    maxW="md"
                  >
                    Configure sources in the database to start ingesting AI
                    content
                  </Text>
                </Box>
              </Flex>
            </Box>
          )}
        </Container>

        <SourceModal
          isOpen={disclosure.open}
          onClose={() => {
            disclosure.onClose();
            setSelectedSource(null);
          }}
          initial={selectedSource ?? undefined}
          onSave={async (payload) => {
            try {
              if (selectedSource) {
                await updateSource(selectedSource.id, payload as any);
              } else {
                await createSource(payload as any);
              }
              await reloadSources();
            } catch (err) {
              console.error('Failed to save source:', err);
              throw err;
            }
          }}
        />
      </Box>
    </ErrorBoundary>
  );
}
