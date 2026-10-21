import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './baseline',
  schema: './src/db/schema.js',
  dialect: 'postgresql',
});
