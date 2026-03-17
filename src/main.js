
//////////////////////////////////////////
// This file should serve as the launching point for the app.
// The full code for each page should NOT live here.
// The code for each page and function should live in it's respective folder.
// The goal is to keep things as modular and maintainable as possible.
/////////////////////////////////////////

import * as homePage from "./pages/home.js";
import * as watchlistPage from "./pages/watchlist.js";
import * as stockResultPage from "./pages/stockResult.js";
import { init as initSearchBar } from "./components/searchBar.js";

const stockResult = document.getElementById("stockResult");
const watchlistContainer = document.getElementById("watchlistContainer");

// Home tab
document.getElementById("homeTab")?.addEventListener("click", async () => {
  watchlistPage.unmount(watchlistContainer);
  document.getElementById("watchlistTab")?.classList.remove("active");
  stockResultPage.unmount(stockResult);
  await homePage.mount(stockResult);
});

// Initial load
await homePage.mount(stockResult);

// Watchlist tab
document.getElementById("watchlistTab")?.addEventListener("click", async () => {
  const tab = document.getElementById("watchlistTab");
  const isActive = tab?.classList.contains("active");
  if (isActive) {
    watchlistPage.unmount(watchlistContainer);
    tab?.classList.remove("active");
    return;
  }
  stockResultPage.unmount(stockResult);
  tab?.classList.add("active");
  await watchlistPage.mount(watchlistContainer, {
    onTickerClick: (ticker) => stockResultPage.mount(stockResult, ticker),
  });
});

// Search bar: unmount watchlist then show stock result
initSearchBar({
  inputEl: document.getElementById("ticker"),
  suggestionsEl: document.getElementById("tickerSuggestions"),
  searchIconEl: document.querySelector(".search-icon"),
  onSearch: (ticker) => {
    watchlistPage.unmount(watchlistContainer);
    document.getElementById("watchlistTab")?.classList.remove("active");
    stockResultPage.mount(stockResult, ticker);
  },
});
