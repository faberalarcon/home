// Module-level SSE broadcaster singleton.
// Lives for the lifetime of the server process — one Set shared across all requests.

type Sender = (chunk: string) => void;

const clients = new Set<Sender>();

export function subscribe(send: Sender): () => void {
  clients.add(send);
  return () => clients.delete(send);
}

export function broadcast(event: string, data: unknown): void {
  if (clients.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const send of clients) {
    try {
      send(payload);
    } catch {
      clients.delete(send);
    }
  }
}

export function clientCount(): number {
  return clients.size;
}
