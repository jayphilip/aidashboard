import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@chakra-ui/react';
import Layout from './components/Layout';
import TodayPage from './pages/TodayPage';
import SearchPage from './pages/SearchPage';
import TopicsPage from './pages/TopicsPage';
import SourcesPage from './pages/SourcesPage';
import CardPreviewPage from './pages/CardPreviewPage';
import CollectionsPage from './pages/CollectionsPage';

function App() {
  return (
    <BrowserRouter>
      <Box minH="100vh" bg="gray.900" color="white" overflowX="clip">
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route path="/today" element={<TodayPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/trends" element={<TopicsPage />} />
            <Route path="/topics" element={<Navigate to="/trends" replace />} />
            <Route path="/sources" element={<SourcesPage />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/card-preview" element={<CardPreviewPage />} />
          </Routes>
        </Layout>
      </Box>
    </BrowserRouter>
  );
}

export default App;
