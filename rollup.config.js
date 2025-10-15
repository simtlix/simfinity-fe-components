import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import dts from 'rollup-plugin-dts';
import postcss from 'rollup-plugin-postcss';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: packageJson.main,
        format: 'cjs',
        sourcemap: true,
        sourcemapExcludeSources: false,
      },
      {
        file: packageJson.module,
        format: 'esm',
        sourcemap: true,
        sourcemapExcludeSources: false,
      },
    ],
    plugins: [
      peerDepsExternal(),
      resolve({
        browser: true,
      }),
      commonjs(),
      postcss({
        modules: true,
        extract: false,
        inject: true,
        minimize: false, // Debug build - no minification
      }),
      typescript({
        tsconfig: './tsconfig.json',
        exclude: ['**/*.test.*', '**/*.spec.*'],
      }),
    ],
    external: [
      'react',
      'react-dom',
      'urql',
      'graphql-tag',
      '@emotion/react',
      '@emotion/styled',
      '@mui/material',
      '@mui/icons-material',
      '@mui/system',
      '@mui/x-data-grid',
      'graphql',
    ],
  },
  {
    input: 'src/client.tsx',
    output: [
      {
        file: 'dist/client.js',
        format: 'cjs',
        sourcemap: true,
        sourcemapExcludeSources: false,
      },
      {
        file: 'dist/client.esm.js',
        format: 'esm',
        sourcemap: true,
        sourcemapExcludeSources: false,
      },
    ],
    plugins: [
      peerDepsExternal(),
      resolve({
        browser: true,
      }),
      commonjs(),
      postcss({
        modules: true,
        extract: false,
        inject: true,
        minimize: false, // Debug build - no minification
      }),
      typescript({
        tsconfig: './tsconfig.json',
        exclude: ['**/*.test.*', '**/*.spec.*'],
      }),
    ],
    external: [
      'react',
      'react-dom',
      'urql',
      'graphql-tag',
      '@emotion/react',
      '@emotion/styled',
      '@mui/material',
      '@mui/icons-material',
      '@mui/system',
      '@mui/x-data-grid',
      'graphql',
    ],
  },
  {
    input: 'dist/index.d.ts',
    output: [{ file: 'dist/index.d.ts', format: 'esm' }],
    plugins: [dts()],
    external: [/\.css$/],
  },
  {
    input: 'dist/client.d.ts',
    output: [{ file: 'dist/client.d.ts', format: 'esm' }],
    plugins: [dts()],
    external: [/\.css$/],
  },
];
