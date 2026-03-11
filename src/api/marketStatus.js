import { API_BASE_URL } from "../config.js";

export async function fetchMarketStatus(exchange = "US") {
  try {
    const res = await fetch(`${API_BASE_URL}/api/marketStatus`);
    const arr = await res.json();
    return Array.isArray(arr) ? arr : [];
  } catch(error) {
    console.error("fetchMarketStatus failed: ", error);
  }
    
}