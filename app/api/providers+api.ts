const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

export async function GET() {
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      { error: 'TMDB_API_KEY is not configured' },
      { status: 500 }
    );
  }

  try {
    const url = `${TMDB_BASE}/watch/providers/movie?watch_region=US&language=en-US`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      return Response.json(
        { error: `TMDB API error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const results: Array<{
      provider_id: number;
      provider_name: string;
      logo_path: string | null;
      display_priority: number;
    }> = data.results ?? [];

    const providers = results
      .sort((a, b) => a.display_priority - b.display_priority)
      .map((p) => ({
        id: p.provider_id,
        name: p.provider_name,
        logo_url: p.logo_path ? `${TMDB_LOGO_BASE}${p.logo_path}` : null,
      }));

    return Response.json({ providers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
