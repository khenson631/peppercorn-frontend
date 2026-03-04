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
