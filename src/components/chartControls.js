// Range selector, interval dropdown, and Lightweight Charts area series for stock result.
import { fetchHistory } from "../api/history.js";
import {
  CHART_HEIGHT,
  VALID_INTERVALS_FOR_RANGE,
  getStockChartOptions,
  getStockAreaSeriesOptions,
  ohlcToAreaSeriesData,
} from "../helpers/chartHelpers.js";

let chart;
let currentRange = { range: "1y", interval: "1d" };
let lastTicker = "";
let customInterval = null;

export function setLastTicker(ticker) {
  lastTicker = ticker || "";
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
  return `<div id="stockChart" style="width:100%;height:${CHART_HEIGHT}px;margin:16px 0 0 0;display:none;"></div>`;
}

/** Markup for chart toolbar + chart div (inject inside #chartContainer). */
export function getChartControlsHTML() {
  return getRangeSelectorHTML() + getChartContainerHTML();
}

export function hideRangeLabels() {
  document.querySelectorAll(".range-label").forEach((label) => {
    label.style.display = "none";
  });
}

export function showRangeLabels() {
  document.querySelectorAll(".range-label").forEach((label) => {
    label.style.display = "inline-block";
  });
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

  chart = window.LightweightCharts.createChart(chartDiv, getStockChartOptions(chartDiv.offsetWidth));
  const series = chart.addSeries(window.LightweightCharts.AreaSeries, getStockAreaSeriesOptions());
  series.setData(ohlcToAreaSeriesData(ohlcData));
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

export async function updateChartForTickerAndRange(ticker, range, interval) {
  currentRange = { range, interval };
  setActiveRangeLabel(range, interval);
  const ohlcData = await fetchHistory(ticker, range, interval);
  renderStockChart(ohlcData);
}

/** Load history using the last selected range/interval (persists across ticker changes). */
export async function loadChartForTicker(ticker) {
  await updateChartForTickerAndRange(ticker, currentRange.range, currentRange.interval);
}

/** Remove chart instance when leaving stock view (avoids leaking handlers). */
export function disposeStockChart() {
  if (chart) {
    chart.remove();
    chart = undefined;
  }
}

/**
 * Wire range chips and interval dropdown. Call after stock summary HTML is in the DOM.
 */
export function bindChartControls() {
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
        const dd = document.getElementById("intervalDropdown");
        if (dd) dd.value = "";
      }
    }
    await updateChartForTickerAndRange(lastTicker, range, interval);
  });

  document.getElementById("intervalDropdown")?.addEventListener("change", async (e) => {
    const selectedInterval = e.target.value;
    if (!selectedInterval) {
      customInterval = null;
      const defaultInterval = document.querySelector(`.range-label[data-range="${currentRange.range}"]`)?.dataset.interval;
      if (lastTicker) {
        await updateChartForTickerAndRange(lastTicker, currentRange.range, defaultInterval || currentRange.interval);
      }
      return;
    }
    const validIntervals = VALID_INTERVALS_FOR_RANGE[currentRange.range] || [];
    if (!validIntervals.includes(selectedInterval)) {
      e.target.value = "";
      return;
    }
    customInterval = selectedInterval;
    if (lastTicker) {
      await updateChartForTickerAndRange(lastTicker, currentRange.range, selectedInterval);
    }
  });
}
