import { formatNumber } from "../helpers/helpers.js";
import { ensureAnonId, fetchWatchlistForAnon, removeTickerFromWatchlist } from "../helpers/watchlistHelpers.js";
import { fetchScore } from "../api/score.js";

let onTickerClick = null;

/**
 * Mount the watchlist view into the given container.
 * @param {HTMLElement} container - The element to render into (e.g. #watchlistContainer)
 * @param {Object} [options]
 * @param {Function} [options.onTickerClick] - Callback when a ticker is clicked (receives ticker string)
 */
export async function mount(container, options = {}) {
  if (!container) return;
  onTickerClick = options.onTickerClick || null;
  container.style.display = "block";
  await refreshView(container);
}

export function unmount(container) {
  if (!container) return;
  container.style.display = "none";
  container.innerHTML = "";
  onTickerClick = null;
}

async function fetchWatchlistWithScores(anonId) {
  try {
    const symbols = await fetchWatchlistForAnon(anonId);
    if (!Array.isArray(symbols) || symbols.length === 0) return [];

    const fetchScoreForRow = async (sym) => {
      try {
        const json = await fetchScore(sym);
        return {
          ticker: (json.ticker || sym).toUpperCase(),
          companyName: json.companyName || (json.label ? json.label : sym),
          currentPrice: typeof json.currentPrice === "number" ? json.currentPrice : null,
          dailyChange: typeof json.dailyChange === "number" ? json.dailyChange : null,
          dailyChangePercent: typeof json.dailyChangePercent === "number" ? json.dailyChangePercent : null,
        };
      } catch {
        return {
          ticker: String(sym).toUpperCase(),
          companyName: sym,
          currentPrice: null,
          dailyChange: null,
          dailyChangePercent: null,
        };
      }
    };

    const results = await Promise.all(symbols.map(fetchScoreForRow));
    results.sort((a, b) => a.ticker.localeCompare(b.ticker));
    return results;
  } catch (err) {
    console.error("Error fetching watchlist with scores", err);
    return [];
  }
}

function renderRows(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "watch-empty";
    empty.textContent = "No tickers in your Watchlist. Star a ticker to add it.";
    return empty;
  }

  const table = document.createElement("div");
  table.className = "watchlist-table";

  const header = document.createElement("div");
  header.className = "watch-header";
  [
    { text: "Ticker", cls: "ticker" },
    { text: "Name", cls: "name" },
    { text: "Price", cls: "price" },
    { text: "$ Change", cls: "change" },
    { text: "% Change", cls: "changePct" },
    { text: "", cls: "action" },
  ].forEach(({ text, cls }) => {
    const col = document.createElement("div");
    col.className = "col " + cls;
    col.textContent = text;
    header.appendChild(col);
  });
  table.appendChild(header);

  const rowsWrap = document.createElement("div");
  rowsWrap.className = "watch-rows";

  items.forEach((item) => {
    const sign = item.dailyChange > 0 ? "+" : "";
    const changeClass = item.dailyChange > 0 ? "pos" : item.dailyChange < 0 ? "neg" : "neutral";
    const row = document.createElement("div");
    row.className = "watch-row";
    row.dataset.ticker = item.ticker;

    const tickerCol = document.createElement("div");
    tickerCol.className = "col ticker";
    const strong = document.createElement("strong");
    strong.textContent = item.ticker;
    tickerCol.appendChild(strong);
    row.appendChild(tickerCol);

    const nameCol = document.createElement("div");
    nameCol.className = "col name";
    nameCol.textContent = item.companyName || "";
    row.appendChild(nameCol);

    const priceCol = document.createElement("div");
    priceCol.className = "col price";
    priceCol.textContent = item.currentPrice !== null ? formatNumber(item.currentPrice) : "—";
    row.appendChild(priceCol);

    const changeCol = document.createElement("div");
    changeCol.className = "col change " + changeClass;
    changeCol.textContent = item.dailyChange !== null ? sign + formatNumber(item.dailyChange) : "—";
    row.appendChild(changeCol);

    const changePctCol = document.createElement("div");
    changePctCol.className = "col changePct " + changeClass;
    changePctCol.textContent = item.dailyChangePercent !== null ? sign + item.dailyChangePercent.toFixed(2) + "%" : "—";
    row.appendChild(changePctCol);

    const actionCol = document.createElement("div");
    actionCol.className = "col action";
    const btn = document.createElement("button");
    btn.className = "row-star";
    btn.setAttribute("aria-label", "Remove from watchlist");
    btn.textContent = "✕";
    actionCol.appendChild(btn);
    row.appendChild(actionCol);

    rowsWrap.appendChild(row);
  });

  table.appendChild(rowsWrap);
  return table;
}

async function refreshView(container) {
  if (!container) return;
  container.innerHTML = '<div class="watch-loading">Loading watchlist…</div>';
  const anonId = ensureAnonId();
  const data = anonId ? await fetchWatchlistWithScores(anonId) : [];
  container.replaceChildren();
  container.appendChild(renderRows(data));

  container.querySelectorAll(".col.ticker").forEach((col) => {
    col.addEventListener("click", () => {
      if (onTickerClick) onTickerClick(col.textContent.trim());
    });
  });

  container.querySelectorAll(".row-star").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const row = e.target.closest(".watch-row");
      if (!row) return;
      const ticker = row.dataset.ticker;
      const anonIdLocal = ensureAnonId();
      row.style.opacity = "0.5";
      const updated = await removeTickerFromWatchlist(anonIdLocal, ticker);
      if (updated === null) {
        row.style.opacity = "1";
        alert("Failed to remove from watchlist");
      } else {
        await refreshView(container);
      }
    });
  });
}
