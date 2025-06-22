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

document.getElementById('checkStock').addEventListener('click', async () => {
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
      resultElem.innerHTML = `<strong>Label:</strong> ${data.label}<br><strong>Confidence:</strong> ${data.confidence}`;
    } else {
      resultElem.textContent = data.error || 'No result found.';
    }
  } catch (err) {
    resultElem.textContent = 'Error fetching stock score.';
  }
}); 