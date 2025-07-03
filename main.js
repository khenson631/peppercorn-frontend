const API_BASE_URL = 'https://peppercorn-backend.onrender.com';

// --- Autocomplete for ticker input ---
const tickerInput = document.getElementById('ticker');
const suggestionsList = document.getElementById('tickerSuggestions');
let suggestions = [];
let activeIndex = -1;
let debounceTimeout = null;

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

suggestionsList.addEventListener('mousedown', (e) => {
  const item = e.target.closest('.suggestion-item');
  if (item) {
    const idx = parseInt(item.getAttribute('data-idx'), 10);
    tickerInput.value = suggestions[idx].symbol;
    clearSuggestions();
    tickerInput.focus();
  }
});

document.addEventListener('click', (e) => {
  if (!suggestionsList.contains(e.target) && e.target !== tickerInput) {
    clearSuggestions();
  }
});

document.getElementById('submitEmail').addEventListener('click', async () => {
  const email = document.getElementById('email').value;
  const msgElem = document.getElementById('emailMsg');
  msgElem.textContent = '';
  if (!email) {
    msgElem.textContent = 'Please enter an email address.';
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    msgElem.textContent = data.message || data.error || 'Unknown response';
  } catch (err) {
    msgElem.textContent = 'Error submitting email.';
  }
});

// --- Stock Search Logic ---
async function performStockSearch() {
  const ticker = document.getElementById('ticker').value;
  const resultElem = document.getElementById('stockResult');
  resultElem.textContent = '';
  if (!ticker) {
    resultElem.textContent = 'Please enter a ticker symbol.';
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/score/${ticker}`);
    const data = await res.json();
    if (data.label && data.confidence) {
      const changeColor = data.dailyChange >= 0 ? 'green' : 'red';
      const changeSymbol = data.dailyChange >= 0 ? '+' : '';
      
      resultElem.innerHTML = `
        <div style="margin: 10px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;">
          <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">
            <strong>${data.label}</strong> (${data.confidence} confidence)
          </div>
          <div style="margin-bottom: 8px;">
            <strong>Current Price:</strong> $${data.currentPrice?.toFixed(2) || 'N/A'}
          </div>
          <div style="margin-bottom: 8px; color: ${changeColor};">
            <strong>Daily Change:</strong> ${changeSymbol}$${data.dailyChange?.toFixed(2) || 'N/A'} (${changeSymbol}${data.dailyChangePercent?.toFixed(2) || 'N/A'}%)
          </div>
          <div style="margin-bottom: 8px;">
            <strong>Previous Close:</strong> $${data.previousClose?.toFixed(2) || 'N/A'}
          </div>
          <div style="font-size: 14px; color: #666;">
            ${data.sentiment} • ${data.trend} • ${data.insider}
          </div>
          <div style="font-size: 14px; color: #666;">
            <strong>High Price:</strong> $${data.highPrice?.toFixed(2) || 'N/A'}
            <strong>Low Price:</strong> $${data.lowPrice?.toFixed(2) || 'N/A'}
            <strong>Open Price:</strong> $${data.openPrice?.toFixed(2) || 'N/A'}
            <strong>Volume:</strong> ${data.volume?.toLocaleString() || 'N/A'}
          </div>
          <h3>Basic Financials</h3>
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
          <h3 style="margin-top:24px;">Latest News</h3>
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
      `;
    } else {
      resultElem.textContent = data.error || 'No result found.';
    }
  } catch (err) {
    resultElem.textContent = 'Error fetching stock score.';
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

// --- Trigger search on clicking a suggestion ---
// suggestionsList.addEventListener('click', (e) => {
//   const item = e.target.closest('.suggestion-item');
//   if (item) {
//     const idx = parseInt(item.getAttribute('data-idx'), 10);
//     tickerInput.value = suggestions[idx].symbol;
//     clearSuggestions();
//     tickerInput.focus();
//     performStockSearch();
//   }
// }); 

document.addEventListener('DOMContentLoaded', () => {
  alert(suggestionsList);
});

document.addEventListener('DOMContentLoaded', () => {
  suggestionsList.addEventListener('click', (e) => {
    alert('clicked');

    const item = e.target.closest('.suggestion-item');
    if (!item) return; // click outside a suggestion item

    const idx = parseInt(item.getAttribute('data-idx'), 10);
    const selected = suggestions[idx];

    if (!selected) return; // safeguard against invalid index

    tickerInput.value = selected.symbol;
    clearSuggestions();
    tickerInput.focus();
    performStockSearch();
  });
});