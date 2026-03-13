import { API_BASE_URL } from "../config.js";

/**
 * Fetch historical OHLC/chart data for a ticker.
 * @param {string} ticker - Stock ticker symbol
 * @param {string} [range="6mo"] - Range (e.g. 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, max)
 * @param {string} [interval="1d"] - Interval (e.g. 1m, 5m, 15m, 1h, 1d, 1wk, 1mo)
 * @returns {Promise<Array>} Array of bars { time, open, high, low, close, ... } or []
 */
export async function fetchHistory(ticker, range = "6mo", interval = "1d") {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/history/${encodeURIComponent(ticker)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`,
    );
    const json = await res.json();
    if (!json.data || !json.data.length) throw new Error("No chart data");
    return json.data.map((bar) => ({ ...bar, time: bar.time }));
  } catch (err) {
    return [];
  }
}
