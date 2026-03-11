import { API_BASE_URL } from "../config.js";

export async function fetchMarketNews(category = "general", minId = 0) {
    try {
        const url = `${API_BASE_URL}/api/market-news?category=${encodeURIComponent(category)}` +
        (minId ? `&minId=${minId}` : "");
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed fetching market news");
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    } catch(error) {
        console.error("fetchMarketNews failed: ", error)
    }

}