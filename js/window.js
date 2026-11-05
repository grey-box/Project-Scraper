import { state } from './modules/state.js';
import { enforceWindowSize } from './modules/ui.js';
import { startScrapingProcess } from './modules/scraper.js';


// ============================================================
// WINDOW EVENTS
// ============================================================

window.addEventListener(
  "load",
  enforceWindowSize
);

window.addEventListener(
  "resize",
  enforceWindowSize
);

document.addEventListener(
  "fullscreenchange",
  enforceWindowSize
);

window.addEventListener(
  "keydown",
  (e) => {

    if (e.key === "F11") {
      e.preventDefault();
    }

  }
);


// ============================================================
// DEFAULT PACKAGE CONFIGURATION
// ============================================================

const DEFAULT_PACKAGE_CONFIG = {

  packageName:
    "offline-website",

  organizationMode:
    "default",

  folders: {

    assets:
      "assets",

    images:
      "images",

    videos:
      "videos",

    documents:
      "documents",

    styles:
      "styles",

    scripts:
      "scripts",

    pages:
      "pages"

  },

  includeReadme:
    true

};


// ============================================================
// BROADCAST CHANNEL LISTENER
// ============================================================

const broadcastChannel =
  new BroadcastChannel(
    "scraper_data"
  );


broadcastChannel.addEventListener(
  "message",
  (event) => {

    let startingURLInput;

    let isFocusMode;

    let isRestrictDomain;

    let newMaxDepthValue;

    let sourceTabId;

    let depthOneMode;

    let selectedManualLinks;

    let selectedLocalVideos;

    let packageConfig;


    // ========================================================
    // RECEIVE DATA FROM POPUP.JS
    // ========================================================

    [
      startingURLInput,
      isFocusMode,
      isRestrictDomain,
      newMaxDepthValue,
      sourceTabId,
      depthOneMode,
      selectedManualLinks,
      selectedLocalVideos,
      packageConfig
    ] = event.data;


    // ========================================================
    // NORMALIZE BASIC SCRAPER STATE
    // ========================================================

    state.startingURLInput =
      startingURLInput ?? "";


    state.currentPage =
      state.startingURLInput;


    state.isFocusMode =
      Boolean(
        isFocusMode
      );


    state.isRestrictDomain =
      Boolean(
        isRestrictDomain
      );


    state.maxDepthValue =
      Number(
        newMaxDepthValue || 0
      );


    state.sourceTabId =
      sourceTabId ?? null;


    state.depthOneMode =
      depthOneMode === "manual"
        ? "manual"
        : "all";


    // ========================================================
    // MANUAL DEPTH 1 LINKS
    // ========================================================

    state.selectedManualLinks =
      Array.isArray(
        selectedManualLinks
      )
        ? selectedManualLinks.map(
            String
          )
        : [];


    // ========================================================
    // LOCAL VIDEOS
    // ========================================================

    state.selectedLocalVideos =
      Array.isArray(
        selectedLocalVideos
      )
        ? selectedLocalVideos.filter(
            (file) =>
              file &&
              typeof file.name ===
                "string"
          )
        : [];


    // ========================================================
    // PACKAGE CONFIGURATION
    // ========================================================

    /*
     * popup.js now sends packageConfig
     * as the ninth value.
     *
     * Merge it with our defaults so
     * older/missing values cannot break
     * the scraper.
     */
    state.packageConfig = {

      ...DEFAULT_PACKAGE_CONFIG,

      ...(
        packageConfig &&
        typeof packageConfig ===
          "object"
          ? packageConfig
          : {}
      ),


      folders: {

        ...DEFAULT_PACKAGE_CONFIG.folders,

        ...(
          packageConfig &&
          packageConfig.folders &&
          typeof packageConfig.folders ===
            "object"
            ? packageConfig.folders
            : {}
        )

      }

    };


    // ========================================================
    // DEBUG LOGGING
    // ========================================================

    console.log(
      "Local videos received:",
      state.selectedLocalVideos.map(
        (file) => ({

          name:
            file.name,

          type:
            file.type,

          size:
            file.size

        })
      )
    );


    console.log(
      "Package configuration received:",
      state.packageConfig
    );


    console.log(
      "Package folders:",
      state.packageConfig.folders
    );


    // ========================================================
    // DOWNLOAD FLAG
    // ========================================================

    chrome.storage.sync.set({

      downloadFlag:
        true

    });


    // ========================================================
    // START SCRAPER
    // ========================================================

    startScrapingProcess();

  }
);