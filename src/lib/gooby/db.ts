import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export type GoobyRole = 'user' | 'assistant' | 'system';

export interface GoobyConversation {
  id: string;
  title: string;
  model: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface GoobyMessage {
  id: string;
  conversationId: string;
  role: GoobyRole;
  content: string;
  model: string | null;
  createdAt: number;
  sequence: number;
}

const dbPath = process.env.GOOBY_DATABASE_PATH ?? './data/gooby-gpt.db';
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    model TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    model TEXT,
    created_at INTEGER NOT NULL,
    sequence INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS messages_conversation_sequence_idx
    ON messages(conversation_id, sequence);
`);

function now(): number {
  return Date.now();
}

function rowToConversation(row: any): GoobyConversation {
  return {
    id: row.id,
    title: row.title,
    model: row.model ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToMessage(row: any): GoobyMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    model: row.model ?? null,
    createdAt: row.created_at,
    sequence: row.sequence
  };
}

export function listConversations(): GoobyConversation[] {
  return sqlite
    .prepare(
      `SELECT id, title, model, created_at, updated_at
       FROM conversations
       ORDER BY updated_at DESC
       LIMIT 100`
    )
    .all()
    .map(rowToConversation);
}

export function getConversation(id: string): GoobyConversation | null {
  const row = sqlite
    .prepare('SELECT id, title, model, created_at, updated_at FROM conversations WHERE id = ?')
    .get(id);
  return row ? rowToConversation(row) : null;
}

export function createConversation(model: string | null, title = 'New chat'): GoobyConversation {
  const t = now();
  const id = randomUUID();
  sqlite
    .prepare('INSERT INTO conversations (id, title, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, title, model, t, t);
  return { id, title, model, createdAt: t, updatedAt: t };
}

export function renameConversation(id: string, title: string): GoobyConversation | null {
  const cleaned = title.trim().slice(0, 80);
  if (!cleaned) return getConversation(id);
  sqlite.prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?').run(cleaned, now(), id);
  return getConversation(id);
}

export function touchConversation(id: string, model: string | null): void {
  sqlite.prepare('UPDATE conversations SET model = ?, updated_at = ? WHERE id = ?').run(model, now(), id);
}

export function deleteConversation(id: string): boolean {
  const result = sqlite.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  return result.changes > 0;
}

export function listMessages(conversationId: string): GoobyMessage[] {
  return sqlite
    .prepare(
      `SELECT id, conversation_id, role, content, model, created_at, sequence
       FROM messages
       WHERE conversation_id = ?
       ORDER BY sequence ASC`
    )
    .all(conversationId)
    .map(rowToMessage);
}

export function addMessage(
  conversationId: string,
  role: GoobyRole,
  content: string,
  model: string | null
): GoobyMessage {
  const row = sqlite
    .prepare('SELECT COALESCE(MAX(sequence), 0) + 1 AS next_sequence FROM messages WHERE conversation_id = ?')
    .get(conversationId) as { next_sequence: number };
  const t = now();
  const message: GoobyMessage = {
    id: randomUUID(),
    conversationId,
    role,
    content,
    model,
    createdAt: t,
    sequence: row.next_sequence
  };

  sqlite
    .prepare(
      `INSERT INTO messages (id, conversation_id, role, content, model, created_at, sequence)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(message.id, conversationId, role, content, model, t, message.sequence);

  if (role === 'user') {
    const conversation = getConversation(conversationId);
    const shouldAutoTitle = !conversation || conversation.title === 'New chat';
    const title = shouldAutoTitle ? content.replace(/\s+/g, ' ').trim().slice(0, 60) || 'New chat' : conversation.title;
    sqlite
      .prepare('UPDATE conversations SET title = ?, model = ?, updated_at = ? WHERE id = ?')
      .run(title, model, t, conversationId);
  } else {
    touchConversation(conversationId, model);
  }

  return message;
}
