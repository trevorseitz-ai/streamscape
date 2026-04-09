export interface StreamingOption {
  serviceId: string;
  serviceName: string;
  link: string;
  type: string;
  /** Service logo URL from RapidAPI `service.imageSet` (see serviceImageSet in API schema). */
  logoUrl: string;
}

export type MediaType = 'movie' | 'show';

/**
 * Extracts a logo URL from `service.imageSet` (Streaming Availability API `serviceImageSet`).
 * @see https://github.com/movieofthenight/streaming-availability-api — components/schemas/serviceImageSet
 */
function logoUrlFromServiceImageSet(service: Record<string, unknown>): string {
  const imageSet = service.imageSet;
  if (!imageSet || typeof imageSet !== 'object') return '';
  const is = imageSet as Record<string, unknown>;
  const candidates = [
    is.darkThemeImage,
    is.lightThemeImage,
    is.whiteImage,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim();
  }
  return '';
}

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

  const logoUrl = logoUrlFromServiceImageSet(s);

  return {
    serviceId: id != null ? String(id) : '',
    serviceName: typeof name === 'string' ? name : '',
    link,
    type: typeof type === 'string' ? type : '',
    logoUrl,
  };
}

export type GetDirectStreamingLinksResult = {
  links: StreamingOption[];
  /** Full parsed JSON body from the Streaming Availability API (diagnostic). */
  raw: Record<string, unknown>;
};

export async function getDirectStreamingLinks(
  tmdbId: number,
  itemType: MediaType,
  country: string = 'us'
): Promise<GetDirectStreamingLinksResult> {
  const apiKey = process.env.EXPO_PUBLIC_RAPIDAPI_KEY?.trim() ?? '';
  if (!apiKey) {
    return { links: [], raw: {} };
  }

  const countryKey = country.toLowerCase();
  // Manually fill path params: /shows/{type}/{id} — raw slash between type and id (do not encode whole path).
  const type = itemType === 'movie' ? 'movie' : 'show';
  const cleanId = String(tmdbId).replace('movie/', '');
  const url = `https://streaming-availability.p.rapidapi.com/shows/${type}/${cleanId}?country=${countryKey}&output_language=en`;
  console.log('Streaming Availability request URL:', url);

  const options: RequestInit = {
    method: 'GET',
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'streaming-availability.p.rapidapi.com',
      'Content-Type': 'application/json',
    },
  };

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Streaming API HTTP ${response.status}: ${errorText || '(empty body)'}`
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    console.log('API Response:', data);

    const streamingOpts = data.streamingOptions;
    if (!streamingOpts || typeof streamingOpts !== 'object') {
      return { links: [], raw: data };
    }

    const bucket = streamingOpts as Record<string, unknown>;
    const primary = bucket.us;
    const list: unknown[] = Array.isArray(primary)
      ? primary
      : Array.isArray(bucket[countryKey])
        ? bucket[countryKey]
        : Array.isArray(bucket[country])
          ? bucket[country]
          : [];

    const options: StreamingOption[] = [];
    for (const item of list) {
      const mapped = mapRawOption(item);
      if (mapped) options.push(mapped);
    }

    return { links: options, raw: data };
  } catch (error) {
    if (__DEV__) {
      console.error('getDirectStreamingLinks:', error);
    }
    throw error instanceof Error
      ? error
      : new Error(String(error));
  }
}
