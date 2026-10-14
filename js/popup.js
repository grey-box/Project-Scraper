const broadcastChannel =
  new BroadcastChannel("scraper_data");


let currentPage = "";

let sourceTabId = null;


const submitButton =
  document.getElementById("submit-button");


const focusMode =
  document.getElementById("focus-mode-toggle");


const restrictDomain =
  document.getElementById("restrict-domain-toggle");


const depthMode =
  document.getElementById("choose-depth-input");


// ============================================================
// DOWNLOAD OPTIONS MODAL
// ============================================================

const downloadOptionsModalElement =
  document.getElementById("download-options-modal");


const startDownloadButton =
  document.getElementById("start-download-button");


const downloadOptionsPage =
  document.getElementById("download-options-page");


// ============================================================
// PACKAGE ORGANIZATION ELEMENTS
// ============================================================

const packageNameInput =
  document.getElementById(
    "package-name-input"
  );


const packageOrganizationDefault =
  document.getElementById(
    "package-organization-default"
  );


const packageOrganizationCustom =
  document.getElementById(
    "package-organization-custom"
  );


const customFolderSettings =
  document.getElementById(
    "custom-folder-settings"
  );


const imagesFolderInput =
  document.getElementById(
    "images-folder-input"
  );


const videosFolderInput =
  document.getElementById(
    "videos-folder-input"
  );


const documentsFolderInput =
  document.getElementById(
    "documents-folder-input"
  );


const stylesFolderInput =
  document.getElementById(
    "styles-folder-input"
  );


const scriptsFolderInput =
  document.getElementById(
    "scripts-folder-input"
  );


const pagesFolderInput =
  document.getElementById(
    "pages-folder-input"
  );


const includeReadmeToggle =
  document.getElementById(
    "include-readme-toggle"
  );


const resetPackageFoldersButton =
  document.getElementById(
    "reset-package-folders-button"
  );


/*
 * Recommended/default folder names.
 *
 * We keep these in one place so the UI
 * and the scraper can use the same
 * predictable defaults.
 */
const DEFAULT_PACKAGE_FOLDERS = {

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

};


/*
 * When the user picks "Download this page" from the
 * right-click menu, background.js saves the clicked
 * tab here and opens this extension popup.
 *
 * { tabId: 123, createdAt: 1710000000000 }
 */
const CONTEXT_MENU_LAUNCH_KEY =
  "pendingContextMenuDownload";


const CONTEXT_MENU_LAUNCH_MAX_AGE_MS =
  10000;


let isContextMenuLaunch =
  false;


// ============================================================
// LOCAL VIDEO IMPORT
// ============================================================

/*
 * local-video-input:
 * File picker for videos from the user's computer.
 *
 * local-video-status:
 * Text area showing which videos were selected.
 */
const localVideoInput =
  document.getElementById(
    "local-video-input"
  );


const localVideoStatus =
  document.getElementById(
    "local-video-status"
  );


/*
 * Stores File objects selected by the user.
 *
 * Example:
 *
 * [
 *   File {
 *     name: "training-video.mp4",
 *     type: "video/mp4",
 *     size: ...
 *   }
 * ]
 */
let selectedLocalVideos = [];


// ============================================================
// DEPTH 1 MANUAL SELECTION ELEMENTS
// ============================================================

const depthOneModeSection =
  document.getElementById(
    "depth-one-mode-section"
  );


const depthOneAllLinks =
  document.getElementById(
    "depth-one-all-links"
  );


const depthOneManualLinks =
  document.getElementById(
    "depth-one-manual-links"
  );


const manualLinkControls =
  document.getElementById(
    "manual-link-controls"
  );


const scanLinksButton =
  document.getElementById(
    "scan-links-button"
  );


const selectAllLinksButton =
  document.getElementById(
    "select-all-links-button"
  );


const clearAllLinksButton =
  document.getElementById(
    "clear-all-links-button"
  );


const manualLinksList =
  document.getElementById(
    "manual-links-list"
  );


// ============================================================
// SCRAPER STATE
// ============================================================

let isFocusMode = false;

let isRestrictDomain = false;

let maxDepthValue = 0;


let depthOneMode =
  "all";


let scannedLinks = [];


let selectedManualLinks = [];


// ============================================================
// PACKAGE ORGANIZATION
// ============================================================

/**
 * Show the custom folder-name fields only
 * when the user selects Custom organization.
 */
function updatePackageOrganizationUI() {

  if (!customFolderSettings) {
    return;
  }


  const isCustom =
    Boolean(
      packageOrganizationCustom &&
      packageOrganizationCustom.checked
    );


  customFolderSettings.style.display =
    isCustom
      ? "block"
      : "none";
}


/**
 * Restore all customizable folder names
 * to Project Scraper's recommended defaults.
 */
function resetPackageFolderNames() {

  if (imagesFolderInput) {

    imagesFolderInput.value =
      DEFAULT_PACKAGE_FOLDERS.images;

  }


  if (videosFolderInput) {

    videosFolderInput.value =
      DEFAULT_PACKAGE_FOLDERS.videos;

  }


  if (documentsFolderInput) {

    documentsFolderInput.value =
      DEFAULT_PACKAGE_FOLDERS.documents;

  }


  if (stylesFolderInput) {

    stylesFolderInput.value =
      DEFAULT_PACKAGE_FOLDERS.styles;

  }


  if (scriptsFolderInput) {

    scriptsFolderInput.value =
      DEFAULT_PACKAGE_FOLDERS.scripts;

  }


  if (pagesFolderInput) {

    pagesFolderInput.value =
      DEFAULT_PACKAGE_FOLDERS.pages;

  }

}


/**
 * Convert a package/folder name into a
 * value that is safer to use inside a ZIP.
 *
 * Example:
 *
 * Biology Lesson - Week 4
 *
 * becomes:
 *
 * Biology-Lesson-Week-4
 */
function sanitizePackageName(
  value,
  fallback
) {

  const cleaned =
    String(
      value ?? ""
    )
      .trim()

      /*
       * Remove characters that are invalid
       * or troublesome on common file systems.
       */
      .replace(
        /[\\/:*?"<>|]+/g,
        "-"
      )

      /*
       * Replace spaces with hyphens.
       */
      .replace(
        /\s+/g,
        "-"
      )

      /*
       * Avoid repeated hyphens.
       */
      .replace(
        /-+/g,
        "-"
      )

      /*
       * Remove leading/trailing dots
       * and hyphens.
       */
      .replace(
        /^[-.]+|[-.]+$/g,
        ""
      );


  return (
    cleaned &&
    cleaned !== "." &&
    cleaned !== ".."
  )
    ? cleaned
    : fallback;

}


/**
 * Folder names currently use the same
 * restrictions as package names.
 */
function sanitizeFolderName(
  value,
  fallback
) {

  return sanitizePackageName(
    value,
    fallback
  );

}


/**
 * Build the package configuration that
 * will eventually be sent to window.js.
 */
function getPackageConfig() {

  const organizationMode =
    packageOrganizationCustom &&
    packageOrganizationCustom.checked
      ? "custom"
      : "default";


  /*
   * Start with safe defaults.
   *
   * Custom mode only replaces the values
   * the user is allowed to rename.
   */
  const folders = {
    ...DEFAULT_PACKAGE_FOLDERS
  };


  if (
    organizationMode ===
    "custom"
  ) {

    folders.images =
      sanitizeFolderName(
        imagesFolderInput?.value,
        DEFAULT_PACKAGE_FOLDERS.images
      );


    folders.videos =
      sanitizeFolderName(
        videosFolderInput?.value,
        DEFAULT_PACKAGE_FOLDERS.videos
      );


    folders.documents =
      sanitizeFolderName(
        documentsFolderInput?.value,
        DEFAULT_PACKAGE_FOLDERS.documents
      );


    folders.styles =
      sanitizeFolderName(
        stylesFolderInput?.value,
        DEFAULT_PACKAGE_FOLDERS.styles
      );


    folders.scripts =
      sanitizeFolderName(
        scriptsFolderInput?.value,
        DEFAULT_PACKAGE_FOLDERS.scripts
      );


    folders.pages =
      sanitizeFolderName(
        pagesFolderInput?.value,
        DEFAULT_PACKAGE_FOLDERS.pages
      );

  }


  return {

    packageName:
      sanitizePackageName(
        packageNameInput?.value,
        "offline-website"
      ),


    organizationMode:
      organizationMode,


    folders:
      folders,


    includeReadme:
      includeReadmeToggle
        ? Boolean(
            includeReadmeToggle.checked
          )
        : true

  };

}


// ============================================================
// PACKAGE ORGANIZATION EVENTS
// ============================================================

if (
  packageOrganizationDefault
) {

  packageOrganizationDefault
    .addEventListener(
      "change",
      updatePackageOrganizationUI
    );

}


if (
  packageOrganizationCustom
) {

  packageOrganizationCustom
    .addEventListener(
      "change",
      updatePackageOrganizationUI
    );

}


if (
  resetPackageFoldersButton
) {

  resetPackageFoldersButton
    .addEventListener(
      "click",
      resetPackageFolderNames
    );

}


// ============================================================
// LOCAL VIDEO EVENTS
// ============================================================

/*
 * When a user selects one or more videos
 * from their computer, save those File
 * objects so they can later be sent to
 * window.js and added to the ZIP.
 */
if (localVideoInput) {

  localVideoInput.addEventListener(
    "change",
    (event) => {

      const files =
        event.target.files;


      if (!files) {

        selectedLocalVideos = [];

        updateLocalVideoStatus();

        return;

      }


      /*
       * Convert FileList into a normal
       * JavaScript array.
       *
       * We keep the actual File objects.
       */
      selectedLocalVideos =
        Array.from(files).filter(
          (file) =>
            file &&
            (
              file.type.startsWith("video/") ||
              isKnownVideoExtension(file.name)
            )
        );


      console.log(
        "Local videos selected:",
        selectedLocalVideos.map(
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


      updateLocalVideoStatus();

    }
  );

}


/**
 * Check common video file extensions
 * in case the operating system does
 * not provide a MIME type.
 */
function isKnownVideoExtension(
  filename
) {

  if (!filename) {
    return false;
  }


  const lower =
    filename.toLowerCase();


  return (
    lower.endsWith(".mp4") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".m4v") ||
    lower.endsWith(".avi") ||
    lower.endsWith(".mkv")
  );

}


/**
 * Display selected local videos
 * in the popup.
 */
function updateLocalVideoStatus() {

  if (!localVideoStatus) {
    return;
  }


  if (
    selectedLocalVideos.length === 0
  ) {

    localVideoStatus.innerHTML = `
      <div class="small text-muted">
        No local videos selected.
      </div>
    `;

    return;

  }


  /*
   * Create the display safely
   * using DOM elements instead
   * of inserting filenames into
   * raw HTML.
   */
  localVideoStatus.innerHTML =
    "";


  const heading =
    document.createElement(
      "div"
    );


  heading.className =
    "small fw-semibold";


  heading.textContent =
    selectedLocalVideos.length === 1
      ? "1 video selected:"
      : `${selectedLocalVideos.length} videos selected:`;


  localVideoStatus.appendChild(
    heading
  );


  for (
    const file
    of selectedLocalVideos
  ) {

    const fileRow =
      document.createElement(
        "div"
      );


    fileRow.className =
      "small text-muted";


    const sizeMb =
      (
        file.size /
        1024 /
        1024
      ).toFixed(2);


    fileRow.textContent =
      `${file.name} (${sizeMb} MB)`;


    localVideoStatus.appendChild(
      fileRow
    );

  }

}


// ============================================================
// DEPTH MODE
// ============================================================

depthMode.addEventListener(
  "change",
  (e) => {

    maxDepthValue =
      Number(
        e.target.value || 0
      );


    updateDepthOneUI();

  }
);


// ============================================================
// FOCUS MODE
// ============================================================

focusMode.addEventListener(
  "change",
  (e) => {

    isFocusMode =
      Boolean(
        e.target.checked
      );


    chrome.storage.sync.set({

      isFocusMode:
        isFocusMode

    });

  }
);


// ============================================================
// RESTRICT DOMAIN
// ============================================================

restrictDomain.addEventListener(
  "change",
  (e) => {

    isRestrictDomain =
      Boolean(
        e.target.checked
      );


    chrome.storage.sync.set({

      isRestrictDomain:
        isRestrictDomain

    });

  }
);


// ============================================================
// DEPTH 1 MODE CONTROLS
// ============================================================

if (depthOneAllLinks) {

  depthOneAllLinks.addEventListener(
    "change",
    () => {

      if (
        depthOneAllLinks.checked
      ) {

        depthOneMode =
          "all";


        updateDepthOneUI();

      }

    }
  );

}


if (depthOneManualLinks) {

  depthOneManualLinks.addEventListener(
    "change",
    () => {

      if (
        depthOneManualLinks.checked
      ) {

        depthOneMode =
          "manual";


        updateDepthOneUI();

      }

    }
  );

}


if (scanLinksButton) {

  scanLinksButton.addEventListener(
    "click",
    async () => {

      await scanLinksFromCurrentPage();

    }
  );

}


if (selectAllLinksButton) {

  selectAllLinksButton.addEventListener(
    "click",
    () => {

      const checkboxes =
        manualLinksList.querySelectorAll(
          'input[type="checkbox"][data-link-url]'
        );


      selectedManualLinks =
        [];


      checkboxes.forEach(
        (checkbox) => {

          checkbox.checked =
            true;


          selectedManualLinks.push(
            checkbox.dataset.linkUrl
          );

        }
      );

    }
  );

}


if (clearAllLinksButton) {

  clearAllLinksButton.addEventListener(
    "click",
    () => {

      const checkboxes =
        manualLinksList.querySelectorAll(
          'input[type="checkbox"][data-link-url]'
        );


      checkboxes.forEach(
        (checkbox) => {

          checkbox.checked =
            false;

        }
      );


      selectedManualLinks =
        [];

    }
  );

}


// ============================================================
// CURRENT TAB
// ============================================================

/**
 * Read and clear a right-click launch
 * saved by background.js, if any.
 */
async function takeContextMenuLaunch() {

  try {

    const items =
      await chrome.storage.session.get(
        CONTEXT_MENU_LAUNCH_KEY
      );


    const launch =
      items[
        CONTEXT_MENU_LAUNCH_KEY
      ];


    if (!launch) {

      return null;

    }


    await chrome.storage.session.remove(
      CONTEXT_MENU_LAUNCH_KEY
    );


    const isFresh =
      Date.now() -
        Number(
          launch.createdAt || 0
        ) <
      CONTEXT_MENU_LAUNCH_MAX_AGE_MS;


    return (
      isFresh &&
      Number.isInteger(
        launch.tabId
      )
    )
      ? launch
      : null;


  } catch (error) {

    console.warn(
      "Could not read right-click launch:",
      error
    );


    return null;

  }

}


/**
 * Capture the source tab and its URL.
 *
 * From the toolbar button this is the active tab.
 * From the right-click menu it is the tab that
 * was right-clicked.
 */
async function resolveSourceTab() {

  const launch =
    await takeContextMenuLaunch();


  if (launch) {

    try {

      const tab =
        await chrome.tabs.get(
          launch.tabId
        );


      currentPage =
        tab.url ?? "";


      sourceTabId =
        tab.id ?? null;


      isContextMenuLaunch =
        true;


      return;


    } catch (error) {

      console.warn(
        "Right-clicked tab is no longer available:",
        error
      );

    }

  }


  const tabs =
    await chrome.tabs.query({

      currentWindow:
        true,

      active:
        true

    });


  if (
    tabs &&
    tabs.length > 0
  ) {

    currentPage =
      tabs[0].url ?? "";


    sourceTabId =
      tabs[0].id ?? null;

  }

}


const sourceTabReady =
  resolveSourceTab();


// ============================================================
// DOWNLOAD FLAG
// ============================================================

/**
 * Updates the download flag
 * in Chrome storage.
 */
const setDownloadFlag =
  (isDownloading) => {

    chrome.storage.sync.set({

      downloadFlag:
        isDownloading

    });

  };


// ============================================================
// SAVED OPTIONS
// ============================================================

/**
 * Fill options with safe defaults.
 */
function fillOptions() {

  chrome.storage.sync.get(
    (items) => {

      isFocusMode =
        items.isFocusMode ??
        false;


      isRestrictDomain =
        items.isRestrictDomain ??
        false;


      if (focusMode) {

        focusMode.checked =
          Boolean(
            isFocusMode
          );

      }


      if (restrictDomain) {

        restrictDomain.checked =
          Boolean(
            isRestrictDomain
          );

      }

    }
  );

}


// ============================================================
// DEPTH 1 UI
// ============================================================

/**
 * Show or hide Depth 1
 * mode controls.
 */
function updateDepthOneUI() {

  if (
    !depthOneModeSection ||
    !manualLinkControls
  ) {

    return;

  }


  const isDepthOne =
    Number(
      maxDepthValue
    ) === 1;


  depthOneModeSection.style.display =
    isDepthOne
      ? "block"
      : "none";


  if (!isDepthOne) {

    manualLinkControls.style.display =
      "none";


    return;

  }


  manualLinkControls.style.display =
    depthOneMode === "manual"
      ? "block"
      : "none";

}
// ============================================================
// MANUAL LINK LIST
// ============================================================

/**
 * Render scanned links into
 * the manual link list.
 */
function renderManualLinks() {

  if (!manualLinksList) {

    return;

  }


  if (
    !scannedLinks ||
    scannedLinks.length === 0
  ) {

    manualLinksList.innerHTML = `
      <div class="small text-muted">
        No valid links found on this page.
      </div>
    `;


    return;

  }


  manualLinksList.innerHTML =
    "";


  scannedLinks.forEach(
    (link, index) => {

      const row =
        document.createElement(
          "div"
        );


      row.className =
        "form-check mb-2 pb-2 border-bottom";


      const checkbox =
        document.createElement(
          "input"
        );


      checkbox.className =
        "form-check-input";


      checkbox.type =
        "checkbox";


      checkbox.id =
        `manual-link-${index}`;


      checkbox.dataset.linkUrl =
        link.url;


      checkbox.checked =
        selectedManualLinks.includes(
          link.url
        );


      checkbox.addEventListener(
        "change",
        (e) => {

          const url =
            e.target.dataset.linkUrl;


          if (
            e.target.checked
          ) {

            if (
              !selectedManualLinks.includes(
                url
              )
            ) {

              selectedManualLinks.push(
                url
              );

            }

          } else {

            selectedManualLinks =
              selectedManualLinks.filter(
                (item) =>
                  item !== url
              );

          }

        }
      );


      const label =
        document.createElement(
          "label"
        );


      label.className =
        "form-check-label ms-1";


      label.setAttribute(
        "for",
        checkbox.id
      );


      const title =
        document.createElement(
          "div"
        );


      title.className =
        "small fw-semibold text-dark";


      title.textContent =
        link.text ||
        "(Untitled link)";


      const urlText =
        document.createElement(
          "div"
        );


      urlText.className =
        "small text-muted";


      urlText.style.wordBreak =
        "break-word";


      urlText.textContent =
        link.url;


      label.appendChild(
        title
      );


      label.appendChild(
        urlText
      );


      row.appendChild(
        checkbox
      );


      row.appendChild(
        label
      );


      manualLinksList.appendChild(
        row
      );

    }
  );

}


// ============================================================
// LINK SCANNER
// ============================================================

/**
 * Scan the current page for
 * valid links so the user
 * can choose them manually.
 */
async function scanLinksFromCurrentPage() {

  if (!sourceTabId) {

    if (manualLinksList) {

      manualLinksList.innerHTML = `
        <div class="small text-danger">
          Could not find the source tab to scan.
        </div>
      `;

    }


    return;

  }


  if (manualLinksList) {

    manualLinksList.innerHTML = `
      <div class="small text-muted">
        Scanning links...
      </div>
    `;

  }


  try {

    const results =
      await chrome.scripting.executeScript({

        target: {

          tabId:
            sourceTabId

        },


        args: [

          Boolean(
            isRestrictDomain
          ),

          String(
            currentPage || ""
          ),

          Boolean(
            isFocusMode
          )

        ],


        func: (
          restrictDomain,
          rootPage,
          focusMode
        ) => {

          const collected =
            [];


          const seen =
            new Set();


          /*
           * FOCUS MODE LITE
           *
           * If Focus Mode is enabled,
           * search the most likely
           * primary content container.
           */
          let searchScope =
            document;


          if (focusMode) {

            searchScope =

              document.querySelector(
                "article"
              ) ||

              document.querySelector(
                "main"
              ) ||

              document.querySelector(
                '[role="main"]'
              ) ||

              document.querySelector(
                "#mw-content-text"
              ) ||

              document.querySelector(
                ".post-content"
              ) ||

              document.querySelector(
                ".entry-content"
              ) ||

              document;

          }


          for (
            const anchor
            of searchScope.querySelectorAll(
              "a[href]"
            )
          ) {

            /*
             * VISIBILITY CHECK
             *
             * Skip links that are hidden
             * via CSS.
             */
            if (
              anchor.offsetWidth === 0 ||
              anchor.offsetHeight === 0
            ) {

              continue;

            }


            const rawHref =
              anchor.getAttribute(
                "href"
              );


            const absolute =
              anchor.href;


            const text =
              (
                anchor.textContent ||
                ""
              )
                .trim()
                .replace(
                  /\s+/g,
                  " "
                );


            if (
              !rawHref ||
              !absolute
            ) {

              continue;

            }


            /*
             * Ignore same-page fragment links.
             */
            if (
              rawHref.startsWith(
                "#"
              )
            ) {

              continue;

            }


            /*
             * Ignore email links.
             */
            if (
              absolute.startsWith(
                "mailto:"
              )
            ) {

              continue;

            }


            /*
             * Ignore telephone links.
             */
            if (
              absolute.startsWith(
                "tel:"
              )
            ) {

              continue;

            }


            /*
             * Ignore Wikipedia
             * meta/utility pages.
             */
            if (
              absolute.includes(
                "/w/index.php"
              ) ||

              absolute.includes(
                "/wiki/Special:"
              ) ||

              absolute.includes(
                "/wiki/Wikipedia:"
              ) ||

              absolute.includes(
                "/wiki/Help:"
              )
            ) {

              continue;

            }


            /*
             * Ignore JavaScript URLs.
             */
            if (
              absolute.startsWith(
                "javascript:"
              )
            ) {

              continue;

            }


            /*
             * Ignore about: URLs.
             */
            if (
              absolute.startsWith(
                "about:"
              )
            ) {

              continue;

            }


            /*
             * Only allow normal
             * HTTP/HTTPS pages.
             */
            if (
              !absolute.startsWith(
                "http://"
              ) &&
              !absolute.startsWith(
                "https://"
              )
            ) {

              continue;

            }


            /*
             * If Restrict Domain is
             * enabled, only keep links
             * from the starting domain.
             */
            if (
              restrictDomain
            ) {

              try {

                const startHost =
                  new URL(
                    rootPage
                  ).hostname;


                const linkHost =
                  new URL(
                    absolute
                  ).hostname;


                if (
                  startHost !==
                  linkHost
                ) {

                  continue;

                }


              } catch (e) {

                continue;

              }

            }


            /*
             * Avoid duplicate links.
             */
            if (
              seen.has(
                absolute
              )
            ) {

              continue;

            }


            seen.add(
              absolute
            );


            collected.push({

              text:
                text ||
                absolute,

              url:
                absolute

            });

          }


          return collected;

        }

      });


    const collectedLinks =

      results &&

      results[0] &&

      Array.isArray(
        results[0].result
      )

        ? results[0].result

        : [];


    /*
     * Keep popup manageable.
     */
    scannedLinks =
      collectedLinks.slice(
        0,
        50
      );


    selectedManualLinks =
      [];


    renderManualLinks();


  } catch (error) {

    console.error(
      "Error scanning links:",
      error
    );


    if (manualLinksList) {

      manualLinksList.innerHTML = `
        <div class="small text-danger">
          Failed to scan links. Check permissions or reload the extension.
        </div>
      `;

    }

  }

}


// ============================================================
// INITIAL LOAD
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    setDownloadFlag(
      false
    );


    fillOptions();


    updateDepthOneUI();


    /*
     * NEW:
     *
     * Make sure the Package Organization
     * section starts in the correct state.
     *
     * Default:
     *   Custom fields hidden.
     *
     * Custom:
     *   Custom fields visible.
     */
    updatePackageOrganizationUI();


    updateLocalVideoStatus();


    openWindow();


    /*
     * Right-click launch: go straight
     * to the download options.
     */
    sourceTabReady.then(
      () => {

        if (
          isContextMenuLaunch
        ) {

          openDownloadOptions();

        }

      }
    );

  }
);


// ============================================================
// DOWNLOAD BUTTON
// ============================================================

submitButton.addEventListener(
  "click",
  openDownloadOptions
);


submitButton.addEventListener(
  "keydown",
  (e) => {

    if (
      e.key === "Enter" ||
      e.key === " "
    ) {

      e.preventDefault();


      openDownloadOptions();

    }

  }
);


if (startDownloadButton) {

  startDownloadButton.addEventListener(
    "click",
    checkDownloadFlag
  );

}


/**
 * Bootstrap modal instance for
 * the download options.
 */
function getDownloadOptionsModal() {

  if (
    !downloadOptionsModalElement ||
    typeof bootstrap ===
      "undefined"
  ) {

    return null;

  }


  return bootstrap.Modal
    .getOrCreateInstance(
      downloadOptionsModalElement
    );

}


/**
 * Hide the Download Options modal.
 */
function hideDownloadOptionsModal() {

  const modal =
    getDownloadOptionsModal();


  if (modal) {

    modal.hide();

  }

}


/**
 * Show the existing
 * download-in-progress toast.
 */
function showDownloadInProgressToast() {

  const toast =
    new bootstrap.Toast(
      $("#toast")
    );


  toast.show();

}


/**
 * Show the page being downloaded
 * in the options header.
 */
function updateDownloadOptionsPageLabel() {

  if (!downloadOptionsPage) {

    return;

  }


  let label =
    currentPage ||
    "Current page";


  try {

    const url =
      new URL(
        currentPage
      );


    label =
      url.hostname +
      url.pathname;


  } catch (error) {

    /*
     * Keep the raw value.
     */

  }


  downloadOptionsPage.textContent =
    label;


  downloadOptionsPage.title =
    currentPage || "";

}


/**
 * Opens the download options popup.
 *
 * If a crawl is already running,
 * shows the in-progress toast instead.
 */
async function openDownloadOptions() {

  await sourceTabReady;


  chrome.storage.sync.get(
    (items) => {

      if (
        items.downloadFlag
      ) {

        showDownloadInProgressToast();


        return;

      }


      updateDownloadOptionsPageLabel();


      updateDepthOneUI();


      /*
       * NEW:
       *
       * Refresh Package Organization
       * visibility whenever the modal
       * is opened.
       */
      updatePackageOrganizationUI();


      const modal =
        getDownloadOptionsModal();


      if (modal) {

        modal.show();

      }

    }
  );

}
/**
 * Checks whether a crawl
 * is already running.
 */
function checkDownloadFlag() {

  chrome.storage.sync.get(
    (items) => {

      if (
        !items.downloadFlag
      ) {

        /*
         * Manual Depth 1 requires
         * at least one selected link.
         */
        if (
          Number(
            maxDepthValue
          ) === 1 &&
          depthOneMode ===
            "manual"
        ) {

          if (
            !selectedManualLinks ||
            selectedManualLinks.length ===
              0
          ) {

            if (
              manualLinksList
            ) {

              manualLinksList.innerHTML = `
                <div class="small text-danger">
                  Please scan links and select at least one link before downloading.
                </div>
              `;

            }


            return;

          }

        }


        hideDownloadOptionsModal();


        const buttonTitle =
          document.getElementById(
            "button-title"
          );


        if (buttonTitle) {

          buttonTitle.innerText =
            "Foreground Crawl Running...";

        }


        sendToWindowInstance();


      } else {

        hideDownloadOptionsModal();


        showDownloadInProgressToast();

      }

    }
  );

}


// ============================================================
// SEND DATA TO WINDOW.JS
// ============================================================

/**
 * Send crawl settings, selected local videos,
 * and package organization settings to the
 * scraper progress window.
 *
 * File objects support the browser's
 * structured clone algorithm, which
 * BroadcastChannel uses when sending messages.
 *
 * Message order:
 *
 * 1. starting URL
 * 2. Focus Mode
 * 3. Restrict Domain
 * 4. crawl depth
 * 5. source tab ID
 * 6. Depth 1 mode
 * 7. manually selected links
 * 8. selected local videos
 * 9. package configuration
 */
function sendToWindowInstance() {

  console.log(
    "Sending local videos:",
    selectedLocalVideos.map(
      (file) =>
        file.name
    )
  );


  /*
   * NEW:
   *
   * Read the current Package Organization
   * settings immediately before starting
   * the download.
   */
  const packageConfig =
    getPackageConfig();


  console.log(
    "Sending package configuration:",
    packageConfig
  );


  broadcastChannel.postMessage([

    String(
      currentPage ?? ""
    ),


    Boolean(
      isFocusMode
    ),


    Boolean(
      isRestrictDomain
    ),


    Number(
      maxDepthValue || 0
    ),


    sourceTabId ?? null,


    depthOneMode,


    Array.isArray(
      selectedManualLinks
    )
      ? selectedManualLinks
      : [],


    /*
     * Local videos selected
     * from the user's computer.
     */
    Array.isArray(
      selectedLocalVideos
    )
      ? selectedLocalVideos
      : [],


    /*
     * NEW:
     *
     * Package organization settings.
     *
     * This is the ninth value received
     * by window.js.
     */
    packageConfig

  ]);

}


// ============================================================
// PROGRESS WINDOW
// ============================================================

/**
 * Open the separate
 * scraper progress window.
 */
function openWindow() {

  let params = `
    scrollbars=no,
    resizable=no,
    status=no,
    location=no,
    toolbar=no,
    menubar=no,
    width=340,
    height=350,
    left=100,
    top=100,
    dependent=yes
  `;


  let popupWindow =
    window.open(
      "../html/window.html",
      "scraper_window",
      params
    );


  if (
    !popupWindow ||
    popupWindow.closed ||
    typeof popupWindow.closed ===
      "undefined"
  ) {

    alert(
      "Please allow pop-ups for this website in order to download it."
    );

  }

}