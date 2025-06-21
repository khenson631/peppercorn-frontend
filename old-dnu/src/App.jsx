import React, { useState } from 'react';

export default function App() {
  const [email, setEmail] = useState('');
  const [ticker, setTicker] = useState('');
  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState('');

  const submitEmail = async () => {
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setMsg(data.message || data.error);
  };

  const fetchScore = async () => {
    const res = await fetch(`/api/score/${ticker}`);
    const data = await res.json();
    setResult(data);
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">📈 BuyOrSell</h1>

      <div className="mb-6">
        <h2 className="text-xl mb-2">Join the Waitlist</h2>
        <input
          className="border p-2 w-full mb-2"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <button onClick={submitEmail} className="bg-blue-600 text-white px-4 py-2 rounded">
          Submit
        </button>
        {msg && <p className="mt-2 text-green-700">{msg}</p>}
      </div>

      <div>
        <h2 className="text-xl mb-2">Check a Stock</h2>
        <input
          className="border p-2 w-full mb-2"
          value={ticker}
          onChange={e => setTicker(e.target.value)}
          placeholder="e.g. AAPL"
        />
        <button onClick={fetchScore} className="bg-green-600 text-white px-4 py-2 rounded">
          Check
        </button>
        {result && (
          <div className="mt-4 p-4 border rounded shadow">
            <p><strong>Label:</strong> {result.label}</p>
            <p><strong>Confidence:</strong> {result.confidence}</p>
          </div>
        )}
      </div>
    </div>
  );
}