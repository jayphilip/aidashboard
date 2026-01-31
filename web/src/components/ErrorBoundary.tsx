import React from 'react';
import { Box, Text, Button } from '@chakra-ui/react';

type State = { hasError: boolean; error?: Error | null; info?: React.ErrorInfo | null };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  state: State = { hasError: false, error: null, info: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Could send to telemetry here
    this.setState({ error, info });
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught error', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children as React.ReactElement;

    return (
      <Box p={6} bg="red.900" color="white" borderRadius="md">
        <Text fontSize="lg" fontWeight="bold" mb={2}>An error occurred</Text>
        <Text mb={3}>{this.state.error?.message}</Text>
        <Box as="pre" whiteSpace="pre-wrap" fontSize="xs" maxH="40vh" overflowY="auto" mb={3}>
          {this.state.info?.componentStack}
        </Box>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </Box>
    );
  }
}
