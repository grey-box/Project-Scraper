/**
 * SCRAPER ORCHESTRATION
 *
 * The main engine that:
 *
 * - Runs the crawl loop
 * - Handles Depth 0 and Depth 1
 * - Processes assets
 * - Attempts website video downloads
 * - Handles local video imports
 * - Offers a manual video fallback when automatic download fails
 * - Generates the final ZIP
 * - Starts the final ZIP download
 */

// ============================================================
// IMPORTS
// ============================================================

import {
  state,
  resetAssetState
} from './state.js';

import {
  updateProgress,
  updateStatus,
  feedbackFormSection,
  currentProgress,
  progressBar,
  requestFallbackVideo
} from './ui.js';

import {
  getForegroundPageHtml,
  getForegroundLinks
} from './crawler.js';

import {
  processImages,
  processPdfs,
  processCSSAndImages,
  processJss,
  rewritePageLinks
} from './assets.js';

import {
  processVideos,
  addLocalVideosToZip
} from './video.js';

import {
  applyFocusMode,
  extractLinksFromHtml
} from './focus-mode.js';

// ============================================================
// DOWNLOAD FLAG
// ============================================================

/**
 * Updates the global download flag.
 *
 * popup.js uses this flag to prevent the user
 * from starting another crawl while one is
 * already running.
 */
const setDownloadFlag = (isDownloading) => {
  chrome.storage.sync.set({
    downloadFlag: isDownloading
  });
};

// ============================================================
// PROCESS SINGLE PAGE
// ============================================================

/**
 * Passes a single page's HTML through all processors.
 *
 * Processing order:
 *
 * 1. Get foreground HTML
 * 2. Focus Mode
 * 3. Images
 * 4. PDFs
 * 5. CSS
 * 6. JavaScript
 * 7. Videos
 * 8. Rewrite links
 */
async function processHTML(
  inputUrl,
  html = "",
  savedPagesMap = null,
  isRootPage = false
) {
  let htmlData =
    html === ""
      ? await getForegroundPageHtml(inputUrl)
      : html;

  // ==========================================================
  // FOCUS MODE
  // ==========================================================

  if (state.isFocusMode) {
    try {
      htmlData = await applyFocusMode(
        htmlData,
        inputUrl
      );
    } catch (err) {
      console.error(
        "Focus Mode crashed. Using original HTML.",
        err
      );
    }
  }

  // ==========================================================
  // ASSET PROCESSING
  // ==========================================================

  htmlData = await processImages(
    htmlData,
    inputUrl,
    isRootPage
  );

  htmlData = await processPdfs(
    htmlData,
    inputUrl
  );

  htmlData = await processCSSAndImages(
    htmlData,
    inputUrl
  );

  htmlData = await processJss(
    htmlData,
    inputUrl
  );

  // ==========================================================
  // VIDEO PROCESSING
  // ==========================================================

  /*
   * processVideos() attempts to download direct website videos.
   *
   * If a video is detected but cannot be downloaded,
   * video.js updates:
   *
   * state.videoFound
   * state.videoDownloadFailed
   * state.videoDownloaded
   *
   * We use those values AFTER the crawl to determine whether
   * the user should be offered the manual video fallback.
   */

  htmlData = await processVideos(
    htmlData,
    inputUrl,
    isRootPage
  );

  // ==========================================================
  // REWRITE PAGE LINKS
  // ==========================================================

  if (savedPagesMap) {
    htmlData = rewritePageLinks(
      htmlData,
      inputUrl,
      savedPagesMap,
      isRootPage
    );
  }

  return htmlData;
}

// ============================================================
// PROCESS LINKS / CRAWL
// ============================================================

/**
 * Handles crawl depth logic.
 *
 * Depth 0:
 *   Save only the current page.
 *
 * Depth 1:
 *   Save the root page and its first-level linked pages.
 */

// ============================================================
// PACKAGE PATH HELPERS
// ============================================================

/**
 * Returns the configured folder used for
 * saved Depth 1 HTML pages.
 *
 * Example:
 *
 * Default:
 * pages
 *
 * Custom:
 * related-reading
 */
function getPagesFolder() {

  return (
    state.packageConfig?.folders?.pages ||
    "pages"
  );

}


/**
 * Creates the ZIP path for a saved
 * first-level HTML page.
 *
 * Example:
 *
 * pages/article.html
 *
 * or:
 *
 * related-reading/article.html
 */
function getSavedPagePath(url) {

  return (
    getPagesFolder() +
    "/" +
    getTitle(url) +
    ".html"
  );

}

async function processLinks() {

  // ==========================================================
  // DEPTH 0
  // ==========================================================

  if (state.maxDepthValue == 0) {
    updateStatus("Saving current page...");

    const savedPagesMap = new Map();

    const rootFilename =
      getTitle(state.currentPage) + ".html";

    savedPagesMap.set(
      state.currentPage,
      rootFilename
    );

    const html = await processHTML(
      state.currentPage,
      "",
      savedPagesMap,
      true
    );

    state.zip.file(
      rootFilename,
      html
    );

    updateProgress(1, 1);

    // Generate an offline index for the saved page.
    generateMasterIndex(savedPagesMap);

    return;
  }

  // ==========================================================
  // DEPTH 1
  // ==========================================================

  if (state.maxDepthValue == 1) {

    updateStatus(
      state.depthOneMode === "manual"
        ? "Foreground crawl is running. Saving selected linked pages."
        : "Foreground crawl is running. Saving the starting page and first-level linked pages."
    );

    let urls;

    // ========================================================
    // MANUAL LINK SELECTION
    // ========================================================

    if (
      state.depthOneMode === "manual" &&
      state.selectedManualLinks.length > 0
    ) {
      urls = new Set(
        state.selectedManualLinks.filter(
          (url) =>
            url &&
            !url.startsWith("javascript:") &&
            !url.startsWith("about:")
        )
      );
    }

    // ========================================================
    // FOCUS MODE LINK DISCOVERY
    // ========================================================

    else if (state.isFocusMode) {

      updateStatus(
        "Applying Focus Mode to find valid article links..."
      );

      const rawHtml =
        await getForegroundPageHtml(
          state.currentPage
        );

      const focusedHtml =
        await applyFocusMode(
          rawHtml,
          state.currentPage
        );

      urls = extractLinksFromHtml(
        focusedHtml,
        state.currentPage,
        state.isRestrictDomain
      );
    }

    // ========================================================
    // NORMAL LINK DISCOVERY
    // ========================================================

    else {
      urls = await getForegroundLinks(
        state.currentPage
      );
    }

    /*
     * Normalize the result in case one of the
     * link helpers returns an Array instead of a Set.
     */
    urls = new Set(urls || []);

    // ========================================================
    // SAVED PAGE MAP
    // ========================================================

    const savedPagesMap =
      new Map();

    savedPagesMap.set(
      state.currentPage,
      getTitle(state.currentPage) +
        ".html"
    );

    for (const url of urls) {

      savedPagesMap.set(
  url,
  getSavedPagePath(url)
);
    }

    // ========================================================
    // PROGRESS TRACKING
    // ========================================================

    const totalPages =
      urls.size + 1;

    let completedPages =
      0;

    // ========================================================
    // ROOT PAGE
    // ========================================================

    const rootHtml =
      await processHTML(
        state.currentPage,
        "",
        savedPagesMap,
        true
      );

    state.zip.file(
      getTitle(
        state.currentPage
      ) + ".html",
      rootHtml
    );

    completedPages++;

    updateProgress(
      completedPages,
      totalPages
    );

    // ========================================================
    // FIRST-LEVEL PAGES
    // ========================================================

    for (const url of urls) {

      try {

        updateStatus(
          state.depthOneMode === "manual"
            ? "Foreground crawl is running. Saving selected linked pages."
            : "Foreground crawl is running. Saving linked pages..."
        );

        const pageHtml =
          await processHTML(
            url,
            "",
            savedPagesMap,
            false
          );

        state.zip.file(
          getSavedPagePath(url),
          pageHtml
        );

        completedPages++;

        updateProgress(
          completedPages,
          totalPages
        );

        /*
         * Give the browser a chance to repaint
         * between processed pages.
         */
        await new Promise(
          (resolve) =>
            requestAnimationFrame(
              resolve
            )
        );

      } catch (error) {

        console.error(
          "Failed processing page:",
          url,
          error
        );
      }
    }

    // ========================================================
    // MASTER OFFLINE INDEX
    // ========================================================

    generateMasterIndex(
      savedPagesMap
    );

    return;
  }

  // ==========================================================
  // DEPTH > 1
  // ==========================================================

  updateStatus(
    "Depth greater than 1 is still experimental in this alpha build."
  );
}

// ============================================================
// GENERATE MASTER INDEX
// ============================================================

function generateMasterIndex(
  savedPagesMap
) {

  updateStatus(
    "Generating master index.html..."
  );

  let indexHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Offline Index</title>

      <style>

        body {
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Roboto,
            sans-serif;

          padding: 2rem;
          max-width: 800px;
          margin: 0 auto;

          background: #f7f8fa;
          color: #222;
        }

        .card {
          background: #fff;
          padding: 1.5rem;

          border-radius: 8px;

          box-shadow:
            0 2px 4px
            rgba(0,0,0,0.1);

          border:
            1px solid #e9ecef;
        }

        h1 {
          margin-top: 0;

          border-bottom:
            2px solid #f0f2f5;

          padding-bottom: 10px;

          font-size: 1.5rem;
        }

        ul {
          list-style-type: none;
          padding: 0;
        }

        li {
          margin-bottom: 1rem;
          padding-bottom: 1rem;

          border-bottom:
            1px solid #f0f2f5;
        }

        li:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }

        a {
          text-decoration: none;
          color: #0d6efd;

          font-size: 1.1rem;
          font-weight: 600;
        }

        a:hover {
          text-decoration: underline;
        }

        .url {
          font-size: 0.85rem;
          color: #6c757d;

          word-break: break-all;
          margin-top: 4px;
        }

      </style>
    </head>

    <body>

      <div class="card">

        <h1>
          Offline Index
        </h1>

        <p
          style="
            color: #6c757d;
            font-size: 0.9rem;
            margin-top: -5px;
            margin-bottom: 20px;
          "
        >
          Archived on:
          ${new Date().toLocaleString()}
        </p>

        <ul>
  `;

  for (
    const [
      originalUrl,
      localPath
    ] of savedPagesMap.entries()
  ) {

    const safeTitle =
      getTitle(
        originalUrl
      );

    indexHtml += `
      <li>

        <a href="${localPath}">
          ${safeTitle}
        </a>

        <div class="url">
          ${originalUrl}
        </div>

      </li>
    `;
  }

  indexHtml += `
        </ul>

      </div>

    </body>

    </html>
  `;

  state.zip.file(
    "index.html",
    indexHtml
  );
}

// ============================================================
// MAIN SCRAPING PROCESS
// ============================================================

/**
 * Orchestrates:
 *
 * 1. Crawl
 * 2. Automatic website video attempt
 * 3. Manual video fallback if necessary
 * 4. Local video imports
 * 5. ZIP generation
 * 6. ZIP download
 */
export async function startScrapingProcess() {

  try {

    // ========================================================
    // RESET VIDEO STATE
    // ========================================================

    /*
     * IMPORTANT:
     *
     * These values should be reset ONCE per crawl.
     *
     * Do NOT reset them inside processVideos(),
     * because Depth 1 may process several pages.
     */

    state.videoDownloadFailed =
      false;

    state.videoFound =
      false;

    state.videoDownloaded =
      false;

    // ========================================================
    // RESET PROGRESS UI
    // ========================================================

    if (currentProgress) {

      currentProgress.innerText =
        "0%";

      currentProgress.style.display =
        "inline";
    }

    if (progressBar) {

      progressBar.style.display =
        "flex";

      progressBar.style.width =
        "0%";
    }

    updateStatus(
      "Foreground crawl is running. Please keep this window open."
    );

    // ========================================================
    // START CRAWL
    // ========================================================

    await processLinks();

    console.log("=== VIDEO FALLBACK DEBUG ===");
    console.log("videoFound:", state.videoFound);
    console.log("videoDownloadFailed:", state.videoDownloadFailed);
    console.log("videoDownloaded:", state.videoDownloaded);
    console.log(
      "selectedLocalVideos:",
      state.selectedLocalVideos
    );
    console.log("============================");  

    // ========================================================
    // CHECK FOR EXISTING LOCAL VIDEO
    // ========================================================

    const alreadyHasLocalVideo =
      Array.isArray(
        state.selectedLocalVideos
      ) &&
      state.selectedLocalVideos.length >
        0;

    // ========================================================
    // AUTOMATIC VIDEO DOWNLOAD FAILED
    // ========================================================

    /*
     * Offer the fallback ONLY when:
     *
     * - A website video was detected
     * - Automatic downloading failed
     * - No website video successfully downloaded
     * - The user did not already select a local video
     */

    if (
      state.videoFound &&
      state.videoDownloadFailed &&
      !state.videoDownloaded &&
      !alreadyHasLocalVideo
    ) {

      console.warn(
        "Automatic website video download failed. Waiting for user fallback choice."
      );

      updateStatus(
        "Website video could not be downloaded automatically."
      );

      // ======================================================
      // WAIT FOR USER
      // ======================================================

      /*
       * This pauses startScrapingProcess().
       *
       * ZIP generation will NOT begin until the user:
       *
       * - selects a replacement video
       *
       * OR
       *
       * - clicks Continue Without Video
       */

      const fallbackFile =
        await requestFallbackVideo();

      // ======================================================
      // USER SELECTED REPLACEMENT VIDEO
      // ======================================================

      if (fallbackFile) {

        state.selectedLocalVideos =
          [
            fallbackFile
          ];

        console.log(
          "Fallback video selected:",
          {
            name:
              fallbackFile.name,

            type:
              fallbackFile.type,

            size:
              fallbackFile.size
          }
        );

        updateStatus(
          "Replacement video selected."
        );
      }

      // ======================================================
      // USER CONTINUED WITHOUT VIDEO
      // ======================================================

      else {

        console.log(
          "User chose to continue without a replacement video."
        );

        updateStatus(
          "Continuing without the website video."
        );
      }
    }

    // ========================================================
    // ADD LOCAL VIDEO FILES
    // ========================================================

    /*
     * This handles BOTH:
     *
     * 1. Videos selected in popup.html BEFORE
     *    the crawl started.
     *
     * 2. A fallback video selected AFTER
     *    automatic downloading failed.
     */

    if (
      Array.isArray(
        state.selectedLocalVideos
      ) &&
      state.selectedLocalVideos.length >
        0
    ) {

      if (
        state.selectedLocalVideos.length ===
        1
      ) {

        updateStatus(
          "Adding selected local video..."
        );

      } else {

        updateStatus(
          `Adding ${state.selectedLocalVideos.length} selected local videos...`
        );
      }

      await addLocalVideosToZip();
    }

    // ========================================================
    // PREPARE ZIP
    // ========================================================

    updateStatus(
      "Preparing ZIP download..."
    );

    if (currentProgress) {

      currentProgress.innerText =
        "100%";
    }

    if (progressBar) {

      progressBar.style.width =
        "100%";
    }

    // ========================================================
    // ZIP NAME
    // ========================================================

    const zipName =
  state.packageConfig?.packageName ||
  new URL(
    state.startingURLInput
  ).hostname;

    // ========================================================
    // GENERATE ZIP
    // ========================================================

    const content =
      await state.zip.generateAsync({
        type:
          "blob"
      });

    // ========================================================
    // CREATE DOWNLOAD URL
    // ========================================================

    updateStatus(
      "Starting download..."
    );

    const urlBlob =
      URL.createObjectURL(
        content
      );

    // ========================================================
    // START DOWNLOAD
    // ========================================================

    const downloadId =
      await chrome.downloads.download({

        url:
          urlBlob,

        filename:
          zipName + ".zip",

        saveAs:
          true
      });

    // ========================================================
    // WAIT FOR DOWNLOAD TO COMPLETE
    // ========================================================

    chrome.downloads.onChanged.addListener(

      function listener(
        downloadItem
      ) {

        if (
          downloadItem.id ===
            downloadId &&

          downloadItem.state &&

          downloadItem.state.current ===
            "complete"
        ) {

          // ==================================================
          // REMOVE DOWNLOAD LISTENER
          // ==================================================

          chrome.downloads.onChanged.removeListener(
            listener
          );

          // ==================================================
          // SHOW FEEDBACK
          // ==================================================

          if (
            feedbackFormSection
          ) {

            feedbackFormSection.style.display =
              "block";
          }

          // ==================================================
          // FINISH PROGRESS BAR
          // ==================================================

          if (
            currentProgress
          ) {

            currentProgress.innerText =
              "100%";
          }

          if (
            progressBar
          ) {

            progressBar.style.width =
              "100%";
          }

          // ==================================================
          // COMPLETE
          // ==================================================

          updateStatus(
            "Download complete. Your ZIP should now be in Finder."
          );

          // Allow another scrape.
          setDownloadFlag(
            false
          );

          // Release temporary Blob URL.
          URL.revokeObjectURL(
            urlBlob
          );

          // Reset asset/video state for next download.
          resetAssetState();
        }
      }
    );

  } catch (error) {

    // ========================================================
    // ERROR HANDLING
    // ========================================================

    console.error(
      "Error in scraping/ZIP/download process:",
      error
    );

    updateStatus(
      "Download failed. Check the console for details."
    );

    setDownloadFlag(
      false
    );
  }
}