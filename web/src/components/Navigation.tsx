import { Box, Flex, Link as ChakraLink, Heading, Container } from '@chakra-ui/react';
import { Link, useLocation } from 'react-router-dom';
import { Newspaper, TrendingUp, Settings } from 'lucide-react';
import SearchBar from './SearchBar';

export default function Navigation() {
  const location = useLocation();

  const NavLink = ({ to, children, icon: Icon }: { to: string; children: React.ReactNode; icon: any }) => {
    const isActive = location.pathname === to;
    return (
      <ChakraLink
        as={Link}
        to={to}
        px={4}
        py={2}
        rounded="lg"
        fontSize="sm"
        fontWeight="semibold"
        bg={isActive ? 'blue.600' : 'transparent'}
        color={isActive ? 'white' : 'gray.400'}
        display="flex"
        alignItems="center"
        gap={2}
        _hover={{
          bg: isActive ? 'blue.500' : 'gray.800',
          color: 'white',
          textDecoration: 'none',
          transform: 'translateY(-1px)',
        }}
        _active={{
          transform: 'translateY(0)',
        }}
        transition="all 0.2s"
      >
        <Icon size={16} />
        {children}
      </ChakraLink>
    );
  };

  return (
    <Box
      as="nav"
      bg="gray.900"
      borderBottomWidth="1px"
      borderColor="gray.700"
      position="sticky"
      top={0}
      zIndex={10}
      boxShadow="sm"
    >
      <Container maxW="7xl" px={{ base: 4, sm: 6 }} py={{ base: 3, sm: 4 }}>
        <Flex
          direction={{ base: 'column', md: 'row' }}
          align={{ base: 'stretch', md: 'center' }}
          justify={{ base: 'flex-start', md: 'space-between' }}
          gap={{ base: 3, md: 6 }}
        >
          {/* Logo/Title */}
          <Heading
            as={Link}
            to="/"
            size="lg"
            bgGradient="linear(to-r, blue.400, cyan.400)"
            bgClip="text"
            _hover={{ textDecoration: 'none', opacity: 0.8 }}
            transition="opacity 0.2s"
            flexShrink={0}
            fontWeight="black"
            letterSpacing="tight"
          >
            🤖 AI Dashboard
          </Heading>

          {/* Search bar */}
          <Box flex={1} maxW={{ base: 'full', md: '400px' }} order={{ base: 3, md: 2 }}>
            <SearchBar />
          </Box>

          {/* Navigation links */}
          <Flex gap={2} flexShrink={0} order={{ base: 2, md: 3 }}>
            <NavLink to="/today" icon={Newspaper}>Today</NavLink>
            <NavLink to="/topics" icon={TrendingUp}>Trends</NavLink>
            <NavLink to="/sources" icon={Settings}>Sources</NavLink>
          </Flex>
        </Flex>
      </Container>
    </Box>
  );
}
