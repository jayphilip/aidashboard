import { Box, Flex, Text, Heading, Badge, Grid, Link as ChakraLink } from '@chakra-ui/react';
import { Sparkles, ExternalLink } from 'lucide-react';
import type { TrendReport } from '@/contexts/ItemsContext';

interface HermesSummaryProps {
  report: TrendReport;
}

/**
 * Renders the Hermes (OpenRouter) generated "state of AI" summary that the
 * Rust ingestor produced and ElectricSQL synced into the local DB. Shown at
 * the top of the Trends tab.
 */
export default function HermesSummary({ report }: HermesSummaryProps) {
  const narrativeParagraphs = report.narrative
    .split('\n')
    .map(p => p.trim())
    .filter(Boolean);

  return (
    <Box mb={10}>
      {/* Header */}
      <Flex align="center" gap={2} mb={3} wrap="wrap">
        <Sparkles size={20} color="var(--chakra-colors-teal-300)" />
        <Heading size="lg" color="white">
          AI Pulse
        </Heading>
        <Badge colorScheme="teal" ml={1}>
          Hermes summary
        </Badge>
        <Text color="gray.500" fontSize="xs" ml="auto">
          {report.reportDate} · {report.itemsAnalyzed} items analyzed
        </Text>
      </Flex>

      {/* Narrative */}
      <Box
        bgGradient="linear(to-br, teal.900, gray.900)"
        borderWidth="1px"
        borderColor="teal.800"
        rounded="xl"
        p={6}
        mb={6}
      >
        {narrativeParagraphs.length > 0 ? (
          <Flex direction="column" gap={3}>
            {narrativeParagraphs.map((para, i) => (
              <Text key={i} color="gray.200" fontSize="md" lineHeight="tall">
                {para}
              </Text>
            ))}
          </Flex>
        ) : (
          <Text color="gray.400" fontSize="sm">
            No narrative was generated for this report.
          </Text>
        )}
      </Box>

      {/* Themes */}
      {report.themes.length > 0 && (
        <Grid
          templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }}
          gap={4}
        >
          {report.themes.map((theme, i) => (
            <Box
              key={`${theme.name}-${i}`}
              bg="gray.800"
              borderWidth="1px"
              borderColor="gray.700"
              rounded="lg"
              p={4}
              transition="all 0.2s"
              _hover={{ borderColor: 'teal.600', transform: 'translateY(-2px)', shadow: 'lg' }}
            >
              <Flex justify="space-between" align="start" gap={2} mb={2}>
                <Heading size="sm" color="white" lineHeight="short">
                  {theme.name}
                </Heading>
                <Badge colorScheme="teal" fontSize="2xs" flexShrink={0}>
                  {theme.item_count}
                </Badge>
              </Flex>

              {theme.summary && (
                <Text color="gray.400" fontSize="sm" mb={3} lineHeight="base">
                  {theme.summary}
                </Text>
              )}

              {theme.tags?.length > 0 && (
                <Flex wrap="wrap" gap={1} mb={3}>
                  {theme.tags.map(tag => (
                    <Box
                      key={tag}
                      fontSize="2xs"
                      bg="gray.700"
                      color="gray.300"
                      px={2}
                      py={0.5}
                      rounded="full"
                    >
                      {tag}
                    </Box>
                  ))}
                </Flex>
              )}

              {theme.items?.length > 0 && (
                <Flex direction="column" gap={1.5} mt={1}>
                  {theme.items.slice(0, 3).map((item, j) => (
                    <ChakraLink
                      key={`${item.url}-${j}`}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      fontSize="xs"
                      color="teal.300"
                      _hover={{ color: 'teal.200', textDecoration: 'underline' }}
                      display="flex"
                      alignItems="center"
                      gap={1}
                    >
                      <ExternalLink size={11} style={{ flexShrink: 0 }} />
                      <Text as="span" css={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </Text>
                    </ChakraLink>
                  ))}
                </Flex>
              )}
            </Box>
          ))}
        </Grid>
      )}
    </Box>
  );
}
