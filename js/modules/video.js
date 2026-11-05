/**
 * VIDEO PROCESSING
 *
 * Handles:
 *
 * - Detecting website videos
 * - Downloading direct HTML5 videos
 * - Detecting unsupported/dynamic video players
 * - Detecting blob-based video players
 * - Detecting iframe video players
 * - Recording video download failures
 * - Triggering the manual-video fallback through scraper.js
 * - Adding user-selected local videos to the ZIP
 */

import { state } from './state.js';

import { updateStatus } from './ui.js';

import {
  isSkippableAssetUrl,
  getSafeFilename
} from './assets.js';


// ============================================================
// VIDEO EXTENSIONS
// ============================================================

const VIDEO_EXTENSIONS = [
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".avi",
  ".mkv",
  ".m3u8",
  ".mpd"
];


// ============================================================
// VIDEO PLAYER KEYWORDS
// ============================================================

/*
 * These are used when inspecting iframe URLs.
 *
 * They don't necessarily mean we can download the
 * video. They simply tell us that the page probably
 * contains a video player.
 */

const VIDEO_IFRAME_KEYWORDS = [
  "youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
  "vimeo.com",
  "player.vimeo.com",
  "dailymotion.com",
  "wistia",
  "brightcove",
  "jwplayer",
  "video",
  "player",
  "embed"
];


// ============================================================
// DOWNLOAD VIDEO
// ============================================================

/**
 * Downloads a directly accessible video URL.
 *
 * Works best with:
 *
 * .mp4
 * .webm
 * .mov
 * .m4v
 *
 * May fail with:
 *
 * blob:
 * HLS (.m3u8)
 * DASH (.mpd)
 * authenticated media
 * protected media
 * CORS-blocked media
 * iframe players
 */
async function downloadVideo(videoUrl) {

  const response =
    await fetch(videoUrl);


  if (!response.ok) {

    throw new Error(
      `Video request failed with status ${response.status}`
    );
  }


  const arrayBuffer =
    await response.arrayBuffer();


  return new Uint8Array(
    arrayBuffer
  );
}


// ============================================================
// MARK VIDEO FAILURE
// ============================================================

/**
 * Records that Project Scraper found video content
 * but could not download it automatically.
 *
 * scraper.js later checks this flag and can call:
 *
 * requestFallbackVideo()
 */
function markVideoDownloadFailure(
  videoSrc,
  reason = ""
) {

  state.videoDownloadFailed =
    true;


  console.warn(
    "Website video could not be downloaded:",
    videoSrc || "Unknown video source",
    reason
  );
}


// ============================================================
// URL HELPERS
// ============================================================

/**
 * Determines whether a URL appears to point
 * directly to a video/media file.
 */
function looksLikeVideoUrl(url) {

  if (
    !url ||
    typeof url !== "string"
  ) {
    return false;
  }


  const lower =
    url.toLowerCase();


  return VIDEO_EXTENSIONS.some(
    (extension) =>
      lower.includes(extension)
  );
}


/**
 * Determines whether an iframe appears to
 * contain a video player.
 */
function looksLikeVideoIframe(src) {

  if (
    !src ||
    typeof src !== "string"
  ) {
    return false;
  }


  const lower =
    src.toLowerCase();


  return VIDEO_IFRAME_KEYWORDS.some(
    (keyword) =>
      lower.includes(keyword)
  );
}


/**
 * Converts relative video URLs into absolute URLs.
 */
function resolveVideoUrl(
  videoSrc,
  inputUrl
) {

  if (!videoSrc) {
    return null;
  }


  // ----------------------------------------------------------
  // BLOB URL
  // ----------------------------------------------------------

  if (
    videoSrc.startsWith("blob:")
  ) {

    return videoSrc;
  }


  // ----------------------------------------------------------
  // DATA URL
  // ----------------------------------------------------------

  if (
    videoSrc.startsWith("data:")
  ) {

    return videoSrc;
  }


  // ----------------------------------------------------------
  // PROTOCOL-RELATIVE
  // ----------------------------------------------------------

  if (
    videoSrc.startsWith("//")
  ) {

    return "https:" +
      videoSrc;
  }


  // ----------------------------------------------------------
  // ABSOLUTE
  // ----------------------------------------------------------

  if (
    videoSrc.startsWith("https://") ||
    videoSrc.startsWith("http://")
  ) {

    return videoSrc;
  }


  // ----------------------------------------------------------
  // RELATIVE
  // ----------------------------------------------------------

  try {

    return new URL(
      videoSrc,
      inputUrl
    ).href;

  } catch (error) {

    console.warn(
      "Unable to resolve video URL:",
      videoSrc,
      error
    );


    return null;
  }
}


// ============================================================
// FIND VIDEO EVIDENCE
// ============================================================

/**
 * Inspects the HTML for evidence that the page
 * contains video.
 *
 * IMPORTANT:
 *
 * Finding video does NOT mean we can automatically
 * download it.
 *
 * This function exists so pages using:
 *
 * <video>
 * blob:
 * iframe players
 * lazy-loaded sources
 * JS-created players
 *
 * don't silently pass through as "no video".
 */
function detectVideoEvidence(doc) {

  // ----------------------------------------------------------
  // ALL VIDEO ELEMENTS
  // ----------------------------------------------------------

  const allVideoElements =
    Array.from(
      doc.querySelectorAll("video")
    );


  // ----------------------------------------------------------
  // SOURCE ELEMENTS INSIDE VIDEO
  // ----------------------------------------------------------

  const sourceElements =
    Array.from(
      doc.querySelectorAll(
        "video source"
      )
    );


  // ----------------------------------------------------------
  // IFRAMES
  // ----------------------------------------------------------

  const iframeElements =
    Array.from(
      doc.querySelectorAll(
        "iframe"
      )
    );


  const videoIframes =
    iframeElements.filter(
      (iframe) => {

        const src =
          iframe.getAttribute("src") ||
          iframe.getAttribute("data-src") ||
          "";


        return looksLikeVideoIframe(
          src
        );
      }
    );


  // ----------------------------------------------------------
  // VIDEO-RELATED LINKS
  // ----------------------------------------------------------

  const possibleVideoLinks =
    Array.from(
      doc.querySelectorAll(
        "[src], [data-src], [href]"
      )
    ).filter(
      (element) => {

        const possibleUrl =
          element.getAttribute("src") ||
          element.getAttribute("data-src") ||
          element.getAttribute("href") ||
          "";


        return looksLikeVideoUrl(
          possibleUrl
        );
      }
    );


  const hasVideoEvidence =
    allVideoElements.length > 0 ||
    sourceElements.length > 0 ||
    videoIframes.length > 0 ||
    possibleVideoLinks.length > 0;


  return {

    hasVideoEvidence,

    allVideoElements,

    sourceElements,

    videoIframes,

    possibleVideoLinks
  };
}


// ============================================================
// COLLECT DIRECT VIDEO SOURCES
// ============================================================

/**
 * Collects video URLs that Project Scraper can
 * attempt to download.
 *
 * Sources may come from:
 *
 * video[src]
 * video[data-src]
 * source[src]
 * source[data-src]
 * direct .mp4/.webm/etc links
 */
function collectVideoSources(
  doc,
  inputUrl
) {

  const sources =
    new Map();


  // ==========================================================
  // VIDEO ELEMENTS
  // ==========================================================

  const videoElements =
    Array.from(
      doc.querySelectorAll(
        "video"
      )
    );


  for (
    const videoElement of
    videoElements
  ) {

    const possibleSources = [

      videoElement.getAttribute(
        "src"
      ),

      videoElement.getAttribute(
        "data-src"
      ),

      videoElement.getAttribute(
        "data-video-src"
      )

    ];


    for (
      const possibleSource of
      possibleSources
    ) {

      if (!possibleSource) {
        continue;
      }


      const resolved =
        resolveVideoUrl(
          possibleSource,
          inputUrl
        );


      if (!resolved) {
        continue;
      }


      if (
        !sources.has(
          resolved
        )
      ) {

        sources.set(
          resolved,
          [videoElement]
        );

      } else {

        sources
          .get(resolved)
          .push(
            videoElement
          );
      }
    }
  }


  // ==========================================================
  // SOURCE ELEMENTS
  // ==========================================================

  const sourceElements =
    Array.from(
      doc.querySelectorAll(
        "video source"
      )
    );


  for (
    const sourceElement of
    sourceElements
  ) {

    const possibleSource =
      sourceElement.getAttribute(
        "src"
      ) ||
      sourceElement.getAttribute(
        "data-src"
      );


    if (!possibleSource) {
      continue;
    }


    const resolved =
      resolveVideoUrl(
        possibleSource,
        inputUrl
      );


    if (!resolved) {
      continue;
    }


    if (
      !sources.has(
        resolved
      )
    ) {

      sources.set(
        resolved,
        [sourceElement]
      );

    } else {

      sources
        .get(resolved)
        .push(
          sourceElement
        );
    }
  }


  // ==========================================================
  // DIRECT MEDIA LINKS / ATTRIBUTES
  // ==========================================================

  const elementsWithUrls =
    Array.from(
      doc.querySelectorAll(
        "[src], [data-src], [href]"
      )
    );


  for (
    const element of
    elementsWithUrls
  ) {

    const possibleSource =
      element.getAttribute(
        "src"
      ) ||
      element.getAttribute(
        "data-src"
      ) ||
      element.getAttribute(
        "href"
      );


    if (
      !possibleSource ||
      !looksLikeVideoUrl(
        possibleSource
      )
    ) {

      continue;
    }


    const resolved =
      resolveVideoUrl(
        possibleSource,
        inputUrl
      );


    if (!resolved) {
      continue;
    }


    if (
      !sources.has(
        resolved
      )
    ) {

      sources.set(
        resolved,
        []
      );
    }
  }


  return sources;
}


// ============================================================
// REWRITE DOWNLOADED VIDEO PATHS
// ============================================================

/**
 * Rewrites matching video/source elements so
 * the offline HTML points to the copy stored
 * inside the ZIP.
 */
function rewriteVideoElements(
  elements,
  videoName,
  isRootPage
) {

  const videoFolderLocation =
    (
      state.maxDepthValue === 0 ||
      isRootPage
    )
      ? "video/"
      : "../video/";


  for (
    const element of elements
  ) {

    try {

      element.setAttribute(
        "src",
        videoFolderLocation +
          videoName
      );


      element.removeAttribute(
        "data-src"
      );


      element.removeAttribute(
        "crossorigin"
      );


    } catch (error) {

      console.warn(
        "Unable to rewrite video element:",
        error
      );
    }
  }
}


// ============================================================
// PROCESS WEBSITE VIDEOS
// ============================================================

/**
 * Detects website video content and attempts
 * to download directly accessible video files.
 *
 * IMPORTANT:
 *
 * Video state is NOT reset here.
 *
 * scraper.js resets:
 *
 * state.videoFound
 * state.videoDownloaded
 * state.videoDownloadFailed
 *
 * once at the beginning of the entire crawl.
 */
export async function processVideos(
  htmlData,
  inputUrl,
  isRootPage = false
) {

  const parser =
    new DOMParser();


  const doc =
    parser.parseFromString(
      htmlData,
      "text/html"
    );


  state.zip.folder(
    "video"
  );


  // ==========================================================
  // DETECT VIDEO EVIDENCE
  // ==========================================================

  const evidence =
    detectVideoEvidence(
      doc
    );


  console.log(
    "Video detection results:",
    {
      page:
        inputUrl,

      videoElements:
        evidence.allVideoElements.length,

      sourceElements:
        evidence.sourceElements.length,

      videoIframes:
        evidence.videoIframes.length,

      possibleVideoLinks:
        evidence.possibleVideoLinks.length
    }
  );


  // ==========================================================
  // NO VIDEO FOUND
  // ==========================================================

  if (
    !evidence.hasVideoEvidence
  ) {

    console.log(
      "No video evidence found on page:",
      inputUrl
    );


    return doc.documentElement.outerHTML;
  }


  // ==========================================================
  // VIDEO FOUND
  // ==========================================================

  state.videoFound =
    true;


  console.log(
    "Video content detected on page:",
    inputUrl
  );


  // ==========================================================
  // COLLECT DIRECT SOURCES
  // ==========================================================

  const videoSources =
    collectVideoSources(
      doc,
      inputUrl
    );


  console.log(
    "Direct video sources found:",
    Array.from(
      videoSources.keys()
    )
  );


  // ==========================================================
  // VIDEO EXISTS BUT NO DIRECT SOURCE
  // ==========================================================

  if (
    videoSources.size === 0
  ) {

    /*
     * Examples:
     *
     * <video> populated later by JavaScript
     *
     * YouTube iframe
     *
     * Vimeo iframe
     *
     * custom embedded player
     *
     * dynamically generated media
     */

    markVideoDownloadFailure(
      inputUrl,
      "Video player detected, but no directly downloadable video source was found."
    );


    updateStatus(
      "A website video was detected, but it could not be downloaded automatically."
    );


    return doc.documentElement.outerHTML;
  }


  // ==========================================================
  // ATTEMPT EACH VIDEO SOURCE
  // ==========================================================

  for (
    const [
      videoSrc,
      associatedElements
    ] of videoSources
  ) {

    try {


      // ======================================================
      // BLOB VIDEO
      // ======================================================

      if (
        videoSrc.startsWith(
          "blob:"
        )
      ) {

        markVideoDownloadFailure(
          videoSrc,
          "Blob video URLs cannot be downloaded directly from the saved HTML."
        );


        continue;
      }


      // ======================================================
      // DATA VIDEO
      // ======================================================

      if (
        videoSrc.startsWith(
          "data:"
        )
      ) {

        markVideoDownloadFailure(
          videoSrc,
          "Data-based video sources are not currently supported."
        );


        continue;
      }


      // ======================================================
      // HLS
      // ======================================================

      if (
        videoSrc
          .toLowerCase()
          .includes(
            ".m3u8"
          )
      ) {

        markVideoDownloadFailure(
          videoSrc,
          "HLS streaming video is not currently supported."
        );


        continue;
      }


      // ======================================================
      // DASH
      // ======================================================

      if (
        videoSrc
          .toLowerCase()
          .includes(
            ".mpd"
          )
      ) {

        markVideoDownloadFailure(
          videoSrc,
          "DASH streaming video is not currently supported."
        );


        continue;
      }


      // ======================================================
      // SKIPPABLE URL
      // ======================================================

      if (
        isSkippableAssetUrl(
          videoSrc
        )
      ) {

        markVideoDownloadFailure(
          videoSrc,
          "Video URL was considered skippable."
        );


        continue;
      }


      // ======================================================
      // CREATE FILENAME
      // ======================================================

      const videoName =
        getSafeFilename(
          videoSrc,
          "mp4"
        );


      // ======================================================
      // ALREADY DOWNLOADED
      // ======================================================

      if (
        state.urlVideos.includes(
          videoSrc
        )
      ) {

        console.log(
          "Video already downloaded:",
          videoSrc
        );


        state.videoDownloaded =
          true;


        rewriteVideoElements(
          associatedElements,
          videoName,
          isRootPage
        );


        continue;
      }


      // ======================================================
      // ATTEMPT DOWNLOAD
      // ======================================================

      updateStatus(
        `Downloading website video: ${videoName}`
      );


      console.log(
        "Attempting website video download:",
        videoSrc
      );


      try {

        const videoData =
          await downloadVideo(
            videoSrc
          );


        // ====================================================
        // SAVE VIDEO
        // ====================================================

        state.zip.file(
          "video/" +
            videoName,
          videoData,
          {
            binary:
              true
          }
        );


        state.urlVideos.push(
          videoSrc
        );


        state.videoDownloaded =
          true;


        console.log(
          "Website video successfully downloaded:",
          videoSrc
        );


        // ====================================================
        // REWRITE HTML
        // ====================================================

        rewriteVideoElements(
          associatedElements,
          videoName,
          isRootPage
        );


      } catch (fetchError) {

        console.error(
          "Website video download failed:",
          videoSrc,
          fetchError
        );


        markVideoDownloadFailure(
          videoSrc,
          fetchError.message
        );
      }


    } catch (error) {

      console.error(
        "Video processing error:",
        videoSrc,
        error
      );


      markVideoDownloadFailure(
        videoSrc,
        error.message
      );
    }
  }


  // ==========================================================
  // FINAL VIDEO STATUS
  // ==========================================================

  if (
    state.videoFound &&
    state.videoDownloadFailed &&
    !state.videoDownloaded
  ) {

    updateStatus(
      "Website video could not be downloaded automatically. You can add the video from your computer instead."
    );


    console.warn(
      "Automatic website video download failed. Manual video fallback should be offered."
    );
  }


  else if (
    state.videoDownloaded &&
    state.videoDownloadFailed
  ) {

    updateStatus(
      "Some website videos were downloaded, but others could not be saved."
    );


    console.warn(
      "At least one website video failed to download."
    );
  }


  else if (
    state.videoDownloaded
  ) {

    updateStatus(
      "Website video downloaded successfully."
    );
  }


  return doc.documentElement.outerHTML;
}


// ============================================================
// LOCAL VIDEO VALIDATION
// ============================================================

/**
 * Checks whether a user-selected file appears
 * to be a supported local video.
 */
export function isLocalVideoFile(
  file
) {

  if (
    !file ||
    typeof file.name !==
      "string"
  ) {

    return false;
  }


  // ==========================================================
  // MIME TYPE
  // ==========================================================

  if (
    file.type &&
    file.type.startsWith(
      "video/"
    )
  ) {

    return true;
  }


  // ==========================================================
  // FILE EXTENSION
  // ==========================================================

  const lower =
    file.name.toLowerCase();


  return (
    lower.endsWith(
      ".mp4"
    ) ||

    lower.endsWith(
      ".webm"
    ) ||

    lower.endsWith(
      ".mov"
    ) ||

    lower.endsWith(
      ".m4v"
    ) ||

    lower.endsWith(
      ".avi"
    ) ||

    lower.endsWith(
      ".mkv"
    )
  );
}


// ============================================================
// UNIQUE LOCAL VIDEO FILENAME
// ============================================================

/**
 * Prevents a user-selected local video from
 * overwriting another video in the ZIP.
 *
 * Example:
 *
 * video.mp4
 * video_2.mp4
 * video_3.mp4
 */
export function getUniqueVideoFilename(
  originalName
) {

  let safeName =
    getSafeFilename(
      originalName,
      "mp4"
    );


  // ==========================================================
  // NAME IS AVAILABLE
  // ==========================================================

  if (
    !state.zip.file(
      "video/" +
        safeName
    )
  ) {

    return safeName;
  }


  // ==========================================================
  // SPLIT EXTENSION
  // ==========================================================

  const dotIndex =
    safeName.lastIndexOf(
      "."
    );


  let baseName =
    safeName;


  let extension =
    "";


  if (
    dotIndex > 0
  ) {

    baseName =
      safeName.substring(
        0,
        dotIndex
      );


    extension =
      safeName.substring(
        dotIndex
      );
  }


  // ==========================================================
  // FIND UNUSED NAME
  // ==========================================================

  let counter =
    2;


  let candidate =
    `${baseName}_${counter}${extension}`;


  while (
    state.zip.file(
      "video/" +
        candidate
    )
  ) {

    counter++;


    candidate =
      `${baseName}_${counter}${extension}`;
  }


  return candidate;
}


// ============================================================
// ADD LOCAL VIDEOS TO ZIP
// ============================================================

/**
 * Adds videos selected by the user into:
 *
 * video/
 *
 * This handles:
 *
 * 1. Videos selected BEFORE scraping from popup.html
 *
 * 2. A replacement video selected AFTER automatic
 *    website video downloading fails.
 */
export async function addLocalVideosToZip() {

  if (
    !Array.isArray(
      state.selectedLocalVideos
    ) ||
    state.selectedLocalVideos.length ===
      0
  ) {

    return;
  }


  state.zip.folder(
    "video"
  );


  let successfullyAdded =
    0;


  // ==========================================================
  // ADD EACH VIDEO
  // ==========================================================

  for (
    const file of
    state.selectedLocalVideos
  ) {

    try {


      // ======================================================
      // VALIDATE FILE
      // ======================================================

      if (
        !isLocalVideoFile(
          file
        )
      ) {

        console.warn(
          "Unsupported local video:",
          file?.name
        );


        continue;
      }


      // ======================================================
      // STATUS
      // ======================================================

      updateStatus(
        `Adding local video: ${file.name}`
      );


      // ======================================================
      // UNIQUE FILENAME
      // ======================================================

      const videoName =
        getUniqueVideoFilename(
          file.name
        );


      // ======================================================
      // READ FILE
      // ======================================================

      const arrayBuffer =
        await file.arrayBuffer();


      const videoData =
        new Uint8Array(
          arrayBuffer
        );


      // ======================================================
      // ADD TO ZIP
      // ======================================================

      state.zip.file(
        "video/" +
          videoName,
        videoData,
        {
          binary:
            true
        }
      );


      successfullyAdded++;


      console.log(
        "Local video added:",
        videoName
      );


    } catch (error) {

      console.error(
        "Failed adding local video:",
        file?.name ||
          "Unknown File",
        error
      );
    }
  }


  // ==========================================================
  // RESULT
  // ==========================================================

  if (
    successfullyAdded > 0
  ) {

    updateStatus(
      `${successfullyAdded} local video` +
      `${successfullyAdded === 1 ? "" : "s"}` +
      ` added successfully.`
    );


    /*
     * The user supplied a replacement,
     * so the unresolved automatic-download
     * failure is now handled.
     */
    state.videoDownloadFailed =
      false;


  } else {

    updateStatus(
      "No supported local videos were added."
    );
  }
}