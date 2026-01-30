import { ReactNode } from 'react';
import { Box } from '@chakra-ui/react';
import { UserProvider } from '@/contexts/UserContext';
import { ItemsProvider } from '@/contexts/ItemsContext';
import Navigation from './Navigation';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <UserProvider>
      <ItemsProvider>
        <Box minH="100vh" bg="gray.950">
          <Navigation />
          {children}
        </Box>
      </ItemsProvider>
    </UserProvider>
  );
}
