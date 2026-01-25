// web/src/lib/schema.ts
import {
  pgTable,
  uuid,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// If you want stricter typing for arrays you can also use $type<string[]>()
export const papers = pgTable('papers', {
  id: uuid('id').primaryKey().notNull(),

  source: text('source').notNull(),
  externalId: text('external_id').notNull(),

  title: text('title').notNull(),

  // stored as text[] in Postgres
  authors: text('authors').array().notNull(),          // string[]
  // stored as text or text[] depending on your migration; using array here
  categories: text('categories').array().notNull(),    // string[]

  abstract: text('abstract'),                          // nullable

  publishedAt: timestamp('published_at', {
    mode: 'date', // maps to JS Date
  }).notNull(),

  url: text('url'),
  pdfUrl: text('pdf_url'),

  createdAt: timestamp('created_at', {
    mode: 'date',
  }).notNull(),

  updatedAt: timestamp('updated_at', {
    mode: 'date',
  }).notNull(),
});
