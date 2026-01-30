import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@chakra-ui/react';
import Layout from './components/Layout';
import TodayPage from './pages/TodayPage';
import SearchPage from './pages/SearchPage';
import TopicsPage from './pages/TopicsPage';
import SourcesPage from './pages/SourcesPage';

function App() {
  return (
    <BrowserRouter>
      <Box minH="100vh" bg="gray.900" color="white">
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route path="/today" element={<TodayPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/topics" element={<TopicsPage />} />
            <Route path="/sources" element={<SourcesPage />} />
          </Routes>
        </Layout>
      </Box>
    </BrowserRouter>
  );
}

export default App;
