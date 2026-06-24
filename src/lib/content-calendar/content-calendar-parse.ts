export type ParsedGeneratedPost = {
  caption?: string;
  visualPrompt?: string | null;
  hashtags?: string[];
  dayIndex?: number;
  postType?: string;
  targetGroup?: string;
};

function normalizeSmartQuotes(text: string): string {
  return text
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\uFEFF/g, "");
}

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractBalancedJson(text: string, open: "{" | "["): string | null {
  const close = open === "{" ? "}" : "]";
  const start = text.indexOf(open);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) depth += 1;
    if (ch === close) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

function tryParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function repairJsonStringNewlines(json: string): string {
  let out = "";
  let inString = false;
  let escape = false;

  for (let i = 0; i < json.length; i += 1) {
    const ch = json[i];
    if (inString) {
      if (escape) {
        escape = false;
        out += ch;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        out += ch;
        continue;
      }
      if (ch === '"') {
        inString = false;
        out += ch;
        continue;
      }
      if (ch === "\n") {
        out += "\\n";
        continue;
      }
      if (ch === "\r") {
        continue;
      }
      out += ch;
      continue;
    }

    if (ch === '"') {
      inString = true;
    }
    out += ch;
  }

  return out;
}

function unescapeJsonString(value: string): string {
  return value.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function parseHashtagsFromFragment(fragment: string): string[] {
  const tags: string[] = [];
  for (const match of fragment.matchAll(/"((?:\\.|[^"\\])*)"/g)) {
    const tag = unescapeJsonString(match[1]).trim();
    if (tag) tags.push(tag.replace(/^#/, ""));
  }
  return tags;
}

function parseFieldsWithRegex(text: string): ParsedGeneratedPost | null {
  const captionMatch =
    text.match(/"caption"\s*:\s*"((?:\\.|[^"\\])*)"/) ??
    text.match(/"caption"\s*:\s*"([\s\S]*?)"\s*,\s*"(?:visualPrompt|hashtags)"/);

  if (!captionMatch?.[1]) return null;

  const visualMatch =
    text.match(/"visualPrompt"\s*:\s*(null|"((?:\\.|[^"\\])*)")/) ??
    text.match(/"visualPrompt"\s*:\s*"([\s\S]*?)"\s*,\s*"hashtags"/);

  const hashtagsMatch = text.match(/"hashtags"\s*:\s*\[([\s\S]*?)\]/);

  return {
    caption: unescapeJsonString(captionMatch[1]).trim(),
    visualPrompt:
      visualMatch?.[1] === "null" || visualMatch?.[0]?.includes("null")
        ? null
        : visualMatch?.[2]
          ? unescapeJsonString(visualMatch[2])
          : visualMatch?.[1]
            ? unescapeJsonString(visualMatch[1])
            : undefined,
    hashtags: hashtagsMatch?.[1] ? parseHashtagsFromFragment(hashtagsMatch[1]) : [],
  };
}

function normalizeParsedPost(raw: ParsedGeneratedPost | null | undefined): ParsedGeneratedPost | null {
  if (!raw || typeof raw !== "object") return null;
  const caption = typeof raw.caption === "string" ? raw.caption.trim() : "";
  if (!caption) return null;
  return {
    ...raw,
    caption,
    hashtags: Array.isArray(raw.hashtags)
      ? raw.hashtags.map((tag) => String(tag).replace(/^#/, "").trim()).filter(Boolean)
      : [],
    visualPrompt:
      raw.visualPrompt === null
        ? null
        : typeof raw.visualPrompt === "string"
          ? raw.visualPrompt
          : undefined,
  };
}

function parseProseFallback(text: string): ParsedGeneratedPost | null {
  const trimmed = stripMarkdownFences(normalizeSmartQuotes(text)).trim();
  if (trimmed.length < 40) return null;
  if (/^[\[{]/.test(trimmed)) return null;
  if (/^Generation failed for /i.test(trimmed)) return null;
  return { caption: trimmed, hashtags: [] };
}

export function parseGeneratedPostPayload(text: string): ParsedGeneratedPost | null {
  const normalized = stripMarkdownFences(normalizeSmartQuotes(text)).trim();
  if (!normalized) return null;

  const objectJson = extractBalancedJson(normalized, "{");
  const arrayJson = extractBalancedJson(normalized, "[");

  for (const candidate of [normalized, objectJson, arrayJson].filter(Boolean) as string[]) {
    const direct = tryParseJson<ParsedGeneratedPost | ParsedGeneratedPost[] | { posts?: ParsedGeneratedPost[] }>(
      candidate,
    );
    if (Array.isArray(direct)) return normalizeParsedPost(direct[0]);
    if (direct && typeof direct === "object") {
      if ("caption" in direct) return normalizeParsedPost(direct as ParsedGeneratedPost);
      if ("posts" in direct && Array.isArray(direct.posts)) return normalizeParsedPost(direct.posts[0]);
    }

    const repaired = tryParseJson<ParsedGeneratedPost | ParsedGeneratedPost[] | { posts?: ParsedGeneratedPost[] }>(
      repairJsonStringNewlines(candidate),
    );
    if (Array.isArray(repaired)) return normalizeParsedPost(repaired[0]);
    if (repaired && typeof repaired === "object") {
      if ("caption" in repaired) return normalizeParsedPost(repaired as ParsedGeneratedPost);
      if ("posts" in repaired && Array.isArray(repaired.posts)) return normalizeParsedPost(repaired.posts[0]);
    }
  }

  const regexParsed = normalizeParsedPost(parseFieldsWithRegex(normalized));
  if (regexParsed) return regexParsed;

  return normalizeParsedPost(parseProseFallback(normalized));
}

export function parseGeneratedPostArrayPayload(text: string): ParsedGeneratedPost[] | null {
  const normalized = stripMarkdownFences(normalizeSmartQuotes(text)).trim();
  if (!normalized) return null;

  const arrayJson = extractBalancedJson(normalized, "[");
  const objectJson = extractBalancedJson(normalized, "{");

  for (const candidate of [normalized, arrayJson, objectJson].filter(Boolean) as string[]) {
    const direct = tryParseJson<ParsedGeneratedPost[] | { posts?: ParsedGeneratedPost[] }>(candidate);
    if (Array.isArray(direct)) {
      const rows = direct.map((row) => normalizeParsedPost(row)).filter(Boolean) as ParsedGeneratedPost[];
      return rows.length ? rows : null;
    }
    if (direct && typeof direct === "object" && Array.isArray(direct.posts)) {
      const rows = direct.posts.map((row) => normalizeParsedPost(row)).filter(Boolean) as ParsedGeneratedPost[];
      return rows.length ? rows : null;
    }

    const repaired = tryParseJson<ParsedGeneratedPost[] | { posts?: ParsedGeneratedPost[] }>(
      repairJsonStringNewlines(candidate),
    );
    if (Array.isArray(repaired)) {
      const rows = repaired.map((row) => normalizeParsedPost(row)).filter(Boolean) as ParsedGeneratedPost[];
      return rows.length ? rows : null;
    }
    if (repaired && typeof repaired === "object" && Array.isArray(repaired.posts)) {
      const rows = repaired.posts.map((row) => normalizeParsedPost(row)).filter(Boolean) as ParsedGeneratedPost[];
      return rows.length ? rows : null;
    }
  }

  const single = parseGeneratedPostPayload(normalized);
  return single ? [single] : null;
}
