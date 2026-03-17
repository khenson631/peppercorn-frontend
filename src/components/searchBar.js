// --- Search bar component: autocomplete + trigger search ---
import { API_BASE_URL } from "../config.js";

/**
 * Initialize the search bar with autocomplete and search triggers.
 * @param {Object} options
 * @param {HTMLInputElement} options.inputEl - The ticker input element
 * @param {HTMLElement} options.suggestionsEl - The suggestions dropdown container
 * @param {HTMLElement} options.searchIconEl - The magnifying glass icon element
 * @param {Function} options.onSearch - Callback when a search is triggered (receives ticker string)
 * @returns {{ destroy: Function }} Cleanup handle
 */
export function init({ inputEl, suggestionsEl, searchIconEl, onSearch }) {
  let suggestions = [];
  let activeIndex = -1;
  let debounceTimeout = null;

  function clearSuggestions() {
    suggestionsEl.textContent = "";
    suggestionsEl.style.display = "none";
    suggestions = [];
    activeIndex = -1;
  }

  function renderSuggestions() {
    if (!suggestions.length) {
      clearSuggestions();
      return;
    }
    suggestionsEl.replaceChildren();
    suggestions.forEach((item, idx) => {
      const div = document.createElement("div");
      div.className = "suggestion-item" + (idx === activeIndex ? " active" : "");
      div.dataset.idx = String(idx);
      const strong = document.createElement("strong");
      strong.textContent = item.symbol;
      const span = document.createElement("span");
      span.style.color = "#888";
      span.textContent = item.name;
      div.appendChild(strong);
      div.appendChild(document.createTextNode(" "));
      div.appendChild(span);
      suggestionsEl.appendChild(div);
    });
    suggestionsEl.style.display = "block";
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

  // --- Event handlers ---

  function onInput(e) {
    const value = e.target.value.trim();
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => fetchSuggestions(value), 250);
  }

  function onKeydown(e) {
    if (!suggestions.length) {
      // Let Enter fall through to trigger search even with no suggestions
      if (e.key === "Enter") {
        onSearch(inputEl.value.trim());
        clearSearchBar();
      }
      return;
    }
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
        inputEl.value = suggestions[activeIndex].symbol;
        clearSuggestions();
        e.preventDefault();
      }
      onSearch(inputEl.value.trim());
      clearSearchBar();
    } else if (e.key === "Escape") {
      clearSuggestions();
    }
  }

  // Click on a suggestion item
  function onSuggestionClick(e) {
    const item = e.target.closest(".suggestion-item");
    if (item) {
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(item.getAttribute("data-idx"), 10);
      if (idx >= 0 && idx < suggestions.length) {
        inputEl.value = suggestions[idx].symbol;
        clearSuggestions();
        inputEl.focus();
        onSearch(inputEl.value.trim());
        clearSearchBar();
      }
    }
  }

  // Close suggestions when clicking outside
  function onDocumentClick(e) {
    if (!suggestionsEl.contains(e.target) && e.target !== inputEl) {
      clearSuggestions();
    }
  }

  // Click on the magnifying glass icon
  function onSearchIconClick() {
    onSearch(inputEl.value.trim());
    clearSearchBar();
  }

  // --- Attach listeners ---
  inputEl.addEventListener("input", onInput);
  inputEl.addEventListener("keydown", onKeydown);
  suggestionsEl.addEventListener("click", onSuggestionClick);
  document.addEventListener("click", onDocumentClick);
  searchIconEl.addEventListener("click", onSearchIconClick);

  return {
    destroy() {
      clearTimeout(debounceTimeout);
      clearSuggestions();
      inputEl.removeEventListener("input", onInput);
      inputEl.removeEventListener("keydown", onKeydown);
      suggestionsEl.removeEventListener("click", onSuggestionClick);
      document.removeEventListener("click", onDocumentClick);
      searchIconEl.removeEventListener("click", onSearchIconClick);
    },
  };

  function clearSearchBar() {
    inputEl.value = '';
  }

}
