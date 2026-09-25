import { createClient } from "supabase";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestBody = {
  title?: string;
  category?: string;
  subcategory?: string;
  venue?: string;
  locality?: string;
  district?: string;
  website?: string;
  ticketUrl?: string;
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

function normalize(value: string | undefined | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(value: string | undefined | null): string[] {
  return normalize(value)
    .split(" ")
    .filter((word) => word.length >= 2);
}

function cleanUrl(value: string): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);

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

/**
 * Converts DuckDuckGo redirect links into the actual destination.
 *
 * Examples:
 * /l/?uddg=https%3A%2F%2Fexample.com
 *
 * or:
 * https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com
 */
function extractRedirectUrl(href: string): string | null {
  if (!href) return null;

  const decoded = decodeHtml(href).trim();

  if (!decoded) return null;

  // Direct absolute URL.
  if (/^https?:\/\//i.test(decoded)) {
    try {
      const url = new URL(decoded);
      const hostname = url.hostname.toLowerCase();

      // DuckDuckGo redirect URL.
      if (
        hostname === "duckduckgo.com" ||
        hostname.endsWith(".duckduckgo.com")
      ) {
        const uddg = url.searchParams.get("uddg");

        if (uddg && /^https?:\/\//i.test(uddg)) {
          return decodeURIComponent(uddg);
        }

        return null;
      }

      return decoded;
    } catch {
      return null;
    }
  }

  // Relative DuckDuckGo redirect.
  //
  // IMPORTANT:
  // /html/ itself is NOT a candidate page.
  // Only accept a relative URL if it contains a real uddg destination.
  if (decoded.startsWith("/")) {
    try {
      const url = new URL(
        decoded,
        "https://html.duckduckgo.com",
      );

      const uddg = url.searchParams.get("uddg");

      if (uddg && /^https?:\/\//i.test(uddg)) {
        return decodeURIComponent(uddg);
      }

      return null;
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

  /*
   * Normal DuckDuckGo result links.
   */
  const anchorRegex =
    /<a\b[^>]*class=["'][^"']*(?:result__a|result-link)[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;

  while ((match = anchorRegex.exec(html)) !== null) {
    const rawHref = decodeHtml(match[1]);
    const title = stripHtml(match[2]).trim();

    if (!rawHref || !title) continue;

    const extractedUrl = extractRedirectUrl(rawHref);

    if (!extractedUrl) continue;

    let url: string;

    try {
      url = new URL(
        extractedUrl,
        "https://html.duckduckgo.com",
      ).toString();
    } catch {
      continue;
    }

    const hostname = new URL(url).hostname.toLowerCase();

    /*
     * Never treat DuckDuckGo itself as an event result.
     *
     * This prevents errors such as:
     *
     * Invalid URL: '/html/'
     */
    if (
      hostname === "duckduckgo.com" ||
      hostname.endsWith(".duckduckgo.com")
    ) {
      continue;
    }

    if (!/^https?:\/\//i.test(url)) continue;

    results.push({
      title,
      url,
    });
  }

  /*
   * Fallback parser.
   */
  if (results.length === 0) {
    const fallbackRegex =
      /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    while ((match = fallbackRegex.exec(html)) !== null) {
      const rawHref = decodeHtml(match[1]);
      const title = stripHtml(match[2]).trim();

      if (!rawHref || !title) continue;

      const extractedUrl = extractRedirectUrl(rawHref);

      if (!extractedUrl) continue;

      let url: string;

      try {
        url = new URL(
          extractedUrl,
          "https://html.duckduckgo.com",
        ).toString();
      } catch {
        continue;
      }

      const hostname = new URL(url).hostname.toLowerCase();

      if (
        hostname === "duckduckgo.com" ||
        hostname.endsWith(".duckduckgo.com")
      ) {
        continue;
      }

      if (!/^https?:\/\//i.test(url)) continue;

      const lowerTitle = title.toLowerCase();

      if (
        lowerTitle === "images" ||
        lowerTitle === "videos" ||
        lowerTitle === "news" ||
        lowerTitle === "maps" ||
        lowerTitle === "shopping" ||
        lowerTitle === "more"
      ) {
        continue;
      }

      results.push({
        title,
        url,
      });
    }
  }

  /*
   * Remove duplicate URLs.
   */
  const unique = new Map<string, SearchResult>();

  for (const result of results) {
    const normalizedUrl = cleanUrl(result.url);

    if (!normalizedUrl) continue;

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
): Promise<SearchResult[]> {
  const encodedQuery = encodeURIComponent(query);

  const urls = [
    `https://html.duckduckgo.com/html/?q=${encodedQuery}&kl=in-en`,
    `https://lite.duckduckgo.com/lite/?q=${encodedQuery}&kl=in-en`,
  ];

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
    Referer: "https://www.google.com/",
  };

  for (const searchUrl of urls) {
    try {
      console.log(`Searching DuckDuckGo: ${query}`);

      const response = await fetch(searchUrl, {
        headers,
        redirect: "follow",
      });

      console.log(
        `DuckDuckGo HTTP status: ${response.status}`,
      );

      if (!response.ok) {
        console.warn(
          `DuckDuckGo request failed: ${response.status}`,
        );
        continue;
      }

      const html = await response.text();

      console.log(
        `DuckDuckGo returned ${html.length} characters`,
      );

      const results = parseDuckDuckGoResults(html);

      console.log(
        `DuckDuckGo query "${query}" returned ${results.length} results`,
      );

      if (results.length > 0) {
        return results;
      }
    } catch (error) {
      console.error(
        `DuckDuckGo search failed for "${query}":`,
        error,
      );
    }
  }

  console.warn(
    `No DuckDuckGo search results found for "${query}"`,
  );

  return [];
}

function getMetaContent(
  html: string,
  property: string,
): string | null {
  const escaped = property.replace(
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
    const match = html.match(pattern);

    if (match?.[1]) {
      return decodeHtml(match[1]).trim();
    }
  }

  return null;
}

function extractPageImage(
  html: string,
  pageUrl: string,
): string | null {
  const candidates = [
    getMetaContent(html, "og:image"),
    getMetaContent(html, "og:image:url"),
    getMetaContent(html, "twitter:image"),
    getMetaContent(html, "twitter:image:src"),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    const absolute = absolutizeUrl(
      candidate,
      pageUrl,
    );

    if (!absolute) continue;

    const cleaned = cleanUrl(absolute);

    if (cleaned) {
      return cleaned;
    }
  }

  return null;
}

async function fetchPage(
  url: string,
): Promise<{
  html: string;
  finalUrl: string;
} | null> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
      },
    });

    if (!response.ok) {
      console.warn(
        `Could not fetch candidate page ${url}: HTTP ${response.status}`,
      );

      return null;
    }

    const contentType =
      response.headers.get("content-type") ?? "";

    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      console.warn(
        `Candidate page is not HTML: ${url} (${contentType})`,
      );

      return null;
    }

    const html = await response.text();

    return {
      html,
      finalUrl: response.url || url,
    };
  } catch (error) {
    console.warn(
      `Could not fetch candidate page ${url}:`,
      error,
    );

    return null;
  }
}

function scoreCandidate(
  result: SearchResult,
  event: RequestBody,
): number {
  const titleText = normalize(event.title);
  const subcategoryText = normalize(event.subcategory);
  const venueText = normalize(event.venue);
  const localityText = normalize(event.locality);
  const districtText = normalize(event.district);
  const categoryText = normalize(event.category);

  const resultTitle = normalize(result.title);
  const resultUrl = normalize(result.url);

  let score = 0;

  /*
   * Exact title match.
   */
  if (
    titleText.length > 0 &&
    resultTitle.includes(titleText)
  ) {
    score += 45;
  }

  /*
   * Individual title-word matches.
   */
  const titleWords = words(event.title);

  let titleWordMatches = 0;

  for (const word of titleWords) {
    if (resultTitle.includes(word)) {
      titleWordMatches++;
    }
  }

  score += Math.min(titleWordMatches, 8) * 5;

  /*
   * Context matching.
   */
  if (
    subcategoryText &&
    resultTitle.includes(subcategoryText)
  ) {
    score += 15;
  }

  if (
    venueText &&
    resultTitle.includes(venueText)
  ) {
    score += 12;
  }

  if (
    localityText &&
    resultTitle.includes(localityText)
  ) {
    score += 8;
  }

  if (
    districtText &&
    resultTitle.includes(districtText)
  ) {
    score += 6;
  }

  if (
    categoryText &&
    resultTitle.includes(categoryText)
  ) {
    score += 4;
  }

  /*
   * URL/context signals.
   */
  if (
    resultUrl.includes("instagram") ||
    resultUrl.includes("facebook") ||
    resultUrl.includes("youtube") ||
    resultUrl.includes("x.com") ||
    resultUrl.includes("twitter")
  ) {
    score += 2;
  }

  if (resultUrl.includes("wikipedia")) {
    score += 1;
  }

  /*
   * Very short titles are less reliable.
   */
  if (titleText.length < 15) {
    score -= 5;
  }

  return score;
}

function buildQueries(
  event: RequestBody,
): string[] {
  const title = (event.title ?? "").trim();
  const locality = (event.locality ?? "").trim();
  const district = (event.district ?? "").trim();
  const subcategory = (event.subcategory ?? "").trim();
  const venue = (event.venue ?? "").trim();

  const queries = [
    title,
    title ? `${title} comedian` : "",
    title ? `${title} artist` : "",
    title ? `${title} event` : "",
    title && locality ? `${title} ${locality}` : "",
    title && district ? `${title} ${district}` : "",
    title && subcategory
      ? `${title} ${subcategory}`
      : "",
    title && venue ? `${title} ${venue}` : "",
  ];

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    const normalized = normalize(query);

    if (!normalized) continue;

    if (seen.has(normalized)) continue;

    seen.add(normalized);
    unique.push(query.trim());
  }

  return unique;
}

async function discoverImage(
  event: RequestBody,
): Promise<string | null> {
  const queries = buildQueries(event);

  console.log(
    `Search queries: ${JSON.stringify(queries)}`,
  );

  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();

  /*
   * Search progressively.
   *
   * We don't use one huge over-constrained query.
   */
  for (const query of queries.slice(0, 7)) {
    const results = await searchDuckDuckGo(query);

    for (const result of results) {
      const normalizedUrl = cleanUrl(result.url);

      if (!normalizedUrl) continue;

      if (seenUrls.has(normalizedUrl)) continue;

      seenUrls.add(normalizedUrl);

      allResults.push({
        title: result.title,
        url: normalizedUrl,
      });

      /*
       * Don't allow the search to grow indefinitely.
       */
      if (allResults.length >= 20) {
        break;
      }
    }

    if (allResults.length >= 20) {
      break;
    }
  }

  console.log(
    `Found ${allResults.length} unique search results.`,
  );

  if (allResults.length === 0) {
    return null;
  }

  const candidates: PageCandidate[] = [];

  /*
   * Fetch candidate pages and inspect their metadata.
   */
  for (const result of allResults.slice(0, 20)) {
    const page = await fetchPage(result.url);

    if (!page) {
      continue;
    }

    const imageUrl = extractPageImage(
      page.html,
      page.finalUrl,
    );

    if (!imageUrl) {
      console.log(
        `No usable image metadata found on ${result.url}`,
      );

      continue;
    }

    const score = scoreCandidate(
      result,
      event,
    );

    console.log(
      `Candidate: ${result.url} | score=${score} | image=${imageUrl}`,
    );

    candidates.push({
      result,
      imageUrl,
      score,
    });
  }

  if (candidates.length === 0) {
    console.warn(
      "Search results were found, but no candidate page exposed a usable image.",
    );

    return null;
  }

  candidates.sort(
    (a, b) => b.score - a.score,
  );

  const best = candidates[0];

  console.log(
    `Best candidate: ${best.result.url} | score=${best.score} | image=${best.imageUrl}`,
  );

  /*
   * Require a minimum relevance score so that
   * random images aren't attached to events.
   */
  if (best.score < 20) {
    console.warn(
      `Best candidate score ${best.score} is below threshold 20.`,
    );

    return null;
  }

  return best.imageUrl;
}

function getImageExtension(
  contentType: string,
  url: string,
): string {
  const type = contentType.toLowerCase();

  if (type.includes("image/jpeg")) {
    return "jpg";
  }

  if (type.includes("image/png")) {
    return "png";
  }

  if (type.includes("image/webp")) {
    return "webp";
  }

  if (type.includes("image/gif")) {
    return "gif";
  }

  if (type.includes("image/avif")) {
    return "avif";
  }

  try {
    const pathname = new URL(url).pathname.toLowerCase();

    if (pathname.endsWith(".jpeg")) return "jpg";
    if (pathname.endsWith(".jpg")) return "jpg";
    if (pathname.endsWith(".png")) return "png";
    if (pathname.endsWith(".webp")) return "webp";
    if (pathname.endsWith(".gif")) return "gif";
    if (pathname.endsWith(".avif")) return "avif";
  } catch {
    // Ignore invalid URL extension.
  }

  return "jpg";
}

async function downloadImage(
  imageUrl: string,
): Promise<{
  bytes: Uint8Array;
  contentType: string;
  extension: string;
} | null> {
  try {
    const response = await fetch(imageUrl, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        Referer: imageUrl,
      },
    });

    if (!response.ok) {
      console.warn(
        `Could not download image: HTTP ${response.status}`,
      );

      return null;
    }

    const contentType =
      response.headers.get("content-type") ??
      "image/jpeg";

    if (!contentType.toLowerCase().startsWith("image/")) {
      console.warn(
        `URL did not return an image: ${contentType}`,
      );

      return null;
    }

    const contentLengthHeader =
      response.headers.get("content-length");

    if (contentLengthHeader) {
      const contentLength =
        Number(contentLengthHeader);

      if (
        Number.isFinite(contentLength) &&
        contentLength > 12 * 1024 * 1024
      ) {
        console.warn(
          "Image is larger than 12 MB.",
        );

        return null;
      }
    }

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength === 0) {
      return null;
    }

    if (buffer.byteLength > 12 * 1024 * 1024) {
      console.warn(
        "Downloaded image is larger than 12 MB.",
      );

      return null;
    }

    const bytes = new Uint8Array(buffer);

    const extension = getImageExtension(
      contentType,
      imageUrl,
    );

    return {
      bytes,
      contentType,
      extension,
    };
  } catch (error) {
    console.warn(
      `Could not download image ${imageUrl}:`,
      error,
    );

    return null;
  }
}

function createStorageClient() {
  const supabaseUrl =
    Deno.env.get("SUPABASE_URL");

  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl) {
    throw new Error(
      "SUPABASE_URL environment variable is missing.",
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY environment variable is missing.",
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

async function saveImageToStorage(
  imageUrl: string,
): Promise<string | null> {
  const downloaded =
    await downloadImage(imageUrl);

  if (!downloaded) {
    return null;
  }

  try {
    const supabase =
      createStorageClient();

    const fileName =
      `auto-${crypto.randomUUID()}.${downloaded.extension}`;

    const filePath =
      fileName;

    const { error: uploadError } =
      await supabase.storage
        .from("event-posters")
        .upload(
          filePath,
          downloaded.bytes,
          {
            contentType:
              downloaded.contentType,
            upsert: false,
            cacheControl: "31536000",
          },
        );

    if (uploadError) {
      console.error(
        "Failed to upload automatic image:",
        uploadError,
      );

      return null;
    }

    const {
      data: publicUrlData,
    } = supabase.storage
      .from("event-posters")
      .getPublicUrl(filePath);

    if (!publicUrlData?.publicUrl) {
      console.error(
        "Could not generate public storage URL.",
      );

      return null;
    }

    console.log(
      `Saved automatic image: ${publicUrlData.publicUrl}`,
    );

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error(
      "Failed to save image to storage:",
      error,
    );

    return null;
  }
}

Deno.serve(async (req) => {
  /*
   * CORS preflight.
   */
  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        headers: corsHeaders,
      },
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        imageUrl: null,
        error: "Method not allowed",
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      },
    );
  }

  try {
    const body =
      (await req.json()) as RequestBody;

    console.log(
      "Automatic image search request:",
      JSON.stringify({
        title: body.title,
        category: body.category,
        subcategory: body.subcategory,
        venue: body.venue,
        locality: body.locality,
        district: body.district,
        hasWebsite: Boolean(body.website),
        hasTicketUrl: Boolean(body.ticketUrl),
      }),
    );

    const title =
      body.title?.trim() ?? "";

    if (!title) {
      return new Response(
        JSON.stringify({
          imageUrl: null,
          error: "Event title is required.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    /*
     * ---------------------------------------------------------
     * STEP 1
     *
     * If the event has an official website or ticket URL,
     * try that page first.
     *
     * This gives official event posters priority.
     * ---------------------------------------------------------
     */
    const directUrls = [
      body.website,
      body.ticketUrl,
    ];

    for (const rawUrl of directUrls) {
      if (!rawUrl?.trim()) {
        continue;
      }

      const url = cleanUrl(
        rawUrl.trim(),
      );

      if (!url) {
        continue;
      }

      console.log(
        `Trying direct event URL: ${url}`,
      );

      const page =
        await fetchPage(url);

      if (!page) {
        continue;
      }

      const imageUrl =
        extractPageImage(
          page.html,
          page.finalUrl,
        );

      if (!imageUrl) {
        console.log(
          `No image metadata found on direct URL: ${url}`,
        );

        continue;
      }

      console.log(
        `Found image from official/direct URL: ${imageUrl}`,
      );

      const storedUrl =
        await saveImageToStorage(
          imageUrl,
        );

      if (storedUrl) {
        return new Response(
          JSON.stringify({
            imageUrl: storedUrl,
            method: "official-url",
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type":
                "application/json",
            },
          },
        );
      }
    }

    /*
     * ---------------------------------------------------------
     * STEP 2
     *
     * Search DuckDuckGo using simple event-title queries.
     * ---------------------------------------------------------
     */
    const discoveredImage =
      await discoverImage(body);

    if (!discoveredImage) {
      console.warn(
        "No suitable automatic image found.",
      );

      /*
       * Fail safely.
       *
       * The event can still be published without an image.
       */
      return new Response(
        JSON.stringify({
          imageUrl: null,
          method: "none",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    /*
     * ---------------------------------------------------------
     * STEP 3
     *
     * Download the discovered image and store it in the
     * existing event-posters bucket.
     * ---------------------------------------------------------
     */
    const storedUrl =
      await saveImageToStorage(
        discoveredImage,
      );

    if (!storedUrl) {
      console.warn(
        "Image was discovered but could not be saved to storage.",
      );

      return new Response(
        JSON.stringify({
          imageUrl: null,
          method: "none",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    console.log(
      `Automatic image search succeeded: ${storedUrl}`,
    );

    return new Response(
      JSON.stringify({
        imageUrl: storedUrl,
        method: "duckduckgo",
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      },
    );
  } catch (error) {
    console.error(
      "search-event-image failed:",
      error,
    );

    /*
     * Never prevent event creation because automatic
     * image discovery failed.
     */
    return new Response(
      JSON.stringify({
        imageUrl: null,
        method: "none",
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      },
    );
  }
});