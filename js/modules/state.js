/**
 * STATE
 * Holds the global variables, download tracking arrays,
 * package organization settings, and the main ZIP file instance.
 */

export const state = {
  startingURLInput: "",
  currentPage: "",
  sourceTabId: null,

  isExcludeImages: false,
  isFocusMode: false,
  isRestrictDomain: false,

  maxDepthValue: 0,
  depthOneMode: "all",

  selectedManualLinks: [],
  selectedLocalVideos: [],

  urlList: [],
  urlCSSs: [],
  urlImages: [],
  urlVideos: [],
  urlJSs: [],
  urlPdfs: [],

  scrapingDone: false,

  // ============================================================
  // PACKAGE ORGANIZATION
  // ============================================================

  packageConfig: {
    packageName: "offline-website",

    organizationMode: "default",

    folders: {
      assets: "assets",
      images: "images",
      videos: "videos",
      documents: "documents",
      styles: "styles",
      scripts: "scripts",
      pages: "pages"
    },

    includeReadme: true
  },

  // ============================================================
  // ZIP
  // ============================================================

  zip: new JSZip(),

  extId: chrome.runtime.id
};


/**
 * Clears all asset tracking arrays and generates a fresh
 * JSZip instance for subsequent downloads.
 *
 * Package configuration is intentionally NOT reset here.
 * The user's package settings should remain available while
 * the current download is being prepared.
 */

export function resetAssetState() {
  state.urlList = [];
  state.urlCSSs = [];
  state.urlImages = [];
  state.urlVideos = [];
  state.urlJSs = [];
  state.urlPdfs = [];

  state.selectedLocalVideos = [];

  state.zip = new JSZip();
}