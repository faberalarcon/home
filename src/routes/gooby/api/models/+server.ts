import { json } from '@sveltejs/kit';
import { getGoobyLlamaStatus } from '$lib/gooby/llama';

export async function GET() {
  return json(await getGoobyLlamaStatus());
}
