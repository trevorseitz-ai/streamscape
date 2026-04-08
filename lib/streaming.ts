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

export async function getDirectStreamingLinks(
  tmdbId: number,
  itemType: MediaType,
  country: string = 'us'
): Promise<StreamingOption[]> {
  // const RAPID_API_KEY = process.env.EXPO_PUBLIC_RAPIDAPI_KEY;
  const RAPID_API_KEY = ''; // PASTE KEY HERE FOR TESTING
  console.log('RAPID_API_KEY (first 5 chars):', RAPID_API_KEY.slice(0, 5));
  const apiKey = RAPID_API_KEY.trim();
  if (!apiKey) {
    return [];
  }

  const countryKey = country.toLowerCase();
  const url = `https://streaming-availability.p.rapidapi.com/shows/${itemType}/${tmdbId}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'streaming-availability.p.rapidapi.com',
      },
    });

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      return [];
    }

    const byCountry = data.streamingOptions;
    if (!byCountry || typeof byCountry !== 'object') {
      return [];
    }

    const list =
      (byCountry as Record<string, unknown>)[countryKey] ??
      (byCountry as Record<string, unknown>)[country] ??
      (byCountry as Record<string, unknown>)[country.toUpperCase()];

    if (!Array.isArray(list)) {
      return [];
    }

    const options: StreamingOption[] = [];
    for (const item of list) {
      const mapped = mapRawOption(item);
      if (mapped) options.push(mapped);
    }

    return options;
  } catch (error) {
    if (__DEV__) {
      console.error('getDirectStreamingLinks:', error);
    }
    return [];
  }
}
