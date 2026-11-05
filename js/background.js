/**
 * BACKGROUND (SERVICE WORKER)
 * Adds a "Download this page" option to the right-click menu.
 * Clicking it opens the extension's own popup with the
 * download options already showing for that page.
 */

const CONTEXT_MENU_ID = "project-scraper-download-page";

// Read by popup.js to know which tab was right-clicked.
const CONTEXT_MENU_LAUNCH_KEY = "pendingContextMenuDownload";

// ============================================================
// CREATE RIGHT-CLICK MENU ITEM
// ============================================================
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "Download this page with Project Scraper",
      contexts: ["page", "frame", "selection", "link", "image", "video", "audio"],
      documentUrlPatterns: ["http://*/*", "https://*/*"]
    });
  });
});

// ============================================================
// HANDLE RIGHT-CLICK MENU CLICK
// ============================================================
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !tab || tab.id === undefined) {
    return;
  }

  // Save the clicked tab, then open the toolbar popup right away
  // (openPopup must run while the click still counts as a user action).
  chrome.storage.session.set({
    [CONTEXT_MENU_LAUNCH_KEY]: { tabId: tab.id, createdAt: Date.now() }
  });

  chrome.action.openPopup({ windowId: tab.windowId }).catch((error) => {
    console.error("Could not open the extension popup:", error);
  });
});
