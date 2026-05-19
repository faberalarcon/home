import { json, type RequestHandler } from '@sveltejs/kit';
import { runDailyBrief, yesterdayKey } from '$lib/stats/server/brief';

export const POST: RequestHandler = async ({ url }) => {
  const date = url.searchParams.get('date') ?? yesterdayKey();
  const model = url.searchParams.get('model') ?? undefined;
  try {
    const result = await runDailyBrief({ date, model });
    return json({
      ok: true,
      date: result.brief.date,
      narrative: result.brief.narrative,
      model: result.brief.model,
      notified: result.notified,
      notifyError: result.notifyError ?? null
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[daily-brief] generation failed:', message);
    return json({ ok: false, error: message }, { status: 500 });
  }
};
