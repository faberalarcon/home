// Module-level SSE broadcaster singleton.
// Lives for the lifetime of the server process — one Set shared across all requests.
// Maintains a ring buffer of the last 50 events so reconnecting clients can
// catch up using the standard Last-Event-ID header.

type Sender = (chunk: string) => void;

interface Event {
  id: number;
  chunk: string;
}

const clients = new Set<Sender>();
const ringBuffer: Event[] = [];
const RING_SIZE = 50;
let nextId = 1;

export function subscribe(send: Sender): () => void {
  clients.add(send);
  return () => clients.delete(send);
}

export function broadcast(event: string, data: unknown): void {
  const id = nextId++;
  const payload = `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  ringBuffer.push({ id, chunk: payload });
  if (ringBuffer.length > RING_SIZE) ringBuffer.shift();

  for (const send of clients) {
    try {
      send(payload);
    } catch {
      clients.delete(send);
    }
  }
}

// Returns all buffered events with id > lastId, for catch-up on reconnect.
export function getMissedEvents(lastId: number): string {
  return ringBuffer
    .filter((e) => e.id > lastId)
    .map((e) => e.chunk)
    .join('');
}

export function clientCount(): number {
  return clients.size;
}
