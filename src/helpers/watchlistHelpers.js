import { API_BASE_URL } from "../config.js";

// --- Watchlist / anonymous id helpers (PoC using backend JSON store) ---
export function ensureAnonId() {
    try {
      let id = localStorage.getItem("peppercornAnonId");
      if (!id) {
        id =
          "anon-" +
          Date.now().toString(36) +
          "-" +
          Math.random().toString(36).slice(2, 10);
        localStorage.setItem("peppercornAnonId", id);
      }
      return id;
    } catch (err) {
      return null;
    }
  }
  
  export async function fetchWatchlistForAnon(anonId) {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/watchlist?anonId=${encodeURIComponent(anonId)}`,
      );
      if (!res.ok) throw new Error("failed");
      const json = await res.json();
      return Array.isArray(json.symbols) ? json.symbols : [];
    } catch (err) {
      return [];
    }
  }
  
  export async function addTickerToWatchlist(anonId, ticker) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-anon-id": anonId },
        body: JSON.stringify({ ticker }),
      });
      if (!res.ok) throw new Error("add failed");
      const json = await res.json();
      return Array.isArray(json.symbols) ? json.symbols : null;
    } catch (err) {
      console.error("Add watchlist error", err);
      return null;
    }
  }
  
  export async function removeTickerFromWatchlist(anonId, ticker) {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/watchlist/${encodeURIComponent(ticker)}`,
        {
          method: "DELETE",
          headers: { "x-anon-id": anonId },
        },
      );
      if (!res.ok) throw new Error("delete failed");
      const json = await res.json();
      return Array.isArray(json.symbols) ? json.symbols : null;
    } catch (err) {
      console.error("Remove watchlist error", err);
      return null;
    }
  }
  