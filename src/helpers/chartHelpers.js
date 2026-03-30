/** Pixel height of the stock chart container. */
export const CHART_HEIGHT = 350;

/** Allowed interval dropdown values per range (must match range label `data-range`). */
export const VALID_INTERVALS_FOR_RANGE = {
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

/**
 * Chart chrome: background, axes text, grid, time scale.
 * Edit here to change overall chart theme (not the price line fill).
 */
export function getStockChartOptions(width) {
  return {
    width,
    height: CHART_HEIGHT,
    layout: { background: { color: "#fff" }, textColor: "#222" },
    grid: { vertLines: { color: "#eee" }, horzLines: { color: "#eee" } },
    timeScale: { timeVisible: true, secondsVisible: false },
  };
}

/**
 * Area series line and gradient fill (Lightweight Charts defaults are green #33D778).
 * Central place to change “stock line” coloring.
 */
export function getStockAreaSeriesOptions() {
  return {
    lineColor: "rgba(51, 106, 215, 0.5)",
    topColor: "rgba(51, 106, 215, 0.5)",
    bottomColor: "rgba(59, 241, 241, 0.05)",
  };
}

export function ohlcToAreaSeriesData(ohlcData) {
  return ohlcData
    .filter((bar) => typeof bar.close === "number" && !isNaN(bar.close))
    .map((bar) => ({ time: bar.time, value: bar.close }));
}
