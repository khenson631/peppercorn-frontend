import { API_BASE_URL } from "../config.js";

/**
 * Fetch score data for a ticker.
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Object>} Score response (label, confidence, currentPrice, etc.)
 * @throws {Error} On network failure or non-OK response
 */
export async function fetchScore(ticker) {
  const res = await fetch(`${API_BASE_URL}/api/score/${encodeURIComponent(ticker)}`);
  if (!res.ok) throw new Error("score fetch failed");
  return res.json();
}
