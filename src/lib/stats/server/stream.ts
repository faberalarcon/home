// Stats SSE broadcaster. Separate from drinks/server/stream so the channels
// have independent ring buffers and don't share ids. Events flowing here are
// re-emissions from the drinks broadcaster (order placed) plus pi-tick events
// fired by the pi-history ingester.

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
  if (nextId > Number.MAX_SAFE_INTEGER) nextId = 1;
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

export function getMissedEvents(lastId: number): string {
  return ringBuffer
    .filter((e) => e.id > lastId)
    .map((e) => e.chunk)
    .join('');
}

export function clientCount(): number {
  return clients.size;
}
