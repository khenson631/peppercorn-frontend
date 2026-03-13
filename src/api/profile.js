import { API_BASE_URL } from "../config.js";

/**
 * Fetch profile data for a ticker.
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Object|null>} Profile data or null on error
 */
export async function fetchProfile(ticker) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/profile/${encodeURIComponent(ticker)}`);
    return await res.json();
  } catch (err) {
    console.error("Error fetching profile:", err);
    return null;
  }
}
