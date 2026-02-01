// web/src/lib/schema.ts
import {
  pgTable,
  uuid,
  text,
  timestamp,
  serial,
  integer,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core';

// Type for raw metadata stored in items
export interface ItemRawMetadata {
  categories?: string[];
  authors?: string[];
  [key: string]: any;
}

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

// Sources table - defines ingestion sources
export const sources = pgTable('sources', {
  id: serial('id').primaryKey().notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'arxiv' | 'rss' | 'twitter_api' | 'manual'
  medium: text('medium').notNull(), // 'paper' | 'newsletter' | 'blog' | 'tweet'
  ingestUrl: text('ingest_url'),
  active: boolean('active').notNull().default(true),
  frequency: text('frequency'),
  meta: jsonb('meta').default({} as any),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
});

// Items table - unified content model
export const items = pgTable('items', {
  id: uuid('id').primaryKey().notNull(),
  sourceId: integer('source_id').notNull(),
  sourceType: text('source_type').notNull(), // 'paper' | 'newsletter' | 'blog' | 'tweet'
  title: text('title').notNull(),
  url: text('url').notNull(),
  summary: text('summary'),
  body: text('body'),
  publishedAt: timestamp('published_at', { mode: 'date' }).notNull(),
  rawMetadata: jsonb('raw_metadata').$type<ItemRawMetadata>().default({} as any),
  topics: text('topics').array().default([]),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
});

// Item topics - topics associated with items
export const itemTopics = pgTable('item_topics', {
  id: serial('id').primaryKey().notNull(),
  itemId: uuid('item_id').notNull(),
  topic: text('topic').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
});

// Item likes - user ratings/likes for items
export const itemLikes = pgTable('item_likes', {
  id: serial('id').primaryKey().notNull(),
  userId: text('user_id').notNull(),
  itemId: uuid('item_id').notNull(),
  score: integer('score'), // -1, 0, or 1
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
});
