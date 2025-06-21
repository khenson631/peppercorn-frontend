const API_BASE_URL = 'https://peppercorn-backend.onrender.com';

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
        </div>
      `;
    } else {
      resultElem.textContent = data.error || 'No result found.';
    }
  } catch (err) {
    resultElem.textContent = 'Error fetching stock score.';
  }
}); 