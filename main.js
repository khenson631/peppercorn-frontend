// Use local backend for testing (change back to production for deployment)
const API_BASE_URL = "http://localhost:5000"; // Local backend for testing
// const API_BASE_URL = 'https://peppercorn-backend.onrender.com';  // Production backend

// --- Watchlist / anonymous id helpers (PoC using backend JSON store) ---
function ensureAnonId() {
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

async function fetchWatchlistForAnon(anonId) {
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

async function addTickerToWatchlist(anonId, ticker) {
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

async function removeTickerFromWatchlist(anonId, ticker) {
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

// --- Autocomplete for ticker input ---
const tickerInput = document.getElementById("ticker");
const suggestionsList = document.getElementById("tickerSuggestions");
const resultElem = document.getElementById("stockResult");
const stockChart = document.getElementById("stockChart");
let suggestions = [];
let activeIndex = -1;
let debounceTimeout = null;
let isFirstSearch = true;

function clearSuggestions() {
  suggestionsList.innerHTML = "";
  suggestionsList.style.display = "none";
  suggestions = [];
  activeIndex = -1;
}

function renderSuggestions() {
  if (!suggestions.length) {
    clearSuggestions();
    return;
  }
  suggestionsList.innerHTML = suggestions
    .map(
      (item, idx) =>
        `<div class="suggestion-item${idx === activeIndex ? " active" : ""}" data-idx="${idx}">
      <strong>${item.symbol}</strong> <span style="color:#888;">${item.name}</span>
    </div>`,
    )
    .join("");
  suggestionsList.style.display = "block";
}

function fetchSuggestions(query) {
  if (!query || query.length < 1) {
    clearSuggestions();
    return;
  }
  fetch(`${API_BASE_URL}/api/search/${encodeURIComponent(query)}`)
    .then((res) => res.json())
    .then((data) => {
      suggestions = data.suggestions || [];
      activeIndex = -1;
      renderSuggestions();
    })
    .catch(() => clearSuggestions());
}

tickerInput.addEventListener("input", (e) => {
  const value = e.target.value.trim();
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => fetchSuggestions(value), 250);
});

tickerInput.addEventListener("keydown", (e) => {
  if (!suggestions.length) return;
  if (e.key === "ArrowDown") {
    activeIndex = (activeIndex + 1) % suggestions.length;
    renderSuggestions();
    e.preventDefault();
  } else if (e.key === "ArrowUp") {
    activeIndex = (activeIndex - 1 + suggestions.length) % suggestions.length;
    renderSuggestions();
    e.preventDefault();
  } else if (e.key === "Enter") {
    if (activeIndex >= 0 && activeIndex < suggestions.length) {
      tickerInput.value = suggestions[activeIndex].symbol;
      clearSuggestions();
      e.preventDefault();
    }
  } else if (e.key === "Escape") {
    clearSuggestions();
  }
});

// Search ticker on click
suggestionsList.addEventListener("click", (e) => {
  const item = e.target.closest(".suggestion-item");
  if (item) {
    e.preventDefault();
    e.stopPropagation();
    const idx = parseInt(item.getAttribute("data-idx"), 10);
    if (idx >= 0 && idx < suggestions.length) {
      tickerInput.value = suggestions[idx].symbol;
      clearSuggestions();
      tickerInput.focus();
      const ticker = document.getElementById("ticker").value;
      performStockSearch(ticker);
    }
  }
});

document.addEventListener("click", (e) => {
  if (!suggestionsList.contains(e.target) && e.target !== tickerInput) {
    clearSuggestions();
  }
});

// by default hide the result panel
if (resultElem) {
  resultElem.style.display = "none";
}

// --- TradingView Chart Integration ---
let chart, candleSeries;
let currentRange = { range: "1y", interval: "1d" };
let lastTicker = "";
let resizeObserver = null;
let customInterval = null; // Track if user has manually selected an interval

// Define valid interval combinations for each range
const VALID_INTERVALS_FOR_RANGE = {
  "1d": ["1m", "5m", "15m", "30m", "1h", "1d"],
  "5d": ["1m", "5m", "15m", "30m", "1h", "1d"],
  "1mo": ["5m", "15m", "30m", "1h", "1d", "1wk"],
  "3mo": ["1h", "1d", "1wk"],
  "6mo": ["1h", "1d", "1wk"],
  "1y": ["1h", "1d", "1wk"],
  "2y": ["1h", "1d", "1wk"],
  "5y": ["1d", "1wk", "1mo"],
  max: ["1mo"],
};

// Get all available intervals
const ALL_INTERVALS = ["1m", "5m", "15m", "30m", "1h", "1d", "1wk", "1mo"];

// by default hide the stock chart
if (stockChart) {
  stockChart.style.display = "none";
}

// Helper function to get market time display string
function getMarketTimeDisplay() {
  const now = new Date();
  const estTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const hours = estTime.getHours();
  const minutes = estTime.getMinutes();
  const seconds = estTime.getSeconds();

  // Market open hours: 9:30 AM - 4:00 PM (9:30 - 16:00 in 24-hour)
  const isMarketOpen =
    hours >= 9 && hours < 16 && !(hours === 9 && minutes < 30);

  if (isMarketOpen) {
    // Format: "As of H:MM:SS AM/PM EST"
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    const displayMinutes = String(minutes).padStart(2, "0");
    const displaySeconds = String(seconds).padStart(2, "0");
    return `As of ${displayHours}:${displayMinutes}:${displaySeconds} ${ampm} EST`;
  } else {
    return `At close 4:00:00 PM EST`;
  }
}

// Hide the date range labels on initial load
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

hideRangeLabels();

// --- Market News (Home) ---
async function fetchMarketNews(category = 'general', minId = 0) {
  try {
    const url = `${API_BASE_URL}/api/market-news?category=${encodeURIComponent(category)}` + (minId ? `&minId=${encodeURIComponent(minId)}` : '');
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed fetching market news');
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  } catch (err) {
    console.error('fetchMarketNews error', err);
    return [];
  }
}

function renderMarketNews(news) {
  resultElem.style.display = 'block';
  if (!Array.isArray(news) || news.length === 0) {
    resultElem.innerHTML = '<div style="padding:16px;color:#666;">No market news available.</div>';
    return;
  }

  const items = news
    .map((item) => {
      const date = item.datetime ? new Date(item.datetime * 1000).toLocaleString() : '';
      const related = Array.isArray(item.related) && item.related.length ? ` <span style="color:#888">(${item.related.join(', ')})</span>` : '';
      const imageUrl = item.image || '';
      const imageHtml = imageUrl
        ? `<div style="flex:0 0 140px;display:flex;align-items:center;justify-content:center;margin-right:12px;"><img src="${imageUrl}" alt="thumb" style="width:120px;height:80px;object-fit:cover;border-radius:6px;" onerror="this.style.display='none'"/></div>`
        : '<div style="flex:0 0 140px;display:flex;align-items:center;justify-content:center;margin-right:12px;background:#f2f2f2;border-radius:6px;width:120px;height:80px;color:#999;font-size:12px;">No Image</div>';

      return `
        <div class="news-item" style="display:flex;gap:12px;padding:12px;border-bottom:1px solid #eee;align-items:flex-start;">
          ${imageHtml}
          <div style="flex:1;min-width:0;">
            <a href="${item.url}" target="_blank" style="font-weight:bold;color:#1a0dab;text-decoration:none;display:block;">${item.headline}</a>
            <div style="font-size:12px;color:#888;margin-top:4px;">${item.source} • ${date} ${related}</div>
            <div style="margin-top:8px;color:#444;">${item.summary || ''}</div>
          </div>
        </div>`;
    })
    .join('');

  resultElem.innerHTML = `<div style="padding:8px 0 0 0;"><h3 style="margin:0 0 8px 0;">Market News</h3>${items}</div>`;
}

async function showHome() {
  try { hideWatchlist(); } catch (e) { /* ignore */ }
  const news = await fetchMarketNews('general', 0);
  renderMarketNews(news);
}

// Attach Home tab if present
document.getElementById('homeTab')?.addEventListener('click', async (e) => {
  e.preventDefault();
  await showHome();
});

// Load Market News on initial page load
showHome();

async function fetchHistoricalData(ticker, range = "6mo", interval = "1d") {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/history/${ticker}?range=${range}&interval=${interval}`,
    );
    const json = await res.json();
    if (!json.data || !json.data.length) throw new Error("No chart data");
    return json.data.map((bar) => ({ ...bar, time: bar.time }));
  } catch (err) {
    return [];
  }
}

// Helper to get range selector HTML
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

// Update renderStockChart to use the dynamic stockChart
function renderStockChart(ohlcData) {
  const chartDiv = document.getElementById("stockChart");
  if (!ohlcData.length) {
    if (chartDiv) {
      chartDiv.style.display = "none";
      chartDiv.innerHTML = "";
    }
    return;
  }

  // Dispose of old chart instance if it exists
  if (chart) {
    chart.remove();
  }

  chartDiv.style.display = "block";
  chartDiv.innerHTML = "";
  chart = LightweightCharts.createChart(chartDiv, {
    width: chartDiv.offsetWidth,
    height: 350,
    layout: { background: { color: "#fff" }, textColor: "#222" },
    grid: { vertLines: { color: "#eee" }, horzLines: { color: "#eee" } },
    timeScale: { timeVisible: true, secondsVisible: false },
  });
  candleSeries = chart.addCandlestickSeries();
  candleSeries.setData(ohlcData);
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
  // Update interval dropdown options based on selected range
  updateIntervalDropdownOptions(range);
}

function updateIntervalDropdownOptions(range) {
  const dropdown = document.getElementById("intervalDropdown");
  if (!dropdown) return;

  const validIntervals = VALID_INTERVALS_FOR_RANGE[range] || [];
  const allOptions = dropdown.querySelectorAll("option");

  allOptions.forEach((option) => {
    if (option.value === "") {
      option.disabled = false;
    } else if (validIntervals.includes(option.value)) {
      option.disabled = false;
    } else {
      option.disabled = true;
    }
  });

  // If current interval is not valid for this range, reset to auto
  if (customInterval && !validIntervals.includes(customInterval)) {
    dropdown.value = "";
    customInterval = null;
  }
}

async function updateChartForTickerAndRange(ticker, range, interval) {
  setActiveRangeLabel(range, interval);
  const ohlcData = await fetchHistoricalData(ticker, range, interval);
  renderStockChart(ohlcData);
}

// --- Stock Search Logic ---
async function performStockSearch(ticker) {

  //const ticker = document.getElementById("ticker").value;

  // Ensure watchlist view is hidden when performing a normal stock search
  try {
    hideWatchlist();
  } catch (e) {
    /* ignore if not initialized yet */
  }
  resultElem.style.display = "block";

  // Show message on first search about server wake-up time
  const loadingMessage = isFirstSearch
    ? '<div style="margin-top: 16px; color: #555; font-size: 14px; text-align: center; max-width: 400px; margin-left: auto; margin-right: auto;">Server may take longer to respond on first request (free plan - server wakes up from idle state)</div>'
    : "";

  resultElem.innerHTML = `<div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 200px;">
    <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
    ${loadingMessage}
  </div>`;

  lastTicker = ticker;

  if (!ticker) {
    resultElem.textContent = "Please enter a ticker symbol.";
    hideRangeLabels();
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/score/${ticker}`);
    const data = await res.json();
    const profileData = await fetchProfileData(ticker);

    if (data.label && data.confidence) {
      const changeColor = data.dailyChange >= 0 ? "green" : "red";
      const changeSymbol = data.dailyChange >= 0 ? "+" : "";
      resultElem.style.display = "block";
      // Inject result, range selector, and chart container
      resultElem.innerHTML = `
            <div id="tickerHeader" style="font-size: 2em; font-weight: bold; margin-bottom: .5em; border-bottom: 1px solid gray; padding-bottom: .25em; display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div><strong>${data.companyName}</strong> (${data.ticker})
            <br>
            <span style="font-size:.85em">$${data.currentPrice?.toFixed(2)}</span> <span style="font-size: 0.7em; color: ${changeColor};">${changeSymbol}${data.dailyChange?.toFixed(2) || "N/A"} (${changeSymbol}${data.dailyChangePercent?.toFixed(2) || "N/A"}%)</span>            
            <br>
            <span style="font-size:.44em">${getMarketTimeDisplay()}</span></div>
            </div>
          
          <!--Stock Chart -->
            <div style="flex: 1; min-width: 300px; display: flex; flex-direction: column;">
              ${getRangeSelectorHTML()}
              ${getChartContainerHTML()}
            </div>

          <!-- Stock Info/Financials-->
          <div style="display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap;">
          
            <div style="flex: 1; min-width: 300px;">
              
              <div id="stockInfoContainer">
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">
                  <strong>${data.label}</strong> (${data.confidence} confidence)
                </div>
                <div style="margin-bottom: 8px;">
                  <strong>Current Price:</strong> $${data.currentPrice?.toFixed(2) || "N/A"}
                </div>
                <div style="margin-bottom: 8px; color: ${changeColor};">
                  <strong>Daily Change:</strong> ${changeSymbol}$${data.dailyChange?.toFixed(2) || "N/A"} (${changeSymbol}${data.dailyChangePercent?.toFixed(2) || "N/A"}%)
                </div>
                <div style="font-size: 14px; color: #555; margin-bottom: 8px;">
                  ${data.sentiment} | ${data.trend} | ${data.insider}
                </div>
              </div>

              <h3 class="sectionHeader">Key Stats</h3>
              <div style="font-size: 14px; color: #555; margin-bottom: 16px; display:flex; justify-content: space-evenly;" id="keyStats" >
                <div id="keyStatsLeftSide" style="display: flex; flex-direction: column; flex: 1;">
                  <div style="display: inline;"><strong>Exchange:</strong> ${profileData.exchange || "N/A"}</div>  
                  <div style="display: inline;"><strong>Previous Close:</strong> ${data.previousClose?.toFixed(2) || "N/A"}</div>
                  <div style="display: inline;"><strong>High Price:</strong> ${data.highPrice?.toFixed(2) || "N/A"}</div>
                  <div style="display: inline;"><strong>Low Price:</strong> ${data.lowPrice?.toFixed(2) || "N/A"}</div>
                </div>
                <div id="keyStatsRightSide" style="display: flex; flex-direction: column; flex: 1;">
                  <div style="display: inline;"> <strong>Open Price:</strong> ${data.openPrice?.toFixed(2) || "N/A"}</div>
                  <div style="display: inline;"> <strong>52 Week Range:</strong> ${data.basicFinancials?.["52WeekLow"]} - ${data.basicFinancials?.["52WeekHigh"]} </div>
                </div>
              </div>
              
              <h3 class="sectionHeader">Basic Financials</h3>
              <div style="font-size: 14px; color: #555; display:flex; justify-content: space-betwen;" id="basicFinancials">                
                <div id="basicFinancialsLeftSide" style="display:flex; flex-direction: column; flex: 1;">
                  <div style="display: inline;"><strong>Revenue Per Share TTM:</strong> ${data.basicFinancials.revenuePerShareTTM}</div>
                  <div style="display: inline;"><strong>Earnings Per Share:</strong> ${data.basicFinancials.earningsPerShare}</div>
                  <div style="display: inline;"><strong>Current Ratio:</strong> ${data.basicFinancials.currentRatioAnnual}</div>                        
                  <div style="display: inline;"><strong>Price to Earnings:</strong> ${data.basicFinancials.priceToEarnings}</div>
                </div>
                <div id="basicFinancialsRightSide" style="display:flex; flex-direction: column; flex: 1;">
                  <div style="display: inline;"><strong>Dividend Yield:</strong> ${data.basicFinancials.dividendYieldTTM}</div>
                  <div style="display: inline;"><strong>Return on Equity:</strong> ${data.basicFinancials.returnOnEquity}</div>
                  <div style="display: inline;"><strong>Profit Margin:</strong> ${data.basicFinancials.profitMargin}</div>
                  <div style="display: inline;"><strong>EPS Annual:</strong> ${data.basicFinancials.epsAnnual}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Insider Sentiment - Full Width Below -->
          <h3 class="sectionHeader">Insider Sentiment</h3>
          <div id="insiderSentimentSection" style="font-size: 14px; color: #555; margin-bottom: 16px;">
            <p>The Insider Buy/Sell Ratio for the USA's overall market quantifies the transactions of insider purchases to sales by corporate insiders. It is calculated by dividing the number of purchase transactions by the number of sale transactions conducted by insiders. This ratio serves as a barometer of insiders' confidence in the market, with a higher ratio indicating optimism and a lower ratio suggesting potential pessimism about future market conditions. (Monthly data, but only months with insider activity are displayed.)</p>
            ${
              data.insiderSentiment && data.insiderSentiment.data && data.insiderSentiment.data.length > 0
                ? `
                  <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                    ${data.insiderSentiment.data.slice().reverse().map(item => {
                      const monthYear = new Date(item.year, item.month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                      const changeColor = item.change > 0 ? '#27ae60' : item.change < 0 ? '#e74c3c' : '#666';
                      const changeSymbol = item.change > 0 ? '+' : '';
                      return `
                        <div style="padding: 12px; border: 1px solid #e0e0e0; border-radius: 4px; flex: 1; min-width: 150px;">
                          <div><strong>${monthYear}</strong></div>
                          <div style="margin-top: 4px; color: ${changeColor};">
                            <strong>Net Change:</strong> ${changeSymbol}${item.change.toLocaleString()}
                          </div>
                          <div style="margin-top: 4px; font-size: 12px; color: #888;">
                            <strong>MSPR:</strong> ${item.mspr ? item.mspr.toFixed(2) : 'N/A'}
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                `
                : '<div style="color: #999;">No insider sentiment data available.</div>'
            }
          </div>

          <!-- Insider Transactions - Full Width Below -->
          <h3 class="sectionHeader">Recent Insider Transactions</h3>
          <div id="insiderTransactionsSection" style="font-size: 14px; color: #555; margin-bottom: 16px;">
            ${
              data.insiderTransactions && data.insiderTransactions.data && data.insiderTransactions.data.length > 0
                ? `
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
                      <tbody>
                        ${data.insiderTransactions.data.slice(0, 100).map(tx => {
                          const shareChange = tx.change || 0;
                          const shareChangeColor = shareChange > 0 ? '#27ae60' : shareChange < 0 ? '#e74c3c' : '#666';
                          const shareChangeSymbol = shareChange > 0 ? '+' : '';
                          return `
                            <tr style="border-bottom: 1px solid #eee;">
                              <td style="padding: 8px;">${tx.name || 'N/A'}</td>
                              <td style="padding: 8px; text-align: center;">${(tx.share || 0).toLocaleString()}</td>
                              <td style="padding: 8px; text-align: center;">$${(tx.transactionPrice || 0).toFixed(2)}</td>
                              <td style="padding: 8px; text-align: center; color: ${shareChangeColor};"><strong>${shareChangeSymbol}${shareChange.toFixed(2)}</strong></td>
                              <td style="padding: 8px; text-align: center;">${tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString() : 'N/A'}</td>
                            </tr>
                          `;
                        }).join('')}
                      </tbody>
                    </table>
                  </div>
                `
                : '<div style="color: #999;">No insider transactions data available.</div>'
            }
          </div>
          
          <!-- Latest News - Full Width Below -->
          <h3 class="sectionHeader">Latest News</h3>
          <div id="newsFeed">
            ${
              Array.isArray(data.news) && data.news.length
                ? data.news
                    .map(
                      (article) => `
                  <div class="news-article" style="margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #eee;">
                    <a href="${article.url}" target="_blank" style="font-weight:bold; color:#1a0dab; text-decoration:none;">
                      ${article.headline}
                    </a>
                    <div style="font-size:12px; color:#888;">
                      ${article.source} • ${new Date(article.datetime * 1000).toLocaleDateString()}
                    </div>
                    <div style="font-size:14px; color:#444; margin-top:4px;">
                      ${article.summary || ""}
                    </div>
                  </div>
                `,
                    )
                    .join("")
                : '<div style="color:#888;">No recent news found.</div>'
            }
          </div>
          </div>
        </div>
      `;

      // Render watch/star button and fetch+render chart for current range
      // Add small delay to ensure DOM is ready after innerHTML
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
              // optimistic toggle
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
            console.log("watchlist star button added");
          } else {
            console.error("tickerHeader not found");
          }
        } catch (err) {
          console.error("watchlist render error", err);
        }
      }, 0);

      await updateChartForTickerAndRange(
        ticker,
        currentRange.range,
        currentRange.interval,
      );
      showRangeLabels();
      // Attach event listener for range selector (since it's now dynamic)
      document
        .getElementById("chartRangeSelector")
        .addEventListener("click", async (e) => {
          const label = e.target.closest(".range-label");
          if (!label || !lastTicker) return;
          const range = label.dataset.range;
          let interval = label.dataset.interval;

          // If user has selected a custom interval, validate it first
          if (customInterval) {
            const validIntervals = VALID_INTERVALS_FOR_RANGE[range] || [];
            if (validIntervals.includes(customInterval)) {
              interval = customInterval;
            } else {
              // Reset to default interval for this range
              customInterval = null;
              document.getElementById("intervalDropdown").value = "";
            }
          }

          currentRange = { range, interval };
          await updateChartForTickerAndRange(lastTicker, range, interval);
        });
      // Attach event listener for interval dropdown
      document
        .getElementById("intervalDropdown")
        .addEventListener("change", async (e) => {
          const selectedInterval = e.target.value;
          if (!selectedInterval) {
            // "Auto" selected - use default interval for current range
            customInterval = null;
            const defaultInterval = document.querySelector(
              `.range-label[data-range="${currentRange.range}"]`,
            )?.dataset.interval;
            currentRange = {
              range: currentRange.range,
              interval: defaultInterval || currentRange.interval,
            };
          } else {
            // Validate the interval is valid for current range
            const validIntervals =
              VALID_INTERVALS_FOR_RANGE[currentRange.range] || [];
            if (validIntervals.includes(selectedInterval)) {
              customInterval = selectedInterval;
              currentRange = {
                range: currentRange.range,
                interval: selectedInterval,
              };
            } else {
              // Invalid combination, reset dropdown
              e.target.value = "";
              return;
            }
          }
          if (lastTicker) {
            await updateChartForTickerAndRange(
              lastTicker,
              currentRange.range,
              currentRange.interval,
            );
          }
        });
    } else {
      resultElem.textContent = data.error || "No result found.";
      hideRangeLabels();
    }
    // Mark that we've completed at least one search
    isFirstSearch = false;
  } catch (err) {
    resultElem.textContent = "Error fetching stock score.";
    hideRangeLabels();
    // Mark that we've completed at least one search attempt
    isFirstSearch = false;
  }
}

// --- Trigger search on Enter in input ---
document.getElementById("ticker").addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    const ticker = document.getElementById("ticker").value;
    performStockSearch(ticker);
  }
});

// --- Trigger search on clicking the magnifying glass icon ---
document.querySelector(".search-icon").addEventListener("click", function () {
  const ticker = document.getElementById("ticker").value;
  performStockSearch(ticker);
});

// Get Profile Data
async function fetchProfileData(ticker) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/profile/${ticker}`);
    const profileData = await res.json();
    return profileData;
  } catch (err) {
    console.error("Error fetching profile:", err);
    return null;
  }
}

// --- Watchlist UI: fetch, render, and interactions (modular & reusable) ---

function createElementFromHTML(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstChild;
}

async function fetchWatchlistWithScores(anonId) {
  // Returns array of { ticker, companyName, currentPrice, dailyChange, dailyChangePercent }
  try {
    const symbols = await fetchWatchlistForAnon(anonId);
    if (!Array.isArray(symbols) || symbols.length === 0) return [];

    const fetchScore = async (sym) => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/score/${encodeURIComponent(sym)}`,
        );
        if (!res.ok) throw new Error("score fetch failed");
        const json = await res.json();
        return {
          ticker: (json.ticker || sym).toUpperCase(),
          companyName:
            json.companyName ||
            json.companyName ||
            (json.label ? json.label : sym),
          currentPrice:
            typeof json.currentPrice === "number" ? json.currentPrice : null,
          dailyChange:
            typeof json.dailyChange === "number" ? json.dailyChange : null,
          dailyChangePercent:
            typeof json.dailyChangePercent === "number"
              ? json.dailyChangePercent
              : null,
        };
      } catch (err) {
        return {
          ticker: String(sym).toUpperCase(),
          companyName: sym,
          currentPrice: null,
          dailyChange: null,
          dailyChangePercent: null,
        };
      }
    };

    const promises = symbols.map((s) => fetchScore(s));
    const results = await Promise.all(promises);
    // Sort alphabetically by ticker
    results.sort((a, b) => a.ticker.localeCompare(b.ticker));
    return results;
  } catch (err) {
    console.error("Error fetching watchlist with scores", err);
    return [];
  }
}

function formatNumber(n) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function renderWatchlistRows(items) {
  if (!Array.isArray(items) || items.length === 0)
    return '<div class="watch-empty">No tickers in your Watchlist. Star a ticker to add it.</div>';

  const rows = items
    .map((item) => {
      const sign = item.dailyChange > 0 ? "+" : "";
      const changeClass =
        item.dailyChange > 0 ? "pos" : item.dailyChange < 0 ? "neg" : "neutral";
      return `
      <div class="watch-row" data-ticker="${item.ticker}">
        <div class="col ticker"><strong>${item.ticker}</strong></div>
        <div class="col name">${item.companyName || ""}</div>
        <div class="col price">${item.currentPrice !== null ? formatNumber(item.currentPrice) : "—"}</div>
        <div class="col change ${changeClass}">${item.dailyChange !== null ? sign + formatNumber(item.dailyChange) : "—"}</div>
        <div class="col changePct ${changeClass}">${item.dailyChangePercent !== null ? sign + item.dailyChangePercent.toFixed(2) + "%" : "—"}</div>
        <div class="col action"><button class="row-star" aria-label="Remove from watchlist">✕</button></div>
      </div>`;
    })
    .join("");

  return `
    <div class="watchlist-table">
      <div class="watch-header">
        <div class="col ticker">Ticker</div>
        <div class="col name">Name</div>
        <div class="col price">Price</div>
        <div class="col change">$ Change</div>
        <div class="col changePct">% Change</div>
        <div class="col action"></div>
      </div>
      <div class="watch-rows">${rows}</div>
    </div>`;
}

async function refreshWatchlistView() {
  const container = document.getElementById("watchlistContainer");
  if (!container) return;
  container.innerHTML = '<div class="watch-loading">Loading watchlist…</div>';
  const anonId = ensureAnonId();
  const data = anonId ? await fetchWatchlistWithScores(anonId) : [];
  container.innerHTML = renderWatchlistRows(data);

  // Re-attach ticker search listener after rendering new rows
  searchStockFromWaitlist();

  // attach row star handlers
  container.querySelectorAll(".row-star").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const row = e.target.closest(".watch-row");
      if (!row) return;
      const ticker = row.dataset.ticker;
      const anonIdLocal = ensureAnonId();
      // optimistic remove
      row.style.opacity = "0.5";
      const updated = await removeTickerFromWatchlist(anonIdLocal, ticker);
      if (updated === null) {
        row.style.opacity = "1";
        alert("Failed to remove from watchlist");
      } else {
        await refreshWatchlistView();
      }
    });
  });
}

function showWatchlist() {
  const result = document.getElementById("stockResult");
  const watch = document.getElementById("watchlistContainer");
  if (result) result.style.display = "none";
  if (watch) watch.style.display = "block";
  document.getElementById("watchlistTab")?.classList.add("active");
}

function hideWatchlist() {
  const watch = document.getElementById("watchlistContainer");
  if (watch) watch.style.display = "none";
  document.getElementById("watchlistTab")?.classList.remove("active");
}

document
  .getElementById("watchlistTab")
  ?.addEventListener("click", async (e) => {
    const tab = e.currentTarget;
    const isActive = tab.classList.contains("active");
    if (isActive) {
      hideWatchlist();
      return;
    }
    showWatchlist();
    await refreshWatchlistView();
    searchStockFromWaitlist();
  });

// --- Trigger search on clicking ticker from waitlist ---
function searchStockFromWaitlist() {
  const watchTable = document.querySelector('.watchlist-table');
  if (!watchTable) return;
  
  watchTable.addEventListener("click", function (e) {
    const ticker = e.target.closest(".col.ticker");
    if (!ticker) return;
    
    performStockSearch(ticker.textContent.trim());
  });
}
