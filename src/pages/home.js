import { fetchMarketStatus } from "../api/marketStatus.js";
import { fetchMarketNews } from "../api/marketNews.js";
import { getSafeImageUrl, htmlToPlainText, isSafeUrl } from "../helpers/helpers.js";
import { API_BASE_URL } from "../config.js";

/**
 * Home page: market status + market news.
 * @param {HTMLElement} container - Element to render into (e.g. #stockResult or a dedicated #homeContainer)
 */
export async function mount(container) {
  if (!container) return;

  container.style.display = "block";
  container.innerHTML = "";

  // 1. Market status
  try {
    const statusArr = await fetchMarketStatus("US");
    const status = statusArr?.[0];
    if (status && typeof status.isOpen !== "undefined") {
      const statusBlock = document.createElement("div");
      statusBlock.className = "home-status";
      statusBlock.innerHTML = buildStatusHTML(status);
      container.appendChild(statusBlock);
    }
  } catch (e) {
    console.warn("Market status failed", e);
  }

  container.appendChild(document.createElement("br"));

  // 2. Market news
  try {
    const news = await fetchMarketNews("general", 0);
    const newsSection = document.createElement("div");
    newsSection.className = "market-news-wrapper";
    const heading = document.createElement("h3");
    heading.className = "market-news-heading";
    heading.textContent = "Market News";
    newsSection.appendChild(heading);
    if (Array.isArray(news) && news.length > 0) {
      news.forEach((item) => newsSection.appendChild(renderNewsItem(item)));
    } else {
      const empty = document.createElement("div");
      empty.className = "market-news-empty";
      empty.textContent = "No market news available.";
      newsSection.appendChild(empty);
    }
    container.appendChild(newsSection);
  } catch (e) {
    console.warn("Market news failed", e);
  }
}

export function unmount(container) {
  if (container) {
    container.style.display = "none";
    container.innerHTML = "";
  }
}

function buildStatusHTML(status) {
  const openText = status.isOpen ? "OPEN" : "CLOSED";
  const openClass = status.isOpen ? "status-open" : "status-closed";
  const dateStr = status.t
    ? new Date(status.t * 1000).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "";
  const sessionStr = status.session || "";
  let html = `US exchange is <span class="${openClass}">${openText}</span> | <span class="status-session">Session: ${sessionStr}</span> | <span class="status-date">${dateStr}</span>`;
  if (status.holiday) html += `<div class="home-holiday">Holiday: ${status.holiday}</div>`;
  return html;
}

function renderNewsItem(item) {
  const row = document.createElement("div");
  row.className = "news-item";
  const imageUrl = getSafeImageUrl(item.image);
  const articleUrl = item.url && isSafeUrl(item.url) ? item.url.trim() : null;
  const imgSrc = imageUrl
    ? `${API_BASE_URL}/api/proxy-image?url=${encodeURIComponent(imageUrl)}`
    : articleUrl
      ? `${API_BASE_URL}/api/article-thumbnail?url=${encodeURIComponent(articleUrl)}`
      : null;
  const headline = item.headline || "";
  const link = item.url && isSafeUrl(item.url) ? item.url.trim() : null;
  const meta = [item.source, item.datetime ? new Date(item.datetime * 1000).toLocaleString() : ""]
    .filter(Boolean)
    .join(" • ");
  const related = Array.isArray(item.related) && item.related.length ? ` (${item.related.join(", ")})` : "";
  const summary = htmlToPlainText(item.summary || "");

  row.innerHTML = `
    <div class="news-item-image-wrap">
      ${imgSrc ? `<img src="${imgSrc}" alt="" loading="lazy" onerror="this.parentElement.classList.add('no-image')">` : "<span class='no-image'>No Image</span>"}
    </div>
    <div class="news-item-body">
      <a class="news-item-link" href="${link || "#"}" target="_blank" rel="noopener">${headline}</a>
      <div class="news-item-meta">${meta}${related}</div>
      <div class="news-item-summary">${summary}</div>
    </div>
  `;
  return row;
};

