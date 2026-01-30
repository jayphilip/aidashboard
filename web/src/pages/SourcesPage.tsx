import { Box, Container, Flex, Text, Heading, Grid, Badge } from '@chakra-ui/react';
import { Settings, Database, Rss, Bell } from 'lucide-react';

export default function SourcesPage() {
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
            <Settings size={56} color="var(--chakra-colors-orange-400)" strokeWidth={1.5} />
          </Box>
          <Box>
            <Heading
              size="lg"
              mb={3}
              bgGradient="linear(to-r, orange.400, yellow.400)"
              bgClip="text"
              fontWeight="black"
            >
              Source Management
            </Heading>
            <Text color="gray.400" fontSize="md" maxW="lg" lineHeight="tall" mb={4}>
              Manage your AI content sources, configure ingestion settings, and customize your feed preferences.
            </Text>
          </Box>

          {/* Feature Preview */}
          <Grid
            templateColumns={{ base: '1fr', md: 'repeat(4, 1fr)' }}
            gap={4}
            w="full"
            maxW="3xl"
            mt={4}
          >
            <Box
              p={4}
              bg="gray.800"
              borderWidth="1px"
              borderColor="gray.700"
              rounded="lg"
            >
              <Database size={24} color="var(--chakra-colors-purple-400)" style={{ marginBottom: '8px' }} />
              <Text fontSize="sm" color="gray.300" fontWeight="semibold" mb={1}>
                Sources
              </Text>
              <Text fontSize="xs" color="gray.500">
                Manage data sources
              </Text>
            </Box>
            <Box
              p={4}
              bg="gray.800"
              borderWidth="1px"
              borderColor="gray.700"
              rounded="lg"
            >
              <Rss size={24} color="var(--chakra-colors-blue-400)" style={{ marginBottom: '8px' }} />
              <Text fontSize="sm" color="gray.300" fontWeight="semibold" mb={1}>
                Feeds
              </Text>
              <Text fontSize="xs" color="gray.500">
                Configure RSS feeds
              </Text>
            </Box>
            <Box
              p={4}
              bg="gray.800"
              borderWidth="1px"
              borderColor="gray.700"
              rounded="lg"
            >
              <Bell size={24} color="var(--chakra-colors-green-400)" style={{ marginBottom: '8px' }} />
              <Text fontSize="sm" color="gray.300" fontWeight="semibold" mb={1}>
                Alerts
              </Text>
              <Text fontSize="xs" color="gray.500">
                Set up notifications
              </Text>
            </Box>
            <Box
              p={4}
              bg="gray.800"
              borderWidth="1px"
              borderColor="gray.700"
              rounded="lg"
            >
              <Settings size={24} color="var(--chakra-colors-orange-400)" style={{ marginBottom: '8px' }} />
              <Text fontSize="sm" color="gray.300" fontWeight="semibold" mb={1}>
                Settings
              </Text>
              <Text fontSize="xs" color="gray.500">
                Customize preferences
              </Text>
            </Box>
          </Grid>

          <Badge colorScheme="orange" variant="subtle" px={3} py={1} rounded="full" fontSize="sm">
            Coming Soon
          </Badge>
        </Flex>
      </Box>
    </Container>
  );
}
