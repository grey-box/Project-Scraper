/**
 * CRAWLER
 * Manages Chrome tab navigation, waits for pages to load, and extracts live HTML and valid links from the active tab.
 */

import { state } from './state.js';

/**
 * Retrieves the original browser tab we are crawling.
 */

export async function getSourceTab() {
  if (state.sourceTabId === null || state.sourceTabId === undefined) {
    throw new Error("Source tab ID is missing.");
  }
  const tab = await chrome.tabs.get(state.sourceTabId);
  if (!tab) {
    throw new Error("Source tab not found.");
  }
  return tab;
}

/**
 * Listens for Chrome tab updates and resolves when the page finishes loading.
 */

export function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    function listener(updatedTabId, changeInfo, tab) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(tab);
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

/**
 * Navigates the target tab to a new URL and waits for it to render.
 */

export async function navigateSourceTab(url) {
  const sourceTab = await getSourceTab();
  await chrome.tabs.update(sourceTab.id, { url: url });
  await waitForTabLoad(sourceTab.id);
  return sourceTab.id;
}

/**
 * Injects a script to extract the fully rendered DOM from the active tab.
 */

export async function getForegroundPageHtml(url) {
  const tabId = await navigateSourceTab(url);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: () => document.documentElement.outerHTML
  });
  return (results && results[0]) ? results[0].result : "";
}

/**
 * Injects a script to extract and normalize all valid anchor links from the page.
 */

export async function getForegroundLinks(url) {
  const tabId = await navigateSourceTab(url);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    args: [Boolean(state.isRestrictDomain), String(state.currentPage || "")],
    func: (restrictDomain, rootPage) => {
      const links = [];
      for (const anchor of document.querySelectorAll("a[href]")) {
        const href = anchor.getAttribute("href");
        const absolute = anchor.href;
        
        if (!href || !absolute) continue;
        if (href.startsWith("#")) continue;
        if (absolute.startsWith("mailto:")) continue;
        if (absolute.startsWith("tel:")) continue;
        if (absolute.startsWith("javascript:")) continue;
        if (absolute.startsWith("about:")) continue;
        if (!absolute.startsWith("http://") && !absolute.startsWith("https://")) continue;

        if (restrictDomain) {
          try {
            const startHost = new URL(rootPage).hostname;
            const linkHost = new URL(absolute).hostname;
            if (startHost !== linkHost) continue;
          } catch (e) {
            continue;
          }
        }

        if (!links.includes(absolute)) {
          links.push(absolute);
        }
      }
      return links;
    }
  });
  return new Set(results && results[0] ? results[0].result : []);
}