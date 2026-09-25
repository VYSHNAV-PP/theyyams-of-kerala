import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_IMAGE_CANDIDATES = 8;

// Supabase webhook should finish comfortably before the provider timeout.
const TOTAL_TIMEOUT_MS = 8_000;
const REQUEST_TIMEOUT_MS = 2_500;

const MIN_SCORE = 45;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";

type RequestBody = {
  title?: string;
  category?: string;
  subcategory?: string;
  venue?: string;
  locality?: string;
  district?: string;
  website?: string;
  ticketUrl?: string;

  // Supabase Database Webhook payload
  type?: string;
  table?: string;
  schema?: string;
  record?: Record<string, unknown> | null;
  old_record?: Record<string, unknown> | null;
};

type SearchResult = {
  title: string;
  url: string;
};

type PageCandidate = {
  result: SearchResult;
  imageUrl: string;
  score: number;
};

type EventSearchData = {
  id: string | null;
  title: string;
  category: string;
  subcategory: string;
  venue: string;
  locality: string;
  district: string;
  website: string;
  ticketUrl: string;
  existingImageUrl: string | null;
};

type SearchResponse = {
  imageUrl: string | null;
  imageUrls: string[];
  method: string;
  eventId?: string | null;
  error?: string;
};

type WikimediaImageResult = {
  title: string;
  pageUrl: string;
  imageUrl: string;
  width: number;
  height: number;
  mime: string;
};

/* ============================================================
   TIMEOUT / BUDGET
   ============================================================ */

function createDeadline(): number {
  return Date.now() + TOTAL_TIMEOUT_MS;
}

function hasTime(deadline: number): boolean {
  return Date.now() < deadline;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/* ============================================================
   TEXT HELPERS
   ============================================================ */

function normalize(value: string | undefined | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(value: string | undefined | null): string[] {
  return normalize(value)
    .split(" ")
    .filter((word) => word.length >= 2);
}

function cleanUrl(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value.trim());

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    url.hash = "";

    return url.toString();
  } catch {
    return null;
  }
}

function absolutizeUrl(
  value: string,
  baseUrl: string,
): string | null {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/gi, "/");
}

/* ============================================================
   ENTITY HELPERS
   ============================================================ */

function entityPhrases(event: EventSearchData): string[] {
  const phrases = [
    event.title,
    event.venue,
    event.subcategory,
  ]
    .map((value) => normalize(value))
    .filter(Boolean);

  return [...new Set(phrases)];
}

function meaningfulWords(event: EventSearchData): string[] {
  const genericWords = new Set([
    "event",
    "festival",
    "program",
    "programme",
    "celebration",
    "celebrations",
    "function",
    "kerala",
    "india",
    "official",
    "temple",
    "church",
    "mosque",
    "ground",
    "hall",
    "stadium",
    "centre",
    "center",
  ]);

  const all = [
    ...words(event.title),
    ...words(event.venue),
  ];

  return [...new Set(all)].filter(
    (word) => !genericWords.has(word),
  );
}

/* ============================================================
   DUCKDUCKGO
   ============================================================ */

function extractRedirectUrl(href: string): string | null {
  if (!href) {
    return null;
  }

  const decoded = decodeHtml(href).trim();

  if (!decoded) {
    return null;
  }

  if (/^https?:\/\//i.test(decoded)) {
    try {
      const url = new URL(decoded);
      const hostname = url.hostname.toLowerCase();

      if (
        hostname === "duckduckgo.com" ||
        hostname.endsWith(".duckduckgo.com")
      ) {
        const uddg = url.searchParams.get("uddg");

        if (uddg && /^https?:\/\//i.test(uddg)) {
          try {
            return decodeURIComponent(uddg);
          } catch {
            return uddg;
          }
        }

        return null;
      }

      return decoded;
    } catch {
      return null;
    }
  }

  if (decoded.startsWith("/")) {
    try {
      const url = new URL(
        decoded,
        "https://html.duckduckgo.com",
      );

      const uddg = url.searchParams.get("uddg");

      if (uddg && /^https?:\/\//i.test(uddg)) {
        try {
          return decodeURIComponent(uddg);
        } catch {
          return uddg;
        }
      }
    } catch {
      return null;
    }
  }

  return null;
}

function parseDuckDuckGoResults(
  html: string,
): SearchResult[] {
  const results: SearchResult[] = [];

  const anchorRegex =
    /<a\b[^>]*class=["'][^"']*(?:result__a|result-link)[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;

  while ((match = anchorRegex.exec(html)) !== null) {
    const rawHref = decodeHtml(match[1]);
    const title = stripHtml(match[2]).trim();

    if (!rawHref || !title) {
      continue;
    }

    const extractedUrl = extractRedirectUrl(rawHref);

    if (!extractedUrl) {
      continue;
    }

    const url = cleanUrl(extractedUrl);

    if (!url) {
      continue;
    }

    const hostname = new URL(url).hostname.toLowerCase();

    if (
      hostname === "duckduckgo.com" ||
      hostname.endsWith(".duckduckgo.com")
    ) {
      continue;
    }

    results.push({
      title,
      url,
    });
  }

  /*
   * Fallback parser for DuckDuckGo Lite.
   */
  if (results.length === 0) {
    const fallbackRegex =
      /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    while ((match = fallbackRegex.exec(html)) !== null) {
      const rawHref = decodeHtml(match[1]);
      const title = stripHtml(match[2]).trim();

      if (!rawHref || !title) {
        continue;
      }

      const extractedUrl = extractRedirectUrl(rawHref);

      if (!extractedUrl) {
        continue;
      }

      const url = cleanUrl(extractedUrl);

      if (!url) {
        continue;
      }

      const hostname = new URL(url).hostname.toLowerCase();

      if (
        hostname === "duckduckgo.com" ||
        hostname.endsWith(".duckduckgo.com")
      ) {
        continue;
      }

      const lowerTitle = title.toLowerCase();

      if (
        [
          "images",
          "videos",
          "news",
          "maps",
          "shopping",
          "more",
        ].includes(lowerTitle)
      ) {
        continue;
      }

      results.push({
        title,
        url,
      });
    }
  }

  const unique = new Map<string, SearchResult>();

  for (const result of results) {
    const normalizedUrl = cleanUrl(result.url);

    if (!normalizedUrl) {
      continue;
    }

    if (!unique.has(normalizedUrl)) {
      unique.set(normalizedUrl, {
        title: result.title,
        url: normalizedUrl,
      });
    }
  }

  return [...unique.values()];
}

async function searchDuckDuckGo(
  query: string,
  deadline: number,
): Promise<SearchResult[]> {
  if (!hasTime(deadline)) {
    return [];
  }

  const encodedQuery = encodeURIComponent(query);

  const urls = [
    `https://html.duckduckgo.com/html/?q=${encodedQuery}&kl=in-en`,
    `https://lite.duckduckgo.com/lite/?q=${encodedQuery}&kl=in-en`,
  ];

  const headers = {
    "User-Agent": USER_AGENT,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
  };

  for (const searchUrl of urls) {
    if (!hasTime(deadline)) {
      break;
    }

    try {
      console.log(
        `Searching DuckDuckGo: ${query}`,
      );

      const response = await fetchWithTimeout(
        searchUrl,
        {
          headers,
          redirect: "follow",
        },
        Math.min(
          REQUEST_TIMEOUT_MS,
          Math.max(500, deadline - Date.now()),
        ),
      );

      console.log(
        `DuckDuckGo HTTP status: ${response.status}`,
      );

      if (!response.ok) {
        continue;
      }

      const html = await response.text();

      const results =
        parseDuckDuckGoResults(html);

      console.log(
        `DuckDuckGo query "${query}" returned ${results.length} results`,
      );

      if (results.length > 0) {
        return results;
      }
    } catch (error) {
      console.warn(
        `DuckDuckGo search failed for "${query}":`,
        error,
      );
    }
  }

  return [];
}

/* ============================================================
   WIKIMEDIA COMMONS
   ============================================================ */

/*
 * Wikimedia Commons is deliberately independent of DDG.
 *
 * We search the Commons File namespace directly and ask the API
 * for imageinfo in the same request.
 *
 * This means:
 *
 * "Parassinikadavu"
 *
 * can directly return files such as:
 *
 * File:Parassinikadavu temple...
 * File:Parassini Madappura...
 *
 * without first finding an HTML search-result page.
 */

function buildWikimediaQueries(
  event: EventSearchData,
): string[] {
  const title = event.title.trim();
  const venue = event.venue.trim();
  const locality = event.locality.trim();
  const district = event.district.trim();

  const queries: string[] = [];

  if (title) {
    queries.push(title);
  }

  if (venue) {
    queries.push(venue);
  }

  if (title && district) {
    queries.push(`${title} ${district}`);
  }

  if (venue && district) {
    queries.push(`${venue} ${district}`);
  }

  if (title && locality) {
    queries.push(`${title} ${locality}`);
  }

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    const normalized = normalize(query);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    unique.push(query);
  }

  return unique.slice(0, 3);
}

function scoreWikimediaCandidate(
  candidate: WikimediaImageResult,
  event: EventSearchData,
): number {
  const resultTitle =
    normalize(candidate.title);

  const resultUrl =
    normalize(candidate.pageUrl);

  const title =
    normalize(event.title);

  const venue =
    normalize(event.venue);

  const locality =
    normalize(event.locality);

  const district =
    normalize(event.district);

  let score = 0;

  const titleWords =
    words(event.title);

  const venueWords =
    words(event.venue);

  /*
   * Exact title.
   */
  if (
    title &&
    resultTitle === title
  ) {
    score += 120;
  } else if (
    title &&
    resultTitle.includes(title)
  ) {
    score += 85;
  }

  /*
   * Title words.
   */
  let titleMatches = 0;

  for (const word of titleWords) {
    if (
      word.length >= 3 &&
      resultTitle.includes(word)
    ) {
      titleMatches++;
    }
  }

  score += Math.min(titleMatches, 6) * 14;

  /*
   * Venue.
   */
  if (
    venue &&
    resultTitle.includes(venue)
  ) {
    score += 90;
  }

  let venueMatches = 0;

  for (const word of venueWords) {
    if (
      word.length >= 3 &&
      resultTitle.includes(word)
    ) {
      venueMatches++;
    }
  }

  score += Math.min(venueMatches, 6) * 11;

  /*
   * Locality / district.
   */
  if (
    locality &&
    resultTitle.includes(locality)
  ) {
    score += 20;
  }

  if (
    district &&
    resultTitle.includes(district)
  ) {
    score += 20;
  }

  /*
   * Wikimedia-specific URL/title signals.
   */
  if (
    resultUrl.includes("parassini") ||
    resultUrl.includes("parassinikadavu")
  ) {
    score += 35;
  }

  if (
    resultTitle.includes("muthappan")
  ) {
    score += 30;
  }

  if (
    resultTitle.includes("madappura")
  ) {
    score += 25;
  }

  /*
   * Very small images are usually poor event-card candidates.
   */
  if (
    candidate.width >= 1000 &&
    candidate.height >= 600
  ) {
    score += 10;
  }

  /*
   * Reject obvious generic material.
   */
  const genericPhrases = [
    "temples of kerala",
    "temples in kerala",
    "famous temples in kerala",
    "kerala temples",
    "tourist places in kerala",
    "places to visit in kerala",
  ];

  for (const phrase of genericPhrases) {
    if (resultTitle.includes(phrase)) {
      score -= 60;
    }
  }

  return score;
}

async function searchWikimediaCommons(
  query: string,
  deadline: number,
): Promise<WikimediaImageResult[]> {
  if (!hasTime(deadline)) {
    return [];
  }

  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: "10",

    prop: "imageinfo",
    iiprop: "url|size|mime",
    iiurlwidth: "1600",

    format: "json",
    formatversion: "2",
    origin: "*",
  });

  const apiUrl =
    `https://commons.wikimedia.org/w/api.php?${params.toString()}`;

  try {
    console.log(
      `Searching Wikimedia Commons: ${query}`,
    );

    const response =
      await fetchWithTimeout(
        apiUrl,
        {
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json",
          },
        },
        Math.min(
          REQUEST_TIMEOUT_MS,
          Math.max(500, deadline - Date.now()),
        ),
      );

    console.log(
      `Wikimedia Commons HTTP status: ${response.status}`,
    );

    if (!response.ok) {
      return [];
    }

    const data =
      await response.json();

    const pages =
      Array.isArray(data?.query?.pages)
        ? data.query.pages
        : [];

    const results: WikimediaImageResult[] = [];

    for (const page of pages) {
      const imageInfo =
        Array.isArray(page.imageinfo)
          ? page.imageinfo[0]
          : null;

      if (!imageInfo) {
        continue;
      }

      const imageUrl =
        cleanUrl(
          imageInfo.thumburl ||
          imageInfo.url,
        );

      if (!imageUrl) {
        continue;
      }

      if (
        !imageUrl.startsWith("https://")
      ) {
        continue;
      }

      const mime =
        typeof imageInfo.mime === "string"
          ? imageInfo.mime
          : "";

      if (!mime.startsWith("image/")) {
        continue;
      }

      const width =
        Number(imageInfo.width) || 0;

      const height =
        Number(imageInfo.height) || 0;

      /*
       * Avoid tiny icons / logos / thumbnails.
       */
      if (
        width < 400 ||
        height < 300
      ) {
        continue;
      }

      const title =
        typeof page.title === "string"
          ? page.title
          : "";

      if (!title) {
        continue;
      }

      const pageUrl =
        `https://commons.wikimedia.org/wiki/${encodeURIComponent(
          title.replace(/^File:/, "File:"),
        ).replace(/%3A/g, ":")}`;

      results.push({
        title,
        pageUrl,
        imageUrl,
        width,
        height,
        mime,
      });
    }

    console.log(
      `Wikimedia query "${query}" returned ${results.length} usable images`,
    );

    return results;
  } catch (error) {
    console.warn(
      `Wikimedia search failed for "${query}":`,
      error,
    );

    return [];
  }
}

async function discoverWikimediaImages(
  event: EventSearchData,
  deadline: number,
): Promise<string[]> {
  const queries =
    buildWikimediaQueries(event);

  console.log(
    `Wikimedia queries: ${JSON.stringify(queries)}`,
  );

  const allCandidates:
    Array<{
      candidate: WikimediaImageResult;
      score: number;
    }> = [];

  const seenImages =
    new Set<string>();

  /*
   * Two or three targeted queries are enough.
   *
   * Do not exhaust the webhook budget here.
   */
  for (const query of queries) {
    if (!hasTime(deadline)) {
      break;
    }

    const results =
      await searchWikimediaCommons(
        query,
        deadline,
      );

    for (const candidate of results) {
      const cleaned =
        cleanUrl(candidate.imageUrl);

      if (!cleaned) {
        continue;
      }

      if (seenImages.has(cleaned)) {
        continue;
      }

      seenImages.add(cleaned);

      allCandidates.push({
        candidate: {
          ...candidate,
          imageUrl: cleaned,
        },
        score:
          scoreWikimediaCandidate(
            candidate,
            event,
          ),
      });

      if (
        allCandidates.length >= 30
      ) {
        break;
      }
    }

    if (
      allCandidates.length >= 30
    ) {
      break;
    }
  }

  if (
    allCandidates.length === 0
  ) {
    console.warn(
      "Wikimedia Commons produced no usable image candidates.",
    );

    return [];
  }

  allCandidates.sort(
    (a, b) => b.score - a.score,
  );

  console.log(
    "Ranked Wikimedia candidates:",
    JSON.stringify(
      allCandidates
        .slice(0, 10)
        .map((item) => ({
          title:
            item.candidate.title,
          score: item.score,
          imageUrl:
            item.candidate.imageUrl,
        })),
    ),
  );

  const best =
    allCandidates[0];

  /*
   * Require a meaningful entity match.
   */
  if (
    best.score < MIN_SCORE
  ) {
    console.warn(
      `Best Wikimedia score ${best.score} is below threshold ${MIN_SCORE}. Rejecting.`,
    );

    return [];
  }

  const output: string[] = [];
  const outputSeen =
    new Set<string>();

  for (const item of allCandidates) {
    if (
      item.score < MIN_SCORE
    ) {
      continue;
    }

    const imageUrl =
      cleanUrl(
        item.candidate.imageUrl,
      );

    if (!imageUrl) {
      continue;
    }

    if (
      !imageUrl.startsWith("https://")
    ) {
      continue;
    }

    if (
      outputSeen.has(imageUrl)
    ) {
      continue;
    }

    outputSeen.add(imageUrl);
    output.push(imageUrl);

    if (
      output.length >=
      MAX_IMAGE_CANDIDATES
    ) {
      break;
    }
  }

  console.log(
    `Wikimedia returning ${output.length} image candidates.`,
  );

  return output;
}

/* ============================================================
   PAGE METADATA / IMAGE EXTRACTION
   ============================================================ */

function getMetaContent(
  html: string,
  property: string,
): string | null {
  const escaped =
    property.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match =
      html.match(pattern);

    if (match?.[1]) {
      return decodeHtml(
        match[1],
      ).trim();
    }
  }

  return null;
}

function extractPageImages(
  html: string,
  pageUrl: string,
): string[] {
  const candidates = [
    getMetaContent(html, "og:image"),
    getMetaContent(html, "og:image:url"),
    getMetaContent(html, "twitter:image"),
    getMetaContent(html, "twitter:image:src"),
  ];

  const output: string[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const absolute =
      absolutizeUrl(
        candidate,
        pageUrl,
      );

    if (!absolute) {
      continue;
    }

    const cleaned =
      cleanUrl(absolute);

    if (
      !cleaned ||
      seen.has(cleaned)
    ) {
      continue;
    }

    if (
      !cleaned.startsWith("https://")
    ) {
      continue;
    }

    seen.add(cleaned);
    output.push(cleaned);
  }

  return output;
}

async function fetchPage(
  url: string,
  deadline: number,
): Promise<{
  html: string;
  finalUrl: string;
} | null> {
  if (!hasTime(deadline)) {
    return null;
  }

  try {
    const remaining =
      Math.max(
        500,
        Math.min(
          REQUEST_TIMEOUT_MS,
          deadline - Date.now(),
        ),
      );

    const response =
      await fetchWithTimeout(
        url,
        {
          redirect: "follow",
          headers: {
            "User-Agent": USER_AGENT,
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language":
              "en-IN,en;q=0.9",
          },
        },
        remaining,
      );

    if (!response.ok) {
      return null;
    }

    const contentType =
      response.headers.get(
        "content-type",
      ) ?? "";

    if (
      !contentType.includes(
        "text/html",
      ) &&
      !contentType.includes(
        "application/xhtml+xml",
      )
    ) {
      return null;
    }

    const html =
      await response.text();

    return {
      html,
      finalUrl:
        response.url || url,
    };
  } catch (error) {
    console.warn(
      `Could not fetch candidate page ${url}:`,
      error,
    );

    return null;
  }
}

/* ============================================================
   SCORING
   ============================================================ */

function scoreCandidate(
  result: SearchResult,
  event: EventSearchData,
): number {
  const resultTitle =
    normalize(result.title);

  const resultUrl =
    normalize(result.url);

  const title =
    normalize(event.title);

  const venue =
    normalize(event.venue);

  const locality =
    normalize(event.locality);

  const district =
    normalize(event.district);

  const subcategory =
    normalize(event.subcategory);

  let score = 0;

  const titleWords =
    words(event.title);

  const venueWords =
    words(event.venue);

  /*
   * Exact event title.
   */
  if (
    title &&
    resultTitle === title
  ) {
    score += 100;
  } else if (
    title &&
    resultTitle.includes(title)
  ) {
    score += 75;
  }

  if (
    title.length >= 5 &&
    resultTitle.includes(title)
  ) {
    score += 35;
  }

  /*
   * Title word matching.
   */
  let titleMatches = 0;

  for (const word of titleWords) {
    if (
      word.length >= 3 &&
      resultTitle.includes(word)
    ) {
      titleMatches++;
    }
  }

  score +=
    Math.min(titleMatches, 5) * 12;

  /*
   * Venue.
   */
  if (
    venue &&
    resultTitle.includes(venue)
  ) {
    score += 70;
  }

  let venueMatches = 0;

  for (const word of venueWords) {
    if (
      word.length >= 3 &&
      resultTitle.includes(word)
    ) {
      venueMatches++;
    }
  }

  score +=
    Math.min(venueMatches, 5) * 10;

  /*
   * Locality / district.
   */
  if (
    locality &&
    resultTitle.includes(locality)
  ) {
    score += 20;
  }

  if (
    district &&
    resultTitle.includes(district)
  ) {
    score += 15;
  }

  /*
   * Subcategory.
   */
  if (
    subcategory &&
    resultTitle.includes(
      subcategory,
    )
  ) {
    score += 8;
  }

  /*
   * URL entity match.
   */
  if (
    title &&
    resultUrl.includes(
      title.replace(/\s+/g, "-"),
    )
  ) {
    score += 20;
  }

  const importantWords =
    meaningfulWords(event);

  for (
    const word of importantWords.slice(
      0,
      6,
    )
  ) {
    if (
      word.length >= 4 &&
      resultUrl.includes(word)
    ) {
      score += 6;
    }
  }

  /*
   * Source signals.
   */
  if (
    resultUrl.includes(
      "instagram.com",
    ) ||
    resultUrl.includes(
      "facebook.com",
    ) ||
    resultUrl.includes(
      "youtube.com",
    )
  ) {
    score += 3;
  }

  if (
    resultUrl.includes(
      "wikipedia.org",
    )
  ) {
    score -= 8;
  }

  /*
   * Generic-result penalties.
   */
  const genericPhrases = [
    "temples of kerala",
    "temples in kerala",
    "famous temples in kerala",
    "famous temples of kerala",
    "kerala temples",
    "best temples in kerala",
    "tourist places in kerala",
    "places to visit in kerala",
    "kerala tourism",
    "top temples",
    "famous temples",
  ];

  for (
    const phrase of genericPhrases
  ) {
    if (
      resultTitle.includes(phrase)
    ) {
      score -= 55;
    }
  }

  /*
   * Generic category protection.
   */
  const genericCategoryWords =
    new Set([
      "temple",
      "temples",
      "church",
      "churches",
      "mosque",
      "mosques",
      "festival",
      "festivals",
      "event",
      "events",
      "kerala",
    ]);

  const titleHasSpecificWords =
    titleWords.filter(
      (word) =>
        word.length >= 4 &&
        !genericCategoryWords.has(
          word,
        ),
    );

  if (
    titleHasSpecificWords.length > 0
  ) {
    const specificMatches =
      titleHasSpecificWords.filter(
        (word) =>
          resultTitle.includes(word),
      ).length;

    if (
      specificMatches === 0
    ) {
      score -= 50;
    }
  }

  if (
    title.length < 8
  ) {
    score -= 15;
  }

  return score;
}

/* ============================================================
   SEARCH QUERY GENERATION
   ============================================================ */

function buildQueries(
  event: EventSearchData,
): string[] {
  const title =
    event.title.trim();

  const venue =
    event.venue.trim();

  const locality =
    event.locality.trim();

  const district =
    event.district.trim();

  const queries: string[] = [];

  if (title) {
    queries.push(`"${title}"`);
  }

  if (
    title &&
    district
  ) {
    queries.push(
      `"${title}" "${district}"`,
    );
  }

  if (
    title &&
    locality
  ) {
    queries.push(
      `"${title}" "${locality}"`,
    );
  }

  if (
    venue &&
    district
  ) {
    queries.push(
      `"${venue}" "${district}"`,
    );
  }

  if (venue) {
    queries.push(`"${venue}"`);
  }

  if (title) {
    queries.push(
      `"${title}" official`,
    );
  }

  if (
    title &&
    district
  ) {
    queries.push(
      `"${title}" "${district}" images`,
    );
  } else if (title) {
    queries.push(
      `"${title}" images`,
    );
  }

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    const normalized =
      normalize(query);

    if (
      !normalized ||
      seen.has(normalized)
    ) {
      continue;
    }

    seen.add(normalized);
    unique.push(query);
  }

  return unique;
}

/* ============================================================
   DUCKDUCKGO IMAGE DISCOVERY
   ============================================================ */

async function discoverImages(
  event: EventSearchData,
  deadline: number,
): Promise<string[]> {
  const queries =
    buildQueries(event);

  console.log(
    `Search queries: ${JSON.stringify(queries)}`,
  );

  const allResults: SearchResult[] =
    [];

  const seenUrls =
    new Set<string>();

  /*
   * Only a few targeted searches.
   */
  for (
    const query of queries.slice(0, 4)
  ) {
    if (!hasTime(deadline)) {
      break;
    }

    const results =
      await searchDuckDuckGo(
        query,
        deadline,
      );

    for (
      const result of results
    ) {
      const normalizedUrl =
        cleanUrl(result.url);

      if (!normalizedUrl) {
        continue;
      }

      if (
        seenUrls.has(
          normalizedUrl,
        )
      ) {
        continue;
      }

      seenUrls.add(
        normalizedUrl,
      );

      allResults.push({
        title:
          result.title,
        url:
          normalizedUrl,
      });

      if (
        allResults.length >= 12
      ) {
        break;
      }
    }

    if (
      allResults.length >= 12
    ) {
      break;
    }
  }

  console.log(
    `Found ${allResults.length} unique search results.`,
  );

  if (
    allResults.length === 0
  ) {
    return [];
  }

  const rankedResults =
    allResults
      .map((result) => ({
        result,
        score:
          scoreCandidate(
            result,
            event,
          ),
      }))
      .sort(
        (a, b) =>
          b.score - a.score,
      );

  console.log(
    "Ranked search results:",
    JSON.stringify(
      rankedResults.slice(
        0,
        8,
      ),
    ),
  );

  const candidates:
    PageCandidate[] = [];

  for (
    const ranked of rankedResults.slice(
      0,
      6,
    )
  ) {
    if (!hasTime(deadline)) {
      break;
    }

    if (
      ranked.score < MIN_SCORE
    ) {
      continue;
    }

    const page =
      await fetchPage(
        ranked.result.url,
        deadline,
      );

    if (!page) {
      continue;
    }

    const imageUrls =
      extractPageImages(
        page.html,
        page.finalUrl,
      );

    if (
      imageUrls.length === 0
    ) {
      continue;
    }

    console.log(
      `Candidate: ${ranked.result.url} | score=${ranked.score} | images=${imageUrls.length}`,
    );

    for (
      const imageUrl of imageUrls
    ) {
      candidates.push({
        result:
          ranked.result,
        imageUrl,
        score:
          ranked.score,
      });
    }
  }

  if (
    candidates.length === 0
  ) {
    console.warn(
      "No suitable candidate pages exposed usable images.",
    );

    return [];
  }

  candidates.sort(
    (a, b) =>
      b.score - a.score,
  );

  const best =
    candidates[0];

  console.log(
    `Best candidate: ${best.result.url} | score=${best.score} | image=${best.imageUrl}`,
  );

  if (
    best.score < MIN_SCORE
  ) {
    console.warn(
      `Best score ${best.score} is below threshold ${MIN_SCORE}. Rejecting.`,
    );

    return [];
  }

  const output: string[] = [];
  const seenImages =
    new Set<string>();

  for (
    const candidate of candidates
  ) {
    if (
      candidate.score < MIN_SCORE
    ) {
      continue;
    }

    const cleaned =
      cleanUrl(
        candidate.imageUrl,
      );

    if (!cleaned) {
      continue;
    }

    if (
      !cleaned.startsWith(
        "https://",
      )
    ) {
      continue;
    }

    if (
      seenImages.has(cleaned)
    ) {
      continue;
    }

    seenImages.add(cleaned);
    output.push(cleaned);

    if (
      output.length >=
      MAX_IMAGE_CANDIDATES
    ) {
      break;
    }
  }

  console.log(
    `Returning ${output.length} image candidates.`,
  );

  return output;
}

/* ============================================================
   EVENT / WEBHOOK PARSING
   ============================================================ */

function stringValue(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function recordToEvent(
  record: Record<string, unknown>,
): EventSearchData {
  const existingImageUrl =
    stringValue(
      record.image_url,
    );

  return {
    id:
      stringValue(record.id) ||
      null,

    title:
      stringValue(record.title),

    category:
      stringValue(record.category),

    subcategory:
      stringValue(
        record.subcategory,
      ),

    venue:
      stringValue(record.venue),

    locality:
      stringValue(
        record.locality,
      ),

    district:
      stringValue(
        record.district,
      ),

    website:
      stringValue(
        record.website,
      ),

    ticketUrl:
      stringValue(
        record.ticket_url,
      ),

    existingImageUrl:
      existingImageUrl || null,
  };
}

function bodyToEvent(
  body: RequestBody,
): EventSearchData {
  return {
    id: null,

    title:
      stringValue(body.title),

    category:
      stringValue(body.category),

    subcategory:
      stringValue(
        body.subcategory,
      ),

    venue:
      stringValue(body.venue),

    locality:
      stringValue(
        body.locality,
      ),

    district:
      stringValue(
        body.district,
      ),

    website:
      stringValue(body.website),

    ticketUrl:
      stringValue(
        body.ticketUrl,
      ),

    existingImageUrl: null,
  };
}

/* ============================================================
   DIRECT / OFFICIAL PAGE SEARCH
   ============================================================ */

async function discoverDirectImages(
  event: EventSearchData,
  deadline: number,
): Promise<string[]> {
  const directUrls = [
    event.website,
    event.ticketUrl,
  ];

  const output: string[] = [];
  const seenImages =
    new Set<string>();

  for (
    const rawUrl of directUrls
  ) {
    if (!hasTime(deadline)) {
      break;
    }

    if (!rawUrl) {
      continue;
    }

    const url =
      cleanUrl(rawUrl);

    if (!url) {
      continue;
    }

    console.log(
      `Trying direct event URL: ${url}`,
    );

    const page =
      await fetchPage(
        url,
        deadline,
      );

    if (!page) {
      continue;
    }

    const imageUrls =
      extractPageImages(
        page.html,
        page.finalUrl,
      );

    if (
      imageUrls.length === 0
    ) {
      continue;
    }

    console.log(
      `Found ${imageUrls.length} image candidate(s) from direct URL.`,
    );

    for (
      const imageUrl of imageUrls
    ) {
      const cleaned =
        cleanUrl(imageUrl);

      if (!cleaned) {
        continue;
      }

      if (
        !cleaned.startsWith(
          "https://",
        )
      ) {
        continue;
      }

      if (
        seenImages.has(cleaned)
      ) {
        continue;
      }

      seenImages.add(cleaned);
      output.push(cleaned);

      if (
        output.length >=
        MAX_IMAGE_CANDIDATES
      ) {
        return output;
      }
    }
  }

  return output;
}

/* ============================================================
   MAIN IMAGE DISCOVERY
   ============================================================ */

async function discoverAllImages(
  event: EventSearchData,
  deadline: number,
): Promise<{
  imageUrls: string[];
  method: string;
}> {
  /*
   * STEP 1
   *
   * Official website / ticket page.
   */
  const directImages =
    await discoverDirectImages(
      event,
      deadline,
    );

  if (
    directImages.length > 0
  ) {
    return {
      imageUrls:
        directImages,
      method:
        "official-url",
    };
  }

  if (!hasTime(deadline)) {
    return {
      imageUrls: [],
      method: "timeout",
    };
  }

  /*
   * STEP 2
   *
   * Wikimedia Commons.
   *
   * This is deliberately BEFORE DuckDuckGo.
   */
  const wikimediaImages =
    await discoverWikimediaImages(
      event,
      deadline,
    );

  if (
    wikimediaImages.length > 0
  ) {
    return {
      imageUrls:
        wikimediaImages,
      method:
        "wikimedia-commons",
    };
  }

  if (!hasTime(deadline)) {
    return {
      imageUrls: [],
      method: "timeout",
    };
  }

  /*
   * STEP 3
   *
   * DuckDuckGo.
   *
   * DDG is now a secondary fallback rather than the only
   * search source.
   */
  const discoveredImages =
    await discoverImages(
      event,
      deadline,
    );

  if (
    discoveredImages.length > 0
  ) {
    return {
      imageUrls:
        discoveredImages,
      method:
        "duckduckgo",
    };
  }

  return {
    imageUrls: [],
    method: hasTime(deadline)
      ? "none"
      : "timeout",
  };
}

/* ============================================================
   SUPABASE DATABASE UPDATE
   ============================================================ */

async function updateEventImages(
  eventId: string,
  imageUrls: string[],
): Promise<void> {
  const supabaseUrl =
    Deno.env.get(
      "SUPABASE_URL",
    );

  const serviceRoleKey =
    Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.",
    );
  }

  const supabase =
    createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

  if (
    imageUrls.length === 0
  ) {
    console.log(
      `No images found for event ${eventId}; database remains unchanged.`,
    );

    return;
  }

  const imageUrl =
    imageUrls[0];

  const { error } =
    await supabase
      .from("events")
      .update({
        image_url:
          imageUrl,

        image_candidates:
          imageUrls,
      })
      .eq(
        "id",
        eventId,
      );

  if (error) {
    throw new Error(
      `Failed to update event ${eventId}: ${error.message}`,
    );
  }

  console.log(
    `Updated event ${eventId} with ${imageUrls.length} image candidate(s).`,
  );
}

/* ============================================================
   RESPONSE
   ============================================================ */

function jsonResponse(
  body: SearchResponse,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json",
      },
    },
  );
}

/* ============================================================
   HTTP HANDLER
   ============================================================ */

Deno.serve(async (req) => {
  /*
   * CORS preflight.
   */
  if (
    req.method === "OPTIONS"
  ) {
    return new Response(
      "ok",
      {
        headers:
          corsHeaders,
      },
    );
  }

  if (
    req.method !== "POST"
  ) {
    return jsonResponse(
      {
        imageUrl: null,
        imageUrls: [],
        method: "none",
        error:
          "Method not allowed",
      },
      405,
    );
  }

  const deadline =
    createDeadline();

  try {
    const body =
      (await req.json()) as RequestBody;

    /*
     * Determine whether this is a Supabase
     * Database Webhook payload.
     */
    const isWebhook =
      Boolean(
        body.record &&
        typeof body.record ===
          "object",
      );

    let event:
      EventSearchData;

    if (isWebhook) {
      event =
        recordToEvent(
          body.record!,
        );

      console.log(
        "Received Supabase Database Webhook payload.",
      );

      /*
       * Only process INSERT webhooks.
       */
      if (
        body.type &&
        body.type !== "INSERT"
      ) {
        return jsonResponse({
          imageUrl: null,
          imageUrls: [],
          method:
            "ignored",
          eventId:
            event.id,
        });
      }

      if (
        body.table &&
        body.table !== "events"
      ) {
        return jsonResponse({
          imageUrl: null,
          imageUrls: [],
          method:
            "ignored",
          eventId:
            event.id,
        });
      }

      if (
        body.schema &&
        body.schema !==
          "public"
      ) {
        return jsonResponse({
          imageUrl: null,
          imageUrls: [],
          method:
            "ignored",
          eventId:
            event.id,
        });
      }
    } else {
      event =
        bodyToEvent(body);

      console.log(
        "Received direct image-search request.",
      );
    }

    console.log(
      "Automatic image search request:",
      JSON.stringify({
        eventId:
          event.id,

        title:
          event.title,

        category:
          event.category,

        subcategory:
          event.subcategory,

        venue:
          event.venue,

        locality:
          event.locality,

        district:
          event.district,

        hasWebsite:
          Boolean(
            event.website,
          ),

        hasTicketUrl:
          Boolean(
            event.ticketUrl,
          ),

        hasExistingImage:
          Boolean(
            event.existingImageUrl,
          ),

        isWebhook,
      }),
    );

    /*
     * Validate title.
     */
    if (!event.title) {
      return jsonResponse(
        {
          imageUrl: null,
          imageUrls: [],
          method: "none",
          eventId: event.id,
          error:
            "Event title is required.",
        },
        400,
      );
    }

    /*
     * MANUAL IMAGE PRIORITY
     *
     * Never replace a manually uploaded poster.
     */
    if (
      event.existingImageUrl
    ) {
      console.log(
        `Event ${event.id ?? "(direct request)"} already has a manual image. Skipping automatic search.`,
      );

      return jsonResponse({
        imageUrl:
          event.existingImageUrl,

        imageUrls: [
          event.existingImageUrl,
        ],

        method:
          "manual-existing",

        eventId:
          event.id,
      });
    }

    /*
     * SEARCH
     */
    const {
      imageUrls,
      method,
    } =
      await discoverAllImages(
        event,
        deadline,
      );

    /*
     * NO IMAGE
     */
    if (
      imageUrls.length === 0
    ) {
      console.warn(
        `No suitable automatic image found for event ${event.id ?? "(direct request)"}. Method=${method}`,
      );

      return jsonResponse({
        imageUrl: null,
        imageUrls: [],
        method,
        eventId: event.id,
      });
    }

    const imageUrl =
      imageUrls[0];

    /*
     * WEBHOOK MODE
     *
     * Event already exists in database.
     */
    if (
      isWebhook &&
      event.id
    ) {
      /*
       * Check budget before database update.
       */
      if (
        hasTime(deadline)
      ) {
        await updateEventImages(
          event.id,
          imageUrls,
        );
      } else {
        console.warn(
          `Search succeeded but timeout budget expired before database update for ${event.id}.`,
        );
      }
    }

    console.log(
      `Automatic image search succeeded: ${JSON.stringify(
        imageUrls,
      )}`,
    );

    return jsonResponse({
      imageUrl,
      imageUrls,
      method,
      eventId:
        event.id,
    });
  } catch (error) {
    console.error(
      "search-event-image failed:",
      error,
    );

    /*
     * Image search failure must NEVER prevent
     * the event itself from existing.
     */
    return jsonResponse({
      imageUrl: null,
      imageUrls: [],
      method: "none",
      error:
        error instanceof Error
          ? error.message
          : "Unknown error",
    });
  }
});