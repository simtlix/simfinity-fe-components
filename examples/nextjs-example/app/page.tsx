'use client';

import { Container, Typography, Box, Paper } from '@mui/material';
import { EntityForm, EntityTable } from 'simfinity-fe-components';
import { SimfinityWrapper } from '@/components/simfinity-wrapper';

export default function HomePage() {
  return (
    <SimfinityWrapper>
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
    </SimfinityWrapper>
  );
}
