import { API_URL } from "./api";

/** Parses a string into a URL, accepting only http(s) so that links can never run scripts. */
export function safeHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Returns a privacy-friendly YouTube embed URL, or null if the link is not a YouTube video. */
export function youtubeEmbedUrl(raw: string): string | null {
  const url = safeHttpUrl(raw);
  if (!url) return null;

  const host = url.hostname.replace(/^www\./, "");
  let id: string | null = null;

  if (host === "youtu.be") {
    id = url.pathname.slice(1).split("/")[0] || null;
  } else if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      id = url.searchParams.get("v");
    } else {
      const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
      id = match ? match[1] : null;
    }
  }

  if (!id || !/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

/** Turns material_url into a downloadable absolute URL (relative `/uploads/...` goes to the API host). */
export function materialHref(raw: string): string | null {
  if (raw.startsWith("/uploads")) return `${API_URL}${raw}`;
  return safeHttpUrl(raw) ? raw.trim() : null;
}
