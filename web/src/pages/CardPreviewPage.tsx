import { Box, Container, Heading, Text, VStack } from '@chakra-ui/react';
import CardOption1 from '@/components/CardOption1';
import CardOption2 from '@/components/CardOption2';
import CardOption3 from '@/components/CardOption3';
import CardOption4 from '@/components/CardOption4';
import type { Item } from '@/lib/items';

// Dummy data for preview
const dummyItem: Item = {
  id: 'preview-1',
  title: 'Attention Is All You Need: Transformer Architecture Revolutionizes Deep Learning',
  summary: 'We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train.',
  url: 'https://arxiv.org/abs/1706.03762',
  sourceId: 1,
  sourceType: 'paper',
  publishedAt: new Date('2023-12-15'),
  createdAt: new Date(),
  updatedAt: new Date(),
  body: null,
  searchVector: null,
  topics: ['transformer', 'attention-mechanism', 'neural-networks', 'nlp'],
  rawMetadata: {
    categories: ['cs.CL', 'cs.LG'],
    authors: ['Vaswani et al.'],
  },
};

const dummyItem2: Item = {
  id: 'preview-2',
  title: 'The State of AI in 2024: Trends and Predictions',
  summary: 'A comprehensive overview of the latest developments in artificial intelligence, including breakthrough models, emerging applications, and future directions. This newsletter covers everything from GPT-4 to autonomous agents.',
  url: 'https://example.com/ai-2024',
  sourceId: 2,
  sourceType: 'newsletter',
  publishedAt: new Date('2024-01-20'),
  createdAt: new Date(),
  updatedAt: new Date(),
  body: null,
  searchVector: null,
  topics: ['trends', 'predictions', 'large-language-models'],
  rawMetadata: {
    categories: ['AI News'],
  },
};

const dummyItem3: Item = {
  id: 'preview-3',
  title: 'Building Production-Ready RAG Systems',
  summary: 'Learn how to build robust Retrieval-Augmented Generation systems that can handle real-world workloads. This post covers vector databases, embedding strategies, and optimization techniques.',
  url: 'https://example.com/rag-systems',
  sourceId: 3,
  sourceType: 'blog',
  publishedAt: new Date('2024-02-10'),
  createdAt: new Date(),
  updatedAt: new Date(),
  body: null,
  searchVector: null,
  topics: ['rag', 'embeddings', 'vector-search'],
  rawMetadata: {},
};

export default function CardPreviewPage() {
  return (
    <Container maxW="container.xl" py={8}>
      <VStack gap={12} align="stretch">
        <Box>
          <Heading size="xl" mb={2} color="white">
            Card Design Options
          </Heading>
          <Text color="gray.400" fontSize="lg">
            Choose your preferred card design from the three options below
          </Text>
        </Box>

        {/* Option 1 - Modern Minimal */}
        <Box>
          <Heading size="lg" mb={1} color="blue.300">
            Option 1: Modern Minimal
          </Heading>
          <Text color="gray.400" mb={4} fontSize="sm">
            Clean design with emphasis on typography and whitespace
          </Text>
          <Box h="1px" bg="gray.700" mb={6} />
          <Box display="grid" gridTemplateColumns="repeat(4, 1fr)" gap={4}>
            <CardOption1 item={dummyItem} sourceName="arXiv" />
            <CardOption1 item={dummyItem2} sourceName="AI Weekly" />
            <CardOption1 item={dummyItem3} sourceName="Tech Blog" />
            <CardOption1 item={dummyItem} sourceName="Research Paper" />
          </Box>
        </Box>

        {/* Option 2 - Bold & Colorful */}
        <Box>
          <Heading size="lg" mb={1} color="purple.300">
            Option 2: Bold & Colorful
          </Heading>
          <Text color="gray.400" mb={4} fontSize="sm">
            Vibrant accents with gradient effects and stronger visual hierarchy
          </Text>
          <Box h="1px" bg="gray.700" mb={6} />
          <Box display="grid" gridTemplateColumns="repeat(4, 1fr)" gap={4}>
            <CardOption2 item={dummyItem} sourceName="arXiv" />
            <CardOption2 item={dummyItem2} sourceName="AI Weekly" />
            <CardOption2 item={dummyItem3} sourceName="Tech Blog" />
            <CardOption2 item={dummyItem} sourceName="Research Paper" />
          </Box>
        </Box>

        {/* Option 3 - Compact Dense */}
        <Box>
          <Heading size="lg" mb={1} color="green.300">
            Option 3: Compact & Dense
          </Heading>
          <Text color="gray.400" mb={4} fontSize="sm">
            Information-dense layout with sidebar and horizontal orientation
          </Text>
          <Box h="1px" bg="gray.700" mb={6} />
          <Box display="grid" gridTemplateColumns="repeat(4, 1fr)" gap={4}>
            <CardOption3 item={dummyItem} sourceName="arXiv" />
            <CardOption3 item={dummyItem2} sourceName="AI Weekly" />
            <CardOption3 item={dummyItem3} sourceName="Tech Blog" />
            <CardOption3 item={dummyItem} sourceName="Research Paper" />
          </Box>
        </Box>

        {/* Option 4 - Hybrid Best of Both */}
        <Box>
          <Heading size="lg" mb={1} color="cyan.300">
            Option 4: Hybrid (Recommended)
          </Heading>
          <Text color="gray.400" mb={4} fontSize="sm">
            Combines Option 3's compact layout with Option 2's gradient accents and visual polish
          </Text>
          <Box h="1px" bg="gray.700" mb={6} />
          <Box display="grid" gridTemplateColumns="repeat(4, 1fr)" gap={4}>
            <CardOption4 item={dummyItem} sourceName="arXiv" />
            <CardOption4 item={dummyItem2} sourceName="AI Weekly" />
            <CardOption4 item={dummyItem3} sourceName="Tech Blog" />
            <CardOption4 item={dummyItem} sourceName="Research Paper" />
          </Box>
        </Box>
      </VStack>
    </Container>
  );
}
