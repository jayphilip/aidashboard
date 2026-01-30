import { useState, useEffect } from 'react';
import { Input, Flex, Box } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Global keyboard shortcut for search (Cmd/Ctrl+K)
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('global-search') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const shortcutKey = isMac ? '⌘' : 'Ctrl';

  return (
    <form onSubmit={handleSearch}>
      <Box position="relative">
        <Flex
          position="absolute"
          left={3}
          top="50%"
          transform="translateY(-50%)"
          zIndex={2}
          pointerEvents="none"
        >
          <Search size={16} color="var(--chakra-colors-gray-500)" />
        </Flex>
        <Input
          id="global-search"
          type="text"
          placeholder="Search items..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          pl={10}
          pr={16}
          bg="gray.800"
          borderColor="gray.600"
          color="gray.200"
          _placeholder={{ color: 'gray.500' }}
          _hover={{ borderColor: 'gray.500', bg: 'gray.750' }}
          _focus={{
            borderColor: 'blue.500',
            boxShadow: '0 0 0 1px var(--chakra-colors-blue-500)',
            bg: 'gray.800',
          }}
          transition="all 0.2s"
        />
        <Flex
          position="absolute"
          right={3}
          top="50%"
          transform="translateY(-50%)"
          zIndex={2}
          pointerEvents="none"
          gap={0.5}
        >
          <Box
            px={1.5}
            py={0.5}
            bg={isFocused ? 'blue.900' : 'gray.700'}
            borderWidth="1px"
            borderColor={isFocused ? 'blue.600' : 'gray.600'}
            rounded="sm"
            fontSize="xs"
            color={isFocused ? 'blue.200' : 'gray.400'}
            fontWeight="semibold"
            transition="all 0.2s"
          >
            {shortcutKey}
          </Box>
          <Box
            px={1.5}
            py={0.5}
            bg={isFocused ? 'blue.900' : 'gray.700'}
            borderWidth="1px"
            borderColor={isFocused ? 'blue.600' : 'gray.600'}
            rounded="sm"
            fontSize="xs"
            color={isFocused ? 'blue.200' : 'gray.400'}
            fontWeight="semibold"
            transition="all 0.2s"
          >
            K
          </Box>
        </Flex>
      </Box>
    </form>
  );
}
