import { json } from '@sveltejs/kit';
import { getLlamaStatus } from '$lib/gooby/llama';

export async function GET() {
  return json(await getLlamaStatus());
}
