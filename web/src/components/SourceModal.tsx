import React, { useEffect, useState } from 'react';
import {
  Button,
  Input,
  HStack,
  VStack,
  Textarea,
  Box,
  Text,
  Flex,
  Switch,
  NativeSelect,
} from '@chakra-ui/react';
import type { Source } from '@/lib/sources';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initial?: Partial<Source> | null;
  onSave: (payload: {
    name: string;
    type: string;
    medium: string;
    ingestUrl?: string | null;
    frequency?: string | null;
    active?: boolean;
    meta?: any;
  }) => Promise<void> | void;
};

const SourceModal: React.FC<Props> = ({ isOpen, onClose, initial, onSave }) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState(initial?.type ?? 'rss');
  const [medium, setMedium] = useState(initial?.medium ?? 'paper');
  const [ingestUrl, setIngestUrl] = useState(initial?.ingestUrl ?? '');
  const [frequency, setFrequency] = useState(initial?.frequency ?? '');
  const [active, setActive] = useState<boolean>(initial?.active ?? true);
  const [saving, setSaving] = useState(false);

useEffect(() => {
  if (!isOpen) return;
  setName(initial?.name ?? '');
  setType(initial?.type ?? 'rss');
  setMedium(initial?.medium ?? 'paper');
  setIngestUrl(initial?.ingestUrl ?? '');
  setFrequency(initial?.frequency ?? '');
  setActive(initial?.active ?? true);
}, [initial, isOpen]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        type,
        medium,
        ingestUrl: ingestUrl ? ingestUrl.trim() : null,
        frequency: frequency ? frequency.trim() : null,
        active,
        meta: {},
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Box
      position="fixed"
      inset={0}
      bg="rgba(0,0,0,0.6)"
      zIndex={1400}
      display="flex"
      alignItems="center"
      justifyContent="center"
      onClick={onClose}
    >
      <Box
        bg="gray.900"
        color="white"
        width={{ base: '95%', md: '640px' }}
        borderRadius="md"
        p={6}
        onClick={(e) => e.stopPropagation()}
      >
        <Flex justify="space-between" align="center" mb={4}>
          <Text fontSize="lg" fontWeight="bold">
            {initial ? 'Edit Source' : 'New Source'}
          </Text>
          <Button variant="ghost" onClick={onClose}>
            ×
          </Button>
        </Flex>

        <Box>
          <VStack gap={4} align="stretch">
            <Box>
              <Text fontSize="sm" fontWeight="semibold" mb={2}>
                Name
              </Text>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Box>

            <HStack gap={3}>
              <Box flex={1}>
                <Text fontSize="sm" fontWeight="semibold" mb={2}>
                  Type
                </Text>
                <NativeSelect.Root size="sm" width="100%">
                  <NativeSelect.Field
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="arxiv">arXiv</option>
                    <option value="rss">RSS</option>
                    <option value="twitter_api">Twitter API</option>
                    <option value="manual">Manual</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Box>

              <Box flex={1}>
                <Text fontSize="sm" fontWeight="semibold" mb={2}>
                  Medium
                </Text>
                <NativeSelect.Root size="sm" width="100%">
                  <NativeSelect.Field
                    value={medium}
                    onChange={(e) => setMedium(e.target.value)}
                  >
                    <option value="paper">Paper</option>
                    <option value="newsletter">Newsletter</option>
                    <option value="blog">Blog</option>
                    <option value="tweet">Tweet</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Box>
            </HStack>

            <Box>
              <Text fontSize="sm" fontWeight="semibold" mb={2}>
                Ingest URL
              </Text>
              <Input
                value={ingestUrl ?? ''}
                onChange={(e) => setIngestUrl(e.target.value)}
              />
            </Box>

            <Box>
              <Text fontSize="sm" fontWeight="semibold" mb={2}>
                Frequency
              </Text>
              <Input
                value={frequency ?? ''}
                onChange={(e) => setFrequency(e.target.value)}
                placeholder="e.g., daily, hourly"
              />
            </Box>

            <Flex alignItems="center" gap={3}>
              <Text fontSize="sm" fontWeight="semibold">
                Active
              </Text>
              <Switch.Root
                checked={active}
                colorPalette="blue"
                onCheckedChange={(details) => setActive(details.checked)}
              >
                <Switch.HiddenInput />
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Root>
            </Flex>

            <Box>
              <Text fontSize="sm" fontWeight="semibold" mb={2}>
                Meta (optional)
              </Text>
              <Textarea
                placeholder="Any JSON metadata (not parsed)"
                value=""
                readOnly
              />
            </Box>
          </VStack>
        </Box>

        <Flex justify="flex-end" gap={3} mt={6}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="orange"
            onClick={handleSave}
            loading={saving}
          >
            Save
          </Button>
        </Flex>
      </Box>
    </Box>
  );
};

export default SourceModal;
