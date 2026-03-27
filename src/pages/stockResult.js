// --- Stock result page: ticker profile, chart, nav bar ---
import { fetchScore } from "../api/score.js";
import { fetchProfile } from "../api/profile.js";
import { fetchHistory } from "../api/history.js";
import { getMarketTimeDisplay, htmlToPlainText, isSafeUrl, formatNumber } from "../helpers/helpers.js";
import { ensureAnonId, fetchWatchlistForAnon, addTickerToWatchlist, removeTickerFromWatchlist } from "../helpers/watchlistHelpers.js";

// Chart state (LightweightCharts is global from script tag)
let chart, candleSeries;
let currentRange = { range: "1y", interval: "1d" };
let lastTicker = "";
let customInterval = null;

const VALID_INTERVALS_FOR_RANGE = {
  "1d": ["1m", "5m", "15m", "30m", "1h", "1d"],
  "5d": ["1m", "5m", "15m", "30m", "1h", "1d"],
  "1mo": ["5m", "15m", "30m", "1h", "1d", "1wk"],
  "3mo": ["1h", "1d", "1wk"],
  "6mo": ["1h", "1d", "1wk"],
  "1y": ["1h", "1d", "1wk"],
  "2y": ["1h", "1d", "1wk"],
  "5y": ["1d", "1wk", "1mo"],
  "10y": ["1d", "1wk", "1mo"],
  max: ["1mo"],
};

function hideRangeLabels() {
  document.querySelectorAll(".range-label").forEach((label) => {
    label.style.display = "none";
  });
}

function showRangeLabels() {
  document.querySelectorAll(".range-label").forEach((label) => {
    label.style.display = "inline-block";
  });
}

function getRangeSelectorHTML() {
  return `<div id="chartControls" style="display:flex;justify-content:center;align-items:center;gap:20px;margin:16px 0 0 0;flex-wrap:wrap;">
    <div id="chartRangeSelector" style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;">
      <span class="range-label" data-range="1d" data-interval="5m">1D</span>
      <span class="range-label" data-range="5d" data-interval="15m">5D</span>
      <span class="range-label" data-range="1mo" data-interval="1d">1M</span>
      <span class="range-label" data-range="3mo" data-interval="1d">3M</span>
      <span class="range-label" data-range="6mo" data-interval="1d">6M</span>
      <span class="range-label" data-range="1y" data-interval="1d">1Y</span>
      <span class="range-label" data-range="2y" data-interval="1d">2Y</span>
      <span class="range-label" data-range="5y" data-interval="1wk">5Y</span>
      <span class="range-label" data-range="10y" data-interval="1wk">10Y</span>
      <span class="range-label" data-range="max" data-interval="1mo">MAX</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;">
      <label for="intervalDropdown" style="font-size:14px;font-weight:bold;">Interval:</label>
      <select id="intervalDropdown" style="padding:6px 10px;border:1px solid #ccc;border-radius:4px;font-size:14px;background:#fff;cursor:pointer;">
        <option value="">Auto</option>
        <option value="1m">1 Minute</option>
        <option value="5m">5 Minutes</option>
        <option value="15m">15 Minutes</option>
        <option value="30m">30 Minutes</option>
        <option value="1h">1 Hour</option>
        <option value="1d">1 Day</option>
        <option value="1wk">1 Week</option>
        <option value="1mo">1 Month</option>
      </select>
    </div>
  </div>`;
}

function getChartContainerHTML() {
  return `<div id="stockChart" style="width:100%;height:350px;margin:16px 0 0 0;display:none;"></div>`;
}

function getStockResultStaticHTML() {
  return `
  <div id="stockSummary">  
    <div id="tickerHeader" style="font-size: 2em; font-weight: bold; margin-bottom: .5em; border-bottom: 1px solid gray; padding-bottom: .25em; display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div><strong id="p-companyName"></strong> (<span id="p-ticker"></span>)
        <br>
        <span id="p-currentPrice" style="font-size:.85em"></span> <span id="p-dailyChange" style="font-size: 0.7em"></span>
        <br>
        <span id="p-marketTime" style="font-size:.44em"></span></div>
      </div>
      <div style="flex: 1; min-width: 300px; display: flex; flex-direction: column;" id="chartContainer">
        ${getRangeSelectorHTML()}
        ${getChartContainerHTML()}
      </div>
      <div style="display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 300px;">
          <div id="stockInfoContainer">
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">
              <strong id="p-label"></strong> <span id="p-confidence"></span>
            </div>
            <div style="margin-bottom: 8px;" id="p-currentPriceLine"></div>
            <div style="margin-bottom: 8px;" id="p-dailyChangeLine"></div>
            <div style="font-size: 14px; color: #555; margin-bottom: 8px;" id="p-sentimentLine"></div>
          </div>
          <h3 class="sectionHeader">Key Stats</h3>
          <div style="font-size: 14px; color: #555; margin-bottom: 16px; display:flex; justify-content: space-evenly;" id="keyStats">
            <div id="keyStatsLeftSide" style="display: flex; flex-direction: column; flex: 1;">
              <div id="keyStat-exchange" style="display: inline;"></div>
              <div id="keyStat-previousClose" style="display: inline;"></div>
              <div id="keyStat-highPrice" style="display: inline;"></div>
              <div id="keyStat-lowPrice" style="display: inline;"></div>
            </div>
            <div id="keyStatsRightSide" style="display: flex; flex-direction: column; flex: 1;">
              <div id="keyStat-openPrice" style="display: inline;"></div>
              <div id="keyStat-52Week" style="display: inline;"></div>
            </div>
          </div>
          <h3 class="sectionHeader">Basic Financials</h3>
          <div style="font-size: 14px; color: #555; display:flex; justify-content: space-betwen;" id="basicFinancials">
            <div id="basicFinancialsLeftSide" style="display:flex; flex-direction: column; flex: 1;">
              <div id="bf-revenuePerShare" style="display: inline;"></div>
              <div id="bf-earningsPerShare" style="display: inline;"></div>
              <div id="bf-currentRatio" style="display: inline;"></div>
              <div id="bf-priceToEarnings" style="display: inline;"></div>
            </div>
            <div id="basicFinancialsRightSide" style="display:flex; flex-direction: column; flex: 1;">
              <div id="bf-dividendYield" style="display: inline;"></div>
              <div id="bf-returnOnEquity" style="display: inline;"></div>
              <div id="bf-profitMargin" style="display: inline;"></div>
              <div id="bf-epsAnnual" style="display: inline;"></div>
            </div>
          </div>
        </div>
      </div>
      <h3 class="sectionHeader">Insider Sentiment</h3>
      <div id="insiderSentimentSection" style="font-size: 14px; color: #555; margin-bottom: 16px;">
        <p>The Insider Buy/Sell Ratio for the USA's overall market quantifies the transactions of insider purchases to sales by corporate insiders. It is calculated by dividing the number of purchase transactions by the number of sale transactions conducted by insiders. This ratio serves as a barometer of insiders' confidence in the market, with a higher ratio indicating optimism and a lower ratio suggesting potential pessimism about future market conditions. (Monthly data, but only months with insider activity are displayed.)</p>
        <div id="insiderSentimentList" style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px;"></div>
      </div>
      <h3 class="sectionHeader">Recent Insider Transactions</h3>
      <div id="insiderTransactionsSection" style="font-size: 14px; color: #555; margin-bottom: 16px;">
        <div style="max-height: 300px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 4px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">
                <th style="padding: 8px; text-align: left; font-weight: bold;">Name</th>
                <th style="padding: 8px; text-align: center; font-weight: bold;">Shares After Transaction</th>
                <th style="padding: 8px; text-align: center; font-weight: bold;">Price</th>
                <th style="padding: 8px; text-align: center; font-weight: bold;">Change in Shares</th>
                <th style="padding: 8px; text-align: center; font-weight: bold;">Date</th>
              </tr>
            </thead>
            <tbody id="insiderTransactionsBody"></tbody>
          </table>
        </div>
      </div>
      <h3 class="sectionHeader">Latest News</h3>
      <div id="newsFeed"></div>
    </div>
    `;
}

function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function fillStockResultData(data, profileData) {
  const changeColor = data.dailyChange >= 0 ? "green" : "red";
  const changeSymbol = data.dailyChange >= 0 ? "+" : "";
  const n = (x) => (x != null && x !== undefined ? x : "N/A");

  setElText("p-companyName", data.companyName || "");
  setElText("p-ticker", data.ticker || "");
  setElText("p-currentPrice", data.currentPrice != null ? "$" + data.currentPrice.toFixed(2) : "N/A");
  const dailyChangeEl = document.getElementById("p-dailyChange");
  if (dailyChangeEl) {
    dailyChangeEl.style.color = changeColor;
    dailyChangeEl.textContent = (changeSymbol + (data.dailyChange?.toFixed(2) ?? "N/A") + " (" + changeSymbol + (data.dailyChangePercent?.toFixed(2) ?? "N/A") + "%)");
  }
  setElText("p-marketTime", getMarketTimeDisplay());
  setElText("p-label", data.label || "");
  const confEl = document.getElementById("p-confidence");
  if (confEl) confEl.textContent = (data.confidence || "") + " confidence";
  setElText("p-currentPriceLine", "Current Price: $" + (data.currentPrice?.toFixed(2) ?? "N/A"));
  const dailyLine = document.getElementById("p-dailyChangeLine");
  if (dailyLine) {
    dailyLine.style.color = changeColor;
    dailyLine.textContent = "Daily Change: " + changeSymbol + "$" + (data.dailyChange?.toFixed(2) ?? "N/A") + " (" + changeSymbol + (data.dailyChangePercent?.toFixed(2) ?? "N/A") + "%)";
  }
  setElText("p-sentimentLine", [data.sentiment, data.trend, data.insider].filter(Boolean).join(" | ") || "");

  setElText("keyStat-exchange", "Exchange: " + (profileData?.exchange ?? "N/A"));
  setElText("keyStat-previousClose", "Previous Close: " + (data.previousClose?.toFixed(2) ?? "N/A"));
  setElText("keyStat-highPrice", "High Price: " + (data.highPrice?.toFixed(2) ?? "N/A"));
  setElText("keyStat-lowPrice", "Low Price: " + (data.lowPrice?.toFixed(2) ?? "N/A"));
  setElText("keyStat-openPrice", "Open Price: " + (data.openPrice?.toFixed(2) ?? "N/A"));
  const bf = data.basicFinancials || {};
  setElText("keyStat-52Week", "52 Week Range: " + (bf["52WeekLow"] ?? "—") + " - " + (bf["52WeekHigh"] ?? "—"));
  setElText("bf-revenuePerShare", "Revenue Per Share TTM: " + n(bf.revenuePerShareTTM));
  setElText("bf-earningsPerShare", "Earnings Per Share: " + n(bf.earningsPerShare));
  setElText("bf-currentRatio", "Current Ratio: " + n(bf.currentRatioAnnual));
  setElText("bf-priceToEarnings", "Price to Earnings: " + n(bf.priceToEarnings));
  setElText("bf-dividendYield", "Dividend Yield: " + n(bf.dividendYieldTTM));
  setElText("bf-returnOnEquity", "Return on Equity: " + n(bf.returnOnEquity));
  setElText("bf-profitMargin", "Profit Margin: " + n(bf.profitMargin));
  setElText("bf-epsAnnual", "EPS Annual: " + n(bf.epsAnnual));

  const sentimentList = document.getElementById("insiderSentimentList");
  if (sentimentList) {
    sentimentList.replaceChildren();
    if (data.insiderSentiment?.data?.length) {
      data.insiderSentiment.data.slice().reverse().forEach((item) => {
        const card = document.createElement("div");
        card.style.cssText = "padding: 12px; border: 1px solid #e0e0e0; border-radius: 4px; flex: 1; min-width: 150px;";
        const monthYear = new Date(item.year, item.month - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
        const changeColor = item.change > 0 ? "#27ae60" : item.change < 0 ? "#e74c3c" : "#666";
        const changeSymbol = item.change > 0 ? "+" : "";
        const d1 = document.createElement("div");
        const strong1 = document.createElement("strong");
        strong1.textContent = monthYear;
        d1.appendChild(strong1);
        card.appendChild(d1);
        const d2 = document.createElement("div");
        d2.style.cssText = "margin-top: 4px; color: " + changeColor + ";";
        d2.appendChild(document.createTextNode("Net Change: "));
        d2.appendChild(document.createTextNode(changeSymbol + item.change.toLocaleString()));
        card.appendChild(d2);
        const d3 = document.createElement("div");
        d3.style.cssText = "margin-top: 4px; font-size: 12px; color: #888;";
        d3.appendChild(document.createTextNode("MSPR: "));
        d3.appendChild(document.createTextNode(item.mspr != null ? item.mspr.toFixed(2) : "N/A"));
        card.appendChild(d3);
        sentimentList.appendChild(card);
      });
    } else {
      const empty = document.createElement("div");
      empty.style.color = "#999";
      empty.textContent = "No insider sentiment data available.";
      sentimentList.appendChild(empty);
    }
  }

  const tbody = document.getElementById("insiderTransactionsBody");
  if (tbody) {
    tbody.replaceChildren();
    if (data.insiderTransactions?.data?.length) {
      data.insiderTransactions.data.slice(0, 100).forEach((tx) => {
        const shareChange = tx.change ?? 0;
        const shareChangeColor = shareChange > 0 ? "#27ae60" : shareChange < 0 ? "#e74c3c" : "#666";
        const shareChangeSymbol = shareChange > 0 ? "+" : "";
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid #eee";
        const td1 = document.createElement("td");
        td1.style.padding = "8px";
        td1.textContent = tx.name || "N/A";
        const td2 = document.createElement("td");
        td2.style.cssText = "padding: 8px; text-align: center;";
        td2.textContent = (tx.share ?? 0).toLocaleString();
        const td3 = document.createElement("td");
        td3.style.cssText = "padding: 8px; text-align: center;";
        td3.textContent = "$" + (tx.transactionPrice ?? 0).toFixed(2);
        const td4 = document.createElement("td");
        td4.style.cssText = "padding: 8px; text-align: center; color: " + shareChangeColor + ";";
        const strong4 = document.createElement("strong");
        strong4.textContent = shareChangeSymbol + shareChange.toFixed(2);
        td4.appendChild(strong4);
        const td5 = document.createElement("td");
        td5.style.cssText = "padding: 8px; text-align: center;";
        td5.textContent = tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString() : "N/A";
        tr.append(td1, td2, td3, td4, td5);
        tbody.appendChild(tr);
      });
    } else {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.style.cssText = "padding: 8px; color: #999;";
      td.textContent = "No insider transactions data available.";
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }

  const newsFeed = document.getElementById("newsFeed");
  if (newsFeed) {
    newsFeed.replaceChildren();
    if (Array.isArray(data.news) && data.news.length) {
      data.news.forEach((article) => {
        const div = document.createElement("div");
        div.className = "news-article";
        div.style.cssText = "margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #eee;";
        const a = document.createElement("a");
        a.target = "_blank";
        a.style.cssText = "font-weight:bold; color:#1a0dab; text-decoration:none;";
        a.textContent = article.headline || "";
        if (article.url && isSafeUrl(article.url)) a.href = article.url.trim();
        div.appendChild(a);
        const meta = document.createElement("div");
        meta.style.cssText = "font-size:12px; color:#888;";
        meta.textContent = (article.source || "") + " • " + (article.datetime ? new Date(article.datetime * 1000).toLocaleDateString() : "");
        div.appendChild(meta);
        const summary = document.createElement("div");
        summary.style.cssText = "font-size:14px; color:#444; margin-top:4px;";
        summary.textContent = htmlToPlainText(article.summary || "");
        div.appendChild(summary);
        newsFeed.appendChild(div);
      });
    } else {
      const empty = document.createElement("div");
      empty.style.color = "#888";
      empty.textContent = "No recent news found.";
      newsFeed.appendChild(empty);
    }
  }
}

function renderStockChart(ohlcData) {
  const chartDiv = document.getElementById("stockChart");
  if (!ohlcData.length) {
    if (chartDiv) {
      chartDiv.style.display = "none";
      chartDiv.innerHTML = "";
    }
    return;
  }
  if (chart) {
    chart.remove();
  }
  chartDiv.style.display = "block";
  chartDiv.innerHTML = "";

  chart = window.LightweightCharts.createChart(chartDiv, {
    width: chartDiv.offsetWidth,
    height: 350,
    layout: { background: { color: "#fff" }, textColor: "#222" },
    grid: { vertLines: { color: "#eee" }, horzLines: { color: "#eee" } },
    timeScale: { timeVisible: true, secondsVisible: false },
  });
  candleSeries = chart.addSeries(window.LightweightCharts.AreaSeries);
  const areaData = ohlcData
    .filter((bar) => typeof bar.close === "number" && !isNaN(bar.close))
    .map((bar) => ({ time: bar.time, value: bar.close }));
  candleSeries.setData(areaData);
  chart.timeScale().fitContent();
}

function setActiveRangeLabel(range, interval) {
  document.querySelectorAll(".range-label").forEach((label) => {
    if (label.dataset.range === range && label.dataset.interval === interval) {
      label.classList.add("active");
    } else {
      label.classList.remove("active");
    }
  });
  updateIntervalDropdownOptions(range);
}

function updateIntervalDropdownOptions(range) {
  const dropdown = document.getElementById("intervalDropdown");
  if (!dropdown) return;
  const validIntervals = VALID_INTERVALS_FOR_RANGE[range] || [];
  dropdown.querySelectorAll("option").forEach((option) => {
    option.disabled = option.value !== "" && !validIntervals.includes(option.value);
  });
  if (customInterval && !validIntervals.includes(customInterval)) {
    dropdown.value = "";
    customInterval = null;
  }
}

async function updateChartForTickerAndRange(ticker, range, interval) {
  setActiveRangeLabel(range, interval);
  const ohlcData = await fetchHistory(ticker, range, interval);
  renderStockChart(ohlcData);
}

function formatStockNavBar() {
  try {
    let stockNavBar = document.getElementById("stockNavBar");
    if (!stockNavBar) {
      const subnav = document.getElementById("subnav");
      stockNavBar = document.createElement("nav");
      stockNavBar.id = "stockNavBar";
      const tabs = [
        { id: "summarBtn", label: "Summary" },
        { id: "profileBtn", label: "Profile" },
        { id: "newsBtn", label: "News" },
        { id: "financialsBtn", label: "Financials" },
        { id: "analysisBtn", label: "Analysis" },
      ];
      tabs.forEach((tab) => {
        const button = document.createElement("button");
        button.id = tab.id;
        button.className = "tab-btn";
        button.type = "button";
        button.textContent = tab.label;
        stockNavBar.appendChild(button);
      });
      subnav.parentNode.insertBefore(stockNavBar, subnav.nextSibling);
    }
    showStockNav();
  } catch (err) {
    console.log(err);
  }

  const stockNavBar = document.getElementById("stockNavBar");
  if (stockNavBar && !stockNavBar.dataset.delegationBound) {
    stockNavBar.addEventListener("click", (e) => {
      const btn = e.target.closest("button.tab-btn");
      if (!btn || !stockNavBar.contains(btn)) return;

      const id = btn.id;
      if (id === "summarBtn") { 
         /* show summary panel */ 
         showStockSummary();
         handleStockNavButtonActiveStates(id);
         return; 
      }
      
      if (id === "profileBtn") { 
        /* show profile panel */ 
        showStockProfile();
        handleStockNavButtonActiveStates(id);
        return; 
      }
      
        // …newsBtn, financialsBtn, analysisBtn    })
    });
    stockNavBar.dataset.delegationBound = "1";
  }
}

function hideStockNav() {
  const stockNavBar = document.getElementById("stockNavBar");
  if (stockNavBar) stockNavBar.style.display = "none";
}

function showStockNav() {
  const stockNavBar = document.getElementById("stockNavBar");
  if (stockNavBar) stockNavBar.style.removeProperty("display");
}

function handleStockNavButtonActiveStates(activeBtnId) {
  const stockNavBar = document.getElementById("stockNavBar");
  const buttons = stockNavBar.querySelectorAll('button');

  buttons.forEach((button) => {
    if (button.id === activeBtnId) {
      // button.active = true;
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  }) 
}

/**
 * Functions to show the different panels after clicking tabs
 */
function showStockSummary() {
  
  const stockSummary = document.getElementById("stockSummary");
  if (stockSummary) {
    stockSummary.hidden = false;
  }
}

function showStockProfile() {
  
  const stockSummary = document.getElementById("stockSummary");
  if (stockSummary) {
    stockSummary.hidden = true;

  }
}

/**
 * Unmount the stock result view: hide container and stock nav bar.
 * @param {HTMLElement} container - The stock result container (e.g. #stockResult)
 */
export function unmount(container) {
  if (container) {
    container.style.display = "none";
    container.textContent = "";
  }
  hideStockNav();
}

let isFirstSearch = true;

/**
 * Mount the stock result view for a ticker (fetch, render profile, chart, watch star).
 * @param {HTMLElement} container - The element to render into (e.g. #stockResult)
 * @param {string} ticker - Stock ticker symbol
 */
export async function mount(container, ticker) {
  if (!container) return;

  container.style.display = "block";
  const loadingMessage = isFirstSearch
    ? '<div style="margin-top: 16px; color: #555; font-size: 14px; text-align: center; max-width: 400px; margin-left: auto; margin-right: auto;">Server may take longer to respond on first request (free plan - server wakes up from idle state)</div>'
    : "";
  container.innerHTML = `<div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 200px;">
    <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
    ${loadingMessage}
  </div>`;

  lastTicker = ticker;

  if (!ticker) {
    container.textContent = "Please enter a ticker symbol.";
    hideRangeLabels();
    return;
  }

  try {
    const data = await fetchScore(ticker);
    const profileData = await fetchProfile(ticker);
    formatStockNavBar();

    const profileBtn = document.querySelector("#profileBtn");
    if (profileBtn) {
      profileBtn.addEventListener("click", () => {
        // alert('profile button clicked');
        // const resultContainer = document.querySelector("#resultContainer");
      });
    }

    if (data.label && data.confidence) {
      container.style.display = "block";
      container.innerHTML = getStockResultStaticHTML();
      fillStockResultData(data, profileData);

      setTimeout(async () => {
        try {
          const anonId = ensureAnonId();
          const currentList = anonId ? await fetchWatchlistForAnon(anonId) : [];
          const isWatched = currentList.includes(ticker.toUpperCase());
          const header = document.getElementById("tickerHeader");
          if (header) {
            const btn = document.createElement("button");
            btn.className = "watch-star" + (isWatched ? " filled" : "");
            btn.setAttribute("aria-label", "Toggle watchlist");
            btn.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 .587l3.668 7.431L23 9.748l-5.5 5.362L18.335 24 12 20.013 5.665 24 6.5 15.11 1 9.748l7.332-1.73L12 .587z"/></svg>`;
            btn.addEventListener("click", async (e) => {
              e.preventDefault();
              const currently = btn.classList.contains("filled");
              if (currently) {
                btn.classList.remove("filled");
                const removed = await removeTickerFromWatchlist(anonId, ticker);
                if (removed === null) btn.classList.add("filled");
              } else {
                btn.classList.add("filled");
                const added = await addTickerToWatchlist(anonId, ticker);
                if (added === null) btn.classList.remove("filled");
              }
            });
            header.appendChild(btn);
          }
        } catch (err) {
          console.error("watchlist render error", err);
        }
      }, 0);

      await updateChartForTickerAndRange(ticker, currentRange.range, currentRange.interval);
      showRangeLabels();

      document.getElementById("chartRangeSelector")?.addEventListener("click", async (e) => {
        const label = e.target.closest(".range-label");
        if (!label || !lastTicker) return;
        let range = label.dataset.range;
        let interval = label.dataset.interval;
        if (customInterval) {
          const validIntervals = VALID_INTERVALS_FOR_RANGE[range] || [];
          if (validIntervals.includes(customInterval)) {
            interval = customInterval;
          } else {
            customInterval = null;
            document.getElementById("intervalDropdown").value = "";
          }
        }
        currentRange = { range, interval };
        await updateChartForTickerAndRange(lastTicker, range, interval);
      });

      document.getElementById("intervalDropdown")?.addEventListener("change", async (e) => {
        const selectedInterval = e.target.value;
        if (!selectedInterval) {
          customInterval = null;
          const defaultInterval = document.querySelector(`.range-label[data-range="${currentRange.range}"]`)?.dataset.interval;
          currentRange = { range: currentRange.range, interval: defaultInterval || currentRange.interval };
        } else {
          const validIntervals = VALID_INTERVALS_FOR_RANGE[currentRange.range] || [];
          if (validIntervals.includes(selectedInterval)) {
            customInterval = selectedInterval;
            currentRange = { range: currentRange.range, interval: selectedInterval };
          } else {
            e.target.value = "";
            return;
          }
        }
        if (lastTicker) {
          await updateChartForTickerAndRange(lastTicker, currentRange.range, currentRange.interval);
        }
      });
    } else {
      container.textContent = data.error || "No result found.";
      hideRangeLabels();
    }
    isFirstSearch = false;
  } catch (err) {
    container.textContent = "Error fetching stock score.";
    hideRangeLabels();
    isFirstSearch = false;
  }
}
