/**
 * Shared helper utilities. Import in main.js or other modules as needed.
 */

/**
 * Returns true if the string looks like a safe http(s) URL for use in href/src.
 * @param {string} url
 * @returns {boolean}
 */
export function isSafeUrl(url) {
  if (typeof url !== "string" || !url.trim()) return false;
  const u = url.trim().toLowerCase();
  return u.startsWith("https://") || u.startsWith("http://");
}

/**
 * Returns a safe image URL for use in img src, or null if invalid.
 * Allows http, https, and protocol-relative (//) URLs; normalizes // to https.
 * @param {string} url
 * @returns {string|null}
 */
export function getSafeImageUrl(url) {
  if (typeof url !== "string" || !url.trim()) return null;
  const u = url.trim();
  const lower = u.toLowerCase();
  if (lower.startsWith("https://") || lower.startsWith("http://")) return u;
  if (lower.startsWith("//")) return "https:" + u;
  return null;
}

/**
 * Strip HTML tags and decode common entities so API content can be shown as plain text safely.
 * @param {string} html
 * @returns {string}
 */
export function htmlToPlainText(html) {
  if (typeof html !== "string") return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, "\u00A0")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatNumber(n) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Market time display string in EST (open: "As of H:MM:SS AM/PM EST", closed: "At close 4:00:00 PM EST").
 * @returns {string}
 */
export function getMarketTimeDisplay() {
  const now = new Date();
  const estTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const hours = estTime.getHours();
  const minutes = estTime.getMinutes();
  const seconds = estTime.getSeconds();
  const isMarketOpen =
    hours >= 9 && hours < 16 && !(hours === 9 && minutes < 30);
  if (isMarketOpen) {
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    const displayMinutes = String(minutes).padStart(2, "0");
    const displaySeconds = String(seconds).padStart(2, "0");
    return `As of ${displayHours}:${displayMinutes}:${displaySeconds} ${ampm} EST`;
  }
  return "At close 4:00:00 PM EST";
}