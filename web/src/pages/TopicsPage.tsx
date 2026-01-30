import { Box, Container, Flex, Text, Heading, Badge, Grid } from '@chakra-ui/react';
import { TrendingUp, BarChart3 } from 'lucide-react';

export default function TopicsPage() {
  return (
    <Container maxW="6xl" py={12}>
      <Box
        bg="gray.900"
        borderWidth="1px"
        borderColor="gray.700"
        rounded="lg"
        p={16}
        textAlign="center"
      >
        <Flex direction="column" align="center" gap={6}>
          <Box p={5} bg="gray.800" rounded="full" borderWidth="2px" borderColor="gray.600">
            <TrendingUp size={56} color="var(--chakra-colors-green.400)" strokeWidth={1.5} />
          </Box>
          <Box>
            <Heading
              size="lg"
              mb={3}
              bgGradient="linear(to-r, green.400, teal.400)"
              bgClip="text"
              fontWeight="black"
            >
              Trends & Analytics
            </Heading>
            <Text color="gray.400" fontSize="md" maxW="lg" lineHeight="tall" mb={4}>
              Discover trending AI topics, popular research areas, and emerging themes in artificial intelligence.
            </Text>
          </Box>

          {/* Feature Preview */}
          <Grid
            templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }}
            gap={4}
            w="full"
            maxW="2xl"
            mt={4}
          >
            <Box
              p={4}
              bg="gray.800"
              borderWidth="1px"
              borderColor="gray.700"
              rounded="lg"
            >
              <BarChart3 size={24} color="var(--chakra-colors-blue-400)" style={{ marginBottom: '8px' }} />
              <Text fontSize="sm" color="gray.300" fontWeight="semibold" mb={1}>
                Topic Trends
              </Text>
              <Text fontSize="xs" color="gray.500">
                Visualize trending topics over time
              </Text>
            </Box>
            <Box
              p={4}
              bg="gray.800"
              borderWidth="1px"
              borderColor="gray.700"
              rounded="lg"
            >
              <TrendingUp size={24} color="var(--chakra-colors-green-400)" style={{ marginBottom: '8px' }} />
              <Text fontSize="sm" color="gray.300" fontWeight="semibold" mb={1}>
                Hot Topics
              </Text>
              <Text fontSize="xs" color="gray.500">
                Most discussed AI themes
              </Text>
            </Box>
            <Box
              p={4}
              bg="gray.800"
              borderWidth="1px"
              borderColor="gray.700"
              rounded="lg"
            >
              <Box mb={2}>
                <Badge colorScheme="purple" fontSize="xs">NEW</Badge>
              </Box>
              <Text fontSize="sm" color="gray.300" fontWeight="semibold" mb={1}>
                Emerging Areas
              </Text>
              <Text fontSize="xs" color="gray.500">
                Discover new research areas
              </Text>
            </Box>
          </Grid>

          <Badge colorScheme="green" variant="subtle" px={3} py={1} rounded="full" fontSize="sm">
            Coming Soon
          </Badge>
        </Flex>
      </Box>
    </Container>
  );
}
