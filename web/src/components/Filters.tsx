import { useState, useEffect } from 'react';
import {
  Box,
  Stack,
  Text,
  Button,
  Input,
  Flex,
  Badge,
} from '@chakra-ui/react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { getAllTopics } from '@/lib/items';
import { getActiveSources } from '@/lib/sources';
import type { Source } from '@/lib/sources';

export interface FilterOptions {
  sourceTypes: string[];
  topics: string[];
  sourceIds: number[];
  dateRange: {
    start: string | null;
    end: string | null;
  };
  readStatus?: 'all' | 'read' | 'unread';
}

interface FiltersProps {
  onFilterChange: (filters: FilterOptions) => void;
  initialFilters?: Partial<FilterOptions>;
}

const SOURCE_TYPES = [
  { value: 'paper', label: 'Papers', icon: '📄' },
  { value: 'newsletter', label: 'Newsletters', icon: '📧' },
  { value: 'blog', label: 'Blogs', icon: '✍️' },
  { value: 'tweet', label: 'Tweets', icon: '🐦' },
];

export default function Filters({ onFilterChange, initialFilters }: FiltersProps) {
  const [isOpen, setIsOpen] = useState(true);

  const [sourceTypes, setSourceTypes] = useState<string[]>(
    initialFilters?.sourceTypes || []
  );
  const [selectedTopics, setSelectedTopics] = useState<string[]>(
    initialFilters?.topics || []
  );
  const [selectedSourceIds, setSelectedSourceIds] = useState<number[]>(
    initialFilters?.sourceIds || []
  );
  const [dateStart, setDateStart] = useState<string>(
    initialFilters?.dateRange?.start || ''
  );
  const [dateEnd, setDateEnd] = useState<string>(
    initialFilters?.dateRange?.end || ''
  );
  const [readStatus, setReadStatus] = useState<'all' | 'read' | 'unread'>(
    initialFilters?.readStatus || 'all'
  );
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [availableSources, setAvailableSources] = useState<Source[]>([]);

  // Load available topics and sources
  useEffect(() => {
    async function loadFilters() {
      const [topics, sources] = await Promise.all([
        getAllTopics(),
        getActiveSources(),
      ]);
      setAvailableTopics(topics);
      setAvailableSources(sources);
    }
    loadFilters();
  }, []);

  // Notify parent of filter changes
  useEffect(() => {
    onFilterChange({
      sourceTypes,
      topics: selectedTopics,
      sourceIds: selectedSourceIds,
      dateRange: {
        start: dateStart || null,
        end: dateEnd || null,
      },
      readStatus,
    });
  }, [sourceTypes, selectedTopics, selectedSourceIds, dateStart, dateEnd, readStatus, onFilterChange]);

  const handleClearFilters = () => {
    setSourceTypes([]);
    setSelectedTopics([]);
    setSelectedSourceIds([]);
    setDateStart('');
    setDateEnd('');
    setReadStatus('all');
  };

  const toggleSourceType = (value: string) => {
    setSourceTypes(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const toggleTopic = (topic: string) => {
    setSelectedTopics(prev =>
      prev.includes(topic)
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    );
  };

  const toggleSource = (sourceId: number) => {
    setSelectedSourceIds(prev =>
      prev.includes(sourceId)
        ? prev.filter(id => id !== sourceId)
        : [...prev, sourceId]
    );
  };

  // Filter sources based on selected source types
  const filteredSources = sourceTypes.length > 0
    ? availableSources.filter(source =>
        sourceTypes.some(type => {
          // Map source types to source.type or source.medium values
          if (type === 'paper') return source.type === 'arxiv' || source.medium === 'paper';
          if (type === 'newsletter') return source.type === 'rss' && source.medium === 'newsletter';
          if (type === 'blog') return source.type === 'rss' && source.medium === 'blog';
          if (type === 'tweet') return source.type === 'twitter_api';
          return false;
        })
      )
    : availableSources;

  // Automatically deselect sources that are no longer visible due to source type filtering
  useEffect(() => {
    if (sourceTypes.length > 0) {
      const filteredSourceIds = new Set(filteredSources.map(s => s.id));
      const newSelectedSourceIds = selectedSourceIds.filter(id => filteredSourceIds.has(id));

      // Only update if there's a change to avoid infinite loops
      if (newSelectedSourceIds.length !== selectedSourceIds.length) {
        setSelectedSourceIds(newSelectedSourceIds);
      }
    }
  }, [sourceTypes, filteredSources, selectedSourceIds]);

  const activeFilterCount =
    sourceTypes.length +
    selectedTopics.length +
    selectedSourceIds.length +
    (dateStart || dateEnd ? 1 : 0) +
    (readStatus !== 'all' ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  return (
    <Box
      bg="gray.900"
      borderWidth="1px"
      borderColor="gray.700"
      rounded="lg"
      overflow="hidden"
      mb={6}
      transition="all 0.2s"
      _hover={isOpen ? { borderColor: 'gray.600' } : undefined}
    >
      {/* Header */}
      <Flex
        justify="space-between"
        align="center"
        p={4}
        bg={hasActiveFilters ? 'blue.950' : 'transparent'}
        borderBottomWidth={isOpen ? '1px' : '0'}
        borderColor="gray.700"
        transition="all 0.2s"
      >
        <Flex gap={3} align="center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            color={hasActiveFilters ? 'blue.200' : 'gray.300'}
            _hover={{ bg: 'gray.800', color: 'white' }}
            fontWeight="semibold"
          >
            <Flex gap={2} align="center">
              {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              <Text>Filters</Text>
            </Flex>
          </Button>
          {hasActiveFilters && (
            <Badge
              colorScheme="blue"
              variant="solid"
              rounded="full"
              px={2.5}
              py={0.5}
              fontSize="xs"
              fontWeight="bold"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Flex>
        {hasActiveFilters && (
          <Button
            size="sm"
            variant="ghost"
            color="gray.400"
            onClick={handleClearFilters}
            _hover={{ bg: 'gray.800', color: 'red.300' }}
          >
            <Flex gap={2} align="center">
              <Text>Clear all</Text>
              <X size={14} />
            </Flex>
          </Button>
        )}
      </Flex>

      {/* Filter Content */}
      {isOpen && (
        <Box p={4}>
          <Stack gap={6}>
            {/* Source Types */}
            <Box>
              <Text
                color="gray.400"
                fontSize="xs"
                mb={3}
                fontWeight="bold"
                textTransform="uppercase"
                letterSpacing="wide"
              >
                Source Type
              </Text>
              <Flex gap={3} wrap="wrap">
                {SOURCE_TYPES.map((type) => (
                  <Flex
                    key={type.value}
                    as="label"
                    align="center"
                    gap={2}
                    cursor="pointer"
                    px={3}
                    py={2}
                    rounded="md"
                    bg={sourceTypes.includes(type.value) ? 'blue.900' : 'gray.800'}
                    borderWidth="1px"
                    borderColor={sourceTypes.includes(type.value) ? 'blue.600' : 'gray.700'}
                    _hover={{
                      bg: sourceTypes.includes(type.value) ? 'blue.800' : 'gray.750',
                      borderColor: sourceTypes.includes(type.value) ? 'blue.500' : 'gray.600',
                    }}
                    transition="all 0.2s"
                  >
                    <input
                      type="checkbox"
                      checked={sourceTypes.includes(type.value)}
                      onChange={() => toggleSourceType(type.value)}
                      style={{
                        width: '16px',
                        height: '16px',
                        cursor: 'pointer',
                        accentColor: 'var(--chakra-colors-blue-500)',
                      }}
                    />
                    <Text fontSize="sm" color="gray.200" fontWeight="medium">
                      {type.icon} {type.label}
                    </Text>
                  </Flex>
                ))}
              </Flex>
            </Box>

            {/* Sources */}
            {filteredSources.length > 0 && (
              <Box>
                <Flex align="center" justify="space-between" mb={3}>
                  <Text
                    color="gray.400"
                    fontSize="xs"
                    fontWeight="bold"
                    textTransform="uppercase"
                    letterSpacing="wide"
                  >
                    Sources
                  </Text>
                  {sourceTypes.length > 0 && (
                    <Text color="gray.500" fontSize="xs" fontStyle="italic">
                      {filteredSources.length} of {availableSources.length}
                    </Text>
                  )}
                </Flex>
                <Flex gap={2.5} wrap="wrap" maxH="200px" overflowY="auto" css={{
                  '&::-webkit-scrollbar': {
                    width: '8px',
                  },
                  '&::-webkit-scrollbar-track': {
                    background: 'var(--chakra-colors-gray-800)',
                    borderRadius: '4px',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    background: 'var(--chakra-colors-gray-600)',
                    borderRadius: '4px',
                  },
                  '&::-webkit-scrollbar-thumb:hover': {
                    background: 'var(--chakra-colors-gray-500)',
                  },
                }}>
                  {filteredSources.map((source) => (
                    <Flex
                      key={source.id}
                      as="label"
                      align="center"
                      gap={2}
                      cursor="pointer"
                      px={3}
                      py={1.5}
                      rounded="md"
                      bg={selectedSourceIds.includes(source.id) ? 'blue.900' : 'gray.800'}
                      borderWidth="1px"
                      borderColor={selectedSourceIds.includes(source.id) ? 'blue.600' : 'gray.700'}
                      _hover={{
                        bg: selectedSourceIds.includes(source.id) ? 'blue.800' : 'gray.750',
                        borderColor: selectedSourceIds.includes(source.id) ? 'blue.500' : 'gray.600',
                      }}
                      transition="all 0.2s"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSourceIds.includes(source.id)}
                        onChange={() => toggleSource(source.id)}
                        style={{
                          width: '14px',
                          height: '14px',
                          cursor: 'pointer',
                          accentColor: 'var(--chakra-colors-blue-500)',
                        }}
                      />
                      <Text fontSize="sm" color="gray.200">
                        {source.name}
                      </Text>
                    </Flex>
                  ))}
                </Flex>
              </Box>
            )}

            {/* Topics */}
            {availableTopics.length > 0 && (
              <Box>
                <Text
                  color="gray.400"
                  fontSize="xs"
                  mb={3}
                  fontWeight="bold"
                  textTransform="uppercase"
                  letterSpacing="wide"
                >
                  Topics
                </Text>
                <Flex gap={2.5} wrap="wrap">
                  {availableTopics.slice(0, 10).map((topic) => (
                    <Flex
                      key={topic}
                      as="label"
                      align="center"
                      gap={2}
                      cursor="pointer"
                      px={3}
                      py={1.5}
                      rounded="md"
                      bg={selectedTopics.includes(topic) ? 'blue.900' : 'gray.800'}
                      borderWidth="1px"
                      borderColor={selectedTopics.includes(topic) ? 'blue.600' : 'gray.700'}
                      _hover={{
                        bg: selectedTopics.includes(topic) ? 'blue.800' : 'gray.750',
                        borderColor: selectedTopics.includes(topic) ? 'blue.500' : 'gray.600',
                      }}
                      transition="all 0.2s"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTopics.includes(topic)}
                        onChange={() => toggleTopic(topic)}
                        style={{
                          width: '14px',
                          height: '14px',
                          cursor: 'pointer',
                          accentColor: 'var(--chakra-colors-blue-500)',
                        }}
                      />
                      <Text fontSize="sm" color="gray.200">
                        {topic}
                      </Text>
                    </Flex>
                  ))}
                </Flex>
                {availableTopics.length > 10 && (
                  <Text color="gray.600" fontSize="xs" mt={2} fontStyle="italic">
                    Showing top 10 topics
                  </Text>
                )}
              </Box>
            )}

            {/* Read Status */}
            <Box>
              <Text
                color="gray.400"
                fontSize="xs"
                mb={3}
                fontWeight="bold"
                textTransform="uppercase"
                letterSpacing="wide"
              >
                Read Status
              </Text>
              <Flex gap={3} wrap="wrap">
                {[
                  { value: 'all', label: 'All Items' },
                  { value: 'unread', label: 'Unread Only' },
                  { value: 'read', label: 'Read Only' },
                ].map((status) => (
                  <Button
                    key={status.value}
                    size="sm"
                    onClick={() => setReadStatus(status.value as 'all' | 'read' | 'unread')}
                    bg={readStatus === status.value ? 'blue.900' : 'gray.800'}
                    color="gray.200"
                    borderWidth="1px"
                    borderColor={readStatus === status.value ? 'blue.600' : 'gray.700'}
                    _hover={{
                      bg: readStatus === status.value ? 'blue.800' : 'gray.750',
                      borderColor: readStatus === status.value ? 'blue.500' : 'gray.600',
                    }}
                    transition="all 0.2s"
                  >
                    {status.label}
                  </Button>
                ))}
              </Flex>
            </Box>

            {/* Date Range */}
            <Box>
              <Text
                color="gray.400"
                fontSize="xs"
                mb={3}
                fontWeight="bold"
                textTransform="uppercase"
                letterSpacing="wide"
              >
                Date Range
              </Text>
              <Flex gap={3} direction={{ base: 'column', sm: 'row' }}>
                <Box flex={1}>
                  <Text color="gray.500" fontSize="xs" mb={1.5} fontWeight="medium">
                    From
                  </Text>
                  <Input
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                    size="sm"
                    bg="gray.800"
                    borderColor="gray.600"
                    color="gray.300"
                    _hover={{ borderColor: 'gray.500' }}
                    _focus={{
                      borderColor: 'blue.500',
                      boxShadow: '0 0 0 1px var(--chakra-colors-blue-500)',
                    }}
                  />
                </Box>
                <Box flex={1}>
                  <Text color="gray.500" fontSize="xs" mb={1.5} fontWeight="medium">
                    To
                  </Text>
                  <Input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                    size="sm"
                    bg="gray.800"
                    borderColor="gray.600"
                    color="gray.300"
                    _hover={{ borderColor: 'gray.500' }}
                    _focus={{
                      borderColor: 'blue.500',
                      boxShadow: '0 0 0 1px var(--chakra-colors-blue-500)',
                    }}
                  />
                </Box>
              </Flex>
            </Box>
          </Stack>
        </Box>
      )}
    </Box>
  );
}
