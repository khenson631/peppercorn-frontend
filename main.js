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
      resultElem.innerHTML = `<strong>Label:</strong> ${data.label}<br><strong>Confidence:</strong> ${data.confidence}`;
    } else {
      resultElem.textContent = data.error || 'No result found.';
    }
  } catch (err) {
    resultElem.textContent = 'Error fetching stock score.';
  }
}); 