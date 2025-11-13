// Use local backend for testing (change back to production for deployment)
// const API_BASE_URL = 'http://localhost:5000'; // Local backend for testing
const API_BASE_URL = 'https://peppercorn-backend.onrender.com';  // Production backend

// --- Autocomplete for ticker input ---
const tickerInput = document.getElementById('ticker');
const suggestionsList = document.getElementById('tickerSuggestions');
const resultElem = document.getElementById('stockResult');
const stockChart = document.getElementById('stockChart');
let suggestions = [];
let activeIndex = -1;
let debounceTimeout = null;
let isFirstSearch = true;

function clearSuggestions() {
  suggestionsList.innerHTML = '';
  suggestionsList.style.display = 'none';
  suggestions = [];
  activeIndex = -1;
}

function renderSuggestions() {
  if (!suggestions.length) {
    clearSuggestions();
    return;
  }
  suggestionsList.innerHTML = suggestions.map((item, idx) =>
    `<div class="suggestion-item${idx === activeIndex ? ' active' : ''}" data-idx="${idx}">
      <strong>${item.symbol}</strong> <span style="color:#888;">${item.name}</span>
    </div>`
  ).join('');
  suggestionsList.style.display = 'block';
}

function fetchSuggestions(query) {
  if (!query || query.length < 1) {
    clearSuggestions();
    return;
  }
  fetch(`${API_BASE_URL}/api/search/${encodeURIComponent(query)}`)
    .then(res => res.json())
    .then(data => {
      suggestions = data.suggestions || [];
      activeIndex = -1;
      renderSuggestions();
    })
    .catch(() => clearSuggestions());
}

tickerInput.addEventListener('input', (e) => {
  const value = e.target.value.trim();
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => fetchSuggestions(value), 250);
});

tickerInput.addEventListener('keydown', (e) => {
  if (!suggestions.length) return;
  if (e.key === 'ArrowDown') {
    activeIndex = (activeIndex + 1) % suggestions.length;
    renderSuggestions();
    e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    activeIndex = (activeIndex - 1 + suggestions.length) % suggestions.length;
    renderSuggestions();
    e.preventDefault();
  } else if (e.key === 'Enter') {
    if (activeIndex >= 0 && activeIndex < suggestions.length) {
      tickerInput.value = suggestions[activeIndex].symbol;
      clearSuggestions();
      e.preventDefault();
    }
  } else if (e.key === 'Escape') {
    clearSuggestions();
  }
});

// Search ticker on click
suggestionsList.addEventListener('click', (e) => {
  const item = e.target.closest('.suggestion-item');
  if (item) {
    e.preventDefault();
    e.stopPropagation();
    const idx = parseInt(item.getAttribute('data-idx'), 10);
    if (idx >= 0 && idx < suggestions.length) {
      tickerInput.value = suggestions[idx].symbol;
      clearSuggestions();
      tickerInput.focus();
      performStockSearch();
    }
  }
});

document.addEventListener('click', (e) => {
  if (!suggestionsList.contains(e.target) && e.target !== tickerInput) {
    clearSuggestions();
  }
});

// Waitlist Email
// document.getElementById('submitEmail').addEventListener('click', async () => {
//   const email = document.getElementById('email').value;
//   const msgElem = document.getElementById('emailMsg');
//   msgElem.textContent = '';
//   if (!email) {
//     msgElem.textContent = 'Please enter an email address.';
//     return;
//   }
//   try {
//     const res = await fetch(`${API_BASE_URL}/api/waitlist`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ email })
//     });
//     const data = await res.json();
//     msgElem.textContent = data.message || data.error || 'Unknown response';
//   } catch (err) {
//     msgElem.textContent = 'Error submitting email.';
//   }
// });

// by default hide the result panel
if (resultElem) {
  resultElem.style.display = 'none';
}

// --- TradingView Chart Integration ---
let chart, candleSeries;
let currentRange = { range: '6mo', interval: '1d' };
let lastTicker = '';

// by default hide the stock chart
if (stockChart) {
  stockChart.style.display = 'none';
}

// Hide the date range labels on initial load
function hideRangeLabels() {
  document.querySelectorAll('.range-label').forEach(label => {
    label.style.display = 'none';
  });
}
function showRangeLabels() {
  document.querySelectorAll('.range-label').forEach(label => {
    label.style.display = 'inline-block';
  });
}

hideRangeLabels();

async function fetchHistoricalData(ticker, range = '6mo', interval = '1d') {
  try {
    const res = await fetch(`${API_BASE_URL}/api/history/${ticker}?range=${range}&interval=${interval}`);
    const json = await res.json();
    if (!json.data || !json.data.length) throw new Error('No chart data');
    return json.data.map(bar => ({ ...bar, time: bar.time }));
  } catch (err) {
    return [];
  }
}

// Helper to get range selector HTML
function getRangeSelectorHTML() {
  return `<div id="chartRangeSelector" style="display:flex;justify-content:center;gap:12px;margin:16px 0 0 0;flex-wrap:wrap;">
    <span class="range-label" data-range="1d" data-interval="5m">1D</span>
    <span class="range-label" data-range="5d" data-interval="15m">5D</span>
    <span class="range-label" data-range="1mo" data-interval="1d">1M</span>
    <span class="range-label" data-range="3mo" data-interval="1d">3M</span>
    <span class="range-label" data-range="6mo" data-interval="1d">6M</span>
    <span class="range-label" data-range="1y" data-interval="1d">1Y</span>
    <span class="range-label" data-range="2y" data-interval="1d">2Y</span>
    <span class="range-label" data-range="5y" data-interval="1wk">5Y</span>
    <span class="range-label" data-range="max" data-interval="1mo">MAX</span>
  </div>`;
}

function getChartContainerHTML() {
  return `<div id="stockChart" style="width:100%;height:350px;margin:16px 0 0 0;display:none;"></div>`;
}

// Update renderStockChart to use the dynamic stockChart
function renderStockChart(ohlcData) {
  const chartDiv = document.getElementById('stockChart');
  if (!ohlcData.length) {
    if (chartDiv) {
      chartDiv.style.display = 'none';
      chartDiv.innerHTML = '';
    }
    return;
  }
  chartDiv.style.display = 'block';
  chartDiv.innerHTML = '';
  chart = LightweightCharts.createChart(chartDiv, {
    width: chartDiv.offsetWidth,
    height: 350,
    layout: { background: { color: '#fff' }, textColor: '#222' },
    grid: { vertLines: { color: '#eee' }, horzLines: { color: '#eee' } },
    timeScale: { timeVisible: true, secondsVisible: false }
  });
  candleSeries = chart.addCandlestickSeries();
  candleSeries.setData(ohlcData);
  window.addEventListener('resize', () => {
    chart.applyOptions({ width: chartDiv.offsetWidth });
  });
}

function setActiveRangeLabel(range, interval) {
  document.querySelectorAll('.range-label').forEach(label => {
    if (label.dataset.range === range && label.dataset.interval === interval) {
      label.classList.add('active');
    } else {
      label.classList.remove('active');
    }
  });
}

async function updateChartForTickerAndRange(ticker, range, interval) {
  setActiveRangeLabel(range, interval);
  const ohlcData = await fetchHistoricalData(ticker, range, interval);
  renderStockChart(ohlcData);
}

// --- Stock Search Logic ---
async function performStockSearch() {
  const ticker = document.getElementById('ticker').value;

  resultElem.style.display = 'block';
  
  // Show message on first search about server wake-up time
  const loadingMessage = isFirstSearch 
    ? '<div style="margin-top: 16px; color: #666; font-size: 14px; text-align: center; max-width: 400px; margin-left: auto; margin-right: auto;">Server may take longer to respond on first request (free plan - server wakes up from idle state)</div>'
    : '';
  
  resultElem.innerHTML = `<div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 200px;">
    <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
    ${loadingMessage}
  </div>`;

  lastTicker = ticker;

  if (!ticker) {
    resultElem.textContent = 'Please enter a ticker symbol.';
    hideRangeLabels();
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/score/${ticker}`);
    const data = await res.json();
    if (data.label && data.confidence) {
      const changeColor = data.dailyChange >= 0 ? 'green' : 'red';
      const changeSymbol = data.dailyChange >= 0 ? '+' : '';
      resultElem.style.display = 'block';
      // Inject result, range selector, and chart container
      resultElem.innerHTML = `
        <div style="border-radius: 8px; overflow: hidden; position: relative; box-shadow: 0 0 0 1px #ddd; line-height:1.2">
          <div style="padding: 15px; background: #f9f9f9;">
            <div id="tickerHeader" style="font-size: 2em; font-weight: bold; margin-bottom: .5em; border-bottom: 1px solid gray; padding-bottom: .25em;">
            <strong>${data.companyName}</strong> (${data.ticker})
            <br>
            <span style="font-size:.85em">$${data.currentPrice?.toFixed(2)}</span> <span style="font-size: 0.7em; color: ${changeColor};">${changeSymbol}${data.dailyChange?.toFixed(2) || 'N/A'} (${changeSymbol}${data.dailyChangePercent?.toFixed(2) || 'N/A'}%)</span>            
            <br>
            <span style="font-size:.44em">At close: 4:00:01 PM EST</span>
          </div>
          
          <!--Stock Chart -->
            <div style="flex: 1; min-width: 300px; display: flex; flex-direction: column;">
              ${getRangeSelectorHTML()}
              ${getChartContainerHTML()}
            </div>

          <!-- Stock Info/Financials-->
          <div style="display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap;">
            <!-- Left Column: Stock Info and Financials -->
            <div style="flex: 1; min-width: 300px;">
              <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">
                <strong>${data.label}</strong> (${data.confidence} confidence)
              </div>
              <div style="margin-bottom: 8px;">
                <strong>Current Price:</strong> $${data.currentPrice?.toFixed(2) || 'N/A'}
              </div>
              <div style="margin-bottom: 8px; color: ${changeColor};">
                <strong>Daily Change:</strong> ${changeSymbol}$${data.dailyChange?.toFixed(2) || 'N/A'} (${changeSymbol}${data.dailyChangePercent?.toFixed(2) || 'N/A'}%)
              </div>
              <div style="font-size: 14px; color: #666; margin-bottom: 8px;">
                ${data.sentiment} • ${data.trend} • ${data.insider}
              </div>
              <h3 style="border-bottom: 1px solid gray; margin-top: 16px;">Key Stats</h3>
              <div style="font-size: 14px; color: #666; margin-bottom: 16px; display:flex; gap: 2rem; justify-content: space-betwen;" id="keyStats" >
                <div id="keyStatsLeftSide" style="display: flex; flex-direction: column;">
                  <div style="display: inline;"><strong>Previous Close:</strong> $${data.previousClose?.toFixed(2) || 'N/A'}</div>
                  <div style="display: inline;"><strong>High Price:</strong> $${data.highPrice?.toFixed(2) || 'N/A'}</div>
                  <div style="display: inline;"><strong>Low Price:</strong> $${data.lowPrice?.toFixed(2) || 'N/A'}</div>
                </div>
                <div id="keyStatsRightSide" style="display: flex; flex-direction: column;">
                  <div style="display: inline;"> <strong>Open Price:</strong> $${data.openPrice?.toFixed(2) || 'N/A'}</div>
                  <div style="display: inline;"> <strong>52 Week Range:</strong> $${data.basicFinancials?.['52WeekLow']?.toFixed(2)} - $${data.basicFinancials?.['52WeekHigh']?.toFixed(2)} </div>
                </div>
              </div>
              <h3 style="border-bottom: 1px solid gray; margin-top: 16px;">Basic Financials</h3>
              <div style="font-size: 14px; color: #666;">
                <strong>Revenue:</strong> ${data.basicFinancials.revenue}
                <strong>Earnings Per Share:</strong> ${data.basicFinancials.earningsPerShare}
                <strong>Current Ratio:</strong> ${data.basicFinancials.currentRatioAnnual}
                <br>
                <strong>Debt to Equity:</strong> ${data.basicFinancials.totalDebtToEquity}
                <strong>Price to Earnings:</strong> ${data.basicFinancials.priceToEarnings}
                <strong>Dividend Yield:</strong> ${data.basicFinancials.dividendYieldTTM}
                <br>
                <strong>Return on Equity:</strong> ${data.basicFinancials.returnOnEquity}
                <strong>Profit Margin:</strong> ${data.basicFinancials.profitMargin}
                <strong>EPS Annual:</strong> ${data.basicFinancials.epsAnnual}
              </div>
            </div>
          </div>
          
          <!-- Latest News - Full Width Below -->
          <h3 style="margin-top:24px;border-bottom: 1px solid gray;">Latest News</h3>
          <div id="newsFeed">
            ${
              Array.isArray(data.news) && data.news.length
                ? data.news.map(article => `
                  <div class="news-article" style="margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #eee;">
                    <a href="${article.url}" target="_blank" style="font-weight:bold; color:#1a0dab; text-decoration:none;">
                      ${article.headline}
                    </a>
                    <div style="font-size:12px; color:#888;">
                      ${article.source} • ${new Date(article.datetime * 1000).toLocaleDateString()}
                    </div>
                    <div style="font-size:14px; color:#444; margin-top:4px;">
                      ${article.summary || ''}
                    </div>
                  </div>
                `).join('')
                : '<div style="color:#888;">No recent news found.</div>'
            }
          </div>
          </div>
        </div>
      `;
      // Fetch and render chart for current range
      await updateChartForTickerAndRange(ticker, currentRange.range, currentRange.interval);
      showRangeLabels();
      // Attach event listener for range selector (since it's now dynamic)
      document.getElementById('chartRangeSelector').addEventListener('click', async (e) => {
        const label = e.target.closest('.range-label');
        if (!label || !lastTicker) return;
        const range = label.dataset.range;
        const interval = label.dataset.interval;
        currentRange = { range, interval };
        await updateChartForTickerAndRange(lastTicker, range, interval);
      });
    } else {
      resultElem.textContent = data.error || 'No result found.';
      hideRangeLabels();
    }
    // Mark that we've completed at least one search
    isFirstSearch = false;
  } catch (err) {
    resultElem.textContent = 'Error fetching stock score.';
    hideRangeLabels();
    // Mark that we've completed at least one search attempt
    isFirstSearch = false;
  }
}

// --- Trigger search on Enter in input ---
document.getElementById('ticker').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    performStockSearch();
  }
});

// --- Trigger search on clicking the magnifying glass icon ---
document.querySelector('.search-icon').addEventListener('click', function() {
  performStockSearch();
});