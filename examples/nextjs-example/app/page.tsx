'use client';

import { ApolloProvider, ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Container, Typography, Box, Paper } from '@mui/material';
import { EntityForm, EntityTable } from 'simfinity-fe-components';

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'https://your-graphql-endpoint.com/graphql',
});

const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});

const theme = createTheme({
  palette: {
    mode: 'light',
  },
});

export default function HomePage() {
  return (
    <ApolloProvider client={client}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Typography variant="h3" component="h1" gutterBottom>
            Simfinity Components - Next.js Example
          </Typography>
          
          <Typography variant="body1" paragraph>
            This example demonstrates how to use simfinity-fe-components in a Next.js application.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h5" component="h2" gutterBottom>
                Entity Form
              </Typography>
              <EntityForm
                listField="series"
                action="create"
                onSuccess={(data) => console.log('Form submitted:', data)}
                onError={(error) => console.error('Form error:', error)}
              />
            </Paper>

            <Paper sx={{ p: 3 }}>
              <Typography variant="h5" component="h2" gutterBottom>
                Entity Table
              </Typography>
              <EntityTable
                listField="series"
                onRowClick={(id) => console.log('Row clicked:', id)}
              />
            </Paper>
          </Box>
        </Container>
      </ThemeProvider>
    </ApolloProvider>
  );
}
