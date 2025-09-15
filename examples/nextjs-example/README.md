# Next.js Example with Simfinity Components

This example demonstrates how to integrate `simfinity-fe-components` with a Next.js application.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set up Environment Variables
Create a `.env.local` file:
```env
NEXT_PUBLIC_GRAPHQL_ENDPOINT=https://your-graphql-endpoint.com/graphql
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Open in Browser
Visit [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
nextjs-example/
├── app/
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Main page with Simfinity components
│   └── globals.css         # Global styles
├── next.config.js          # Next.js configuration
├── package.json            # Dependencies
└── README.md              # This file
```

## 🔧 Key Configuration

### next.config.js
- `transpilePackages`: Tells Next.js to transpile the simfinity-fe-components package
- `esmExternals: 'loose'`: Helps with ESM module resolution
- `webpack.extensionAlias`: Handles file extension resolution

### app/page.tsx
- Uses `'use client'` directive for client-side components
- Wraps components with ApolloProvider and ThemeProvider
- Demonstrates both EntityForm and EntityTable usage

## 🎯 Features Demonstrated

- ✅ Apollo Client integration
- ✅ Material-UI theming
- ✅ EntityForm component
- ✅ EntityTable component
- ✅ TypeScript support
- ✅ Next.js App Router

## 🐛 Troubleshooting

### Module Resolution Issues
If you encounter module resolution errors:
1. Make sure `transpilePackages` includes 'simfinity-fe-components'
2. Check that the package is properly installed
3. Restart the development server

### Styling Issues
If components don't look right:
1. Ensure CssBaseline is included
2. Check that ThemeProvider wraps your components
3. Verify Material-UI dependencies are installed

### Apollo Client Issues
If GraphQL queries fail:
1. Check your GraphQL endpoint URL
2. Verify network connectivity
3. Check browser console for errors
