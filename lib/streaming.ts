export interface StreamingOption {
  serviceId: string;
  serviceName: string;
  link: string;
  type: string;
}

export type MediaType = 'movie' | 'show';

function mapRawOption(raw: unknown): StreamingOption | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const service = o.service;
  if (!service || typeof service !== 'object') return null;
  const s = service as Record<string, unknown>;

  const id = s.id;
  const name = s.name;
  const link = o.link ?? o.videoLink;
  const type = o.type;

  if (link == null || typeof link !== 'string') return null;

  return {
    serviceId: id != null ? String(id) : '',
    serviceName: typeof name === 'string' ? name : '',
    link,
    type: typeof type === 'string' ? type : '',
  };
}

export async function getDirectStreamingLinks(
  tmdbId: number,
  itemType: MediaType,
  country: string = 'us'
): Promise<StreamingOption[]> {
  const apiKey = process.env.EXPO_PUBLIC_RAPIDAPI_KEY?.trim();
  if (!apiKey) {
    return [];
  }

  const countryKey = country.toLowerCase();
  const url = `https://streaming-availability.p.rapidapi.com/shows/${itemType}/${tmdbId}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'streaming-availability.p.rapidapi.com',
      },
    });

    if (!res.ok) {
      return [];
    }

    const data = (await res.json()) as {
      streamingOptions?: Record<string, unknown[]>;
    };

    const byCountry = data.streamingOptions;
    if (!byCountry || typeof byCountry !== 'object') {
      return [];
    }

    const list =
      byCountry[countryKey] ??
      byCountry[country] ??
      byCountry[country.toUpperCase()];

    if (!Array.isArray(list)) {
      return [];
    }

    const out: StreamingOption[] = [];
    for (const item of list) {
      const mapped = mapRawOption(item);
      if (mapped) out.push(mapped);
    }
    return out;
  } catch {
    return [];
  }
}
