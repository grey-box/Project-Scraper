/**
 * UI & WINDOW MANAGEMENT
 *
 * Controls:
 * - progress bar
 * - status text
 * - video fallback UI
 * - fixed window size
 */


export const feedbackFormSection =
  document.getElementById("feedback-form-section");

export const progressBar =
  document.getElementById("progress-bar");

export const currentProgress =
  document.getElementById("current-progress");

export const statusMessage =
  document.getElementById("status-message");


// ============================================================
// VIDEO FALLBACK ELEMENTS
// ============================================================

export const videoFallbackSection =
  document.getElementById("video-fallback-section");

export const fallbackVideoInput =
  document.getElementById("fallback-video-input");

export const fallbackVideoName =
  document.getElementById("fallback-video-name");

export const useFallbackVideoButton =
  document.getElementById("use-fallback-video-button");

export const continueWithoutVideoButton =
  document.getElementById("continue-without-video-button");


// ============================================================
// WINDOW SIZE
// ============================================================

const FIXED_WINDOW_WIDTH = 360;

/*
 * Slightly taller because the video fallback
 * needs room when it appears.
 */
const NORMAL_WINDOW_HEIGHT = 450;

const VIDEO_FALLBACK_WINDOW_HEIGHT = 650;


// ============================================================
// INITIAL STATE
// ============================================================

if (feedbackFormSection) {
  feedbackFormSection.style.display = "none";
}

if (videoFallbackSection) {
  videoFallbackSection.style.display = "none";
}


// ============================================================
// PROGRESS
// ============================================================

// ============================================================
// DOWNLOAD TIME ESTIMATOR
// ============================================================

const estimatedTimeRemaining =
  document.getElementById("estimated-time-remaining");

let downloadStartTime = null;
let lastProgressTime = null;
let lastProgressFraction = 0;
let smoothedProgressRate = null;

export function startDownloadTimer() {
  downloadStartTime = performance.now();
  lastProgressTime = null;
  lastProgressFraction = 0;
  smoothedProgressRate = null;

  if (estimatedTimeRemaining) {
    estimatedTimeRemaining.innerText =
      "Calculating...";
  }
}

export function finishDownloadTimer() {
  downloadStartTime = null;
  lastProgressTime = null;
  smoothedProgressRate = null;

  if (estimatedTimeRemaining) {
    estimatedTimeRemaining.innerText =
      "Completed";
  }
}

export function formatRemainingTime(seconds) {
  const totalSeconds = Math.max(
    0,
    Math.ceil(seconds)
  );

  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

export function updateProgress(currentCount, totalCount) {
  if (totalCount <= 0) {
    return;
  }

  const fraction = Math.max(
    0,
    Math.min(currentCount / totalCount, 1)
  );

  const percentage = Math.ceil(fraction * 100);
  const progressPercentage = `${percentage}%`;

  if (currentProgress) {
    currentProgress.innerText = progressPercentage;
    currentProgress.style.display = "inline";
  }

  if (progressBar) {
    progressBar.style.display = "flex";
    progressBar.style.width = progressPercentage;
  }

  // Calculate estimated time remaining.
  if (downloadStartTime === null) {
    startDownloadTimer();
  }

  if (!estimatedTimeRemaining) {
    return;
  }

  if (fraction >= 1) {
    estimatedTimeRemaining.innerText =
      "Finalizing download...";
    return;
  }

  const now = performance.now();
  const elapsedSeconds =
    (now - downloadStartTime) / 1000;

  // Wait for enough progress before estimating.
  if (elapsedSeconds < 3 || fraction < 0.05) {
    estimatedTimeRemaining.innerText =
      "Calculating...";
    return;
  }

  if (
    lastProgressTime !== null &&
    fraction > lastProgressFraction
  ) {
    const timeDifference =
      (now - lastProgressTime) / 1000;

    const progressDifference =
      fraction - lastProgressFraction;

    if (timeDifference > 0) {
      const currentRate =
        progressDifference / timeDifference;

      smoothedProgressRate =
        smoothedProgressRate === null
          ? currentRate
          : (0.3 * currentRate) +
            (0.7 * smoothedProgressRate);
    }
  }

  // Use average progress rate until enough
  // samples are available.
  const averageRate = fraction / elapsedSeconds;
  const rate =
    smoothedProgressRate ?? averageRate;

  if (rate <= 0) {
    estimatedTimeRemaining.innerText =
      "Calculating...";
    return;
  }

  const remainingSeconds =
    (1 - fraction) / rate;

  estimatedTimeRemaining.innerText =
    `~ ${formatRemainingTime(remainingSeconds)} remaining`;

  lastProgressTime = now;
  lastProgressFraction = fraction;
}


// ============================================================
// STATUS
// ============================================================

export function updateStatus(message) {

  if (statusMessage) {
    statusMessage.innerText = message;
  }
}


// ============================================================
// VIDEO FALLBACK
// ============================================================

/**
 * Ask the user whether they want to:
 *
 * 1. provide a replacement video
 *
 * OR
 *
 * 2. continue without video
 *
 * Returns:
 *
 * File
 *
 * OR
 *
 * null
 */
export function requestFallbackVideo() {

  return new Promise((resolve) => {

    if (
      !videoFallbackSection ||
      !fallbackVideoInput ||
      !useFallbackVideoButton ||
      !continueWithoutVideoButton
    ) {

      console.warn(
        "Video fallback UI is unavailable."
      );

      resolve(null);

      return;
    }


    let selectedFile =
      null;


    // --------------------------------------------------------
    // RESET UI
    // --------------------------------------------------------

    videoFallbackSection.style.display =
      "block";


    fallbackVideoInput.value =
      "";


    useFallbackVideoButton.disabled =
      true;


    if (fallbackVideoName) {

      fallbackVideoName.innerText =
        "No replacement video selected.";
    }


    updateStatus(
      "Website video could not be downloaded. Choose a replacement video or continue without it."
    );


    // Give the fallback controls more room.
    try {

      window.resizeTo(
        FIXED_WINDOW_WIDTH,
        VIDEO_FALLBACK_WINDOW_HEIGHT
      );

    } catch (error) {

      console.warn(
        "Unable to resize popup for video fallback:",
        error
      );
    }


    // --------------------------------------------------------
    // FILE SELECTION
    // --------------------------------------------------------

    const handleFileChange =
      () => {

        const files =
          fallbackVideoInput.files;


        if (
          !files ||
          files.length === 0
        ) {

          selectedFile =
            null;


          useFallbackVideoButton.disabled =
            true;


          if (fallbackVideoName) {

            fallbackVideoName.innerText =
              "No replacement video selected.";
          }


          return;
        }


        selectedFile =
          files[0];


        useFallbackVideoButton.disabled =
          false;


        if (fallbackVideoName) {

          const sizeMb =
            (
              selectedFile.size /
              1024 /
              1024
            ).toFixed(2);


          fallbackVideoName.innerText =
            `${selectedFile.name} (${sizeMb} MB)`;
        }
      };


    // --------------------------------------------------------
    // CLEANUP
    // --------------------------------------------------------

    const cleanup =
      () => {

        fallbackVideoInput.removeEventListener(
          "change",
          handleFileChange
        );


        useFallbackVideoButton.removeEventListener(
          "click",
          handleUseVideo
        );


        continueWithoutVideoButton.removeEventListener(
          "click",
          handleContinue
        );


        videoFallbackSection.style.display =
          "none";


        try {

          window.resizeTo(
            FIXED_WINDOW_WIDTH,
            NORMAL_WINDOW_HEIGHT
          );

        } catch (error) {

          console.warn(
            "Unable to restore popup size:",
            error
          );
        }
      };


    // --------------------------------------------------------
    // USE VIDEO
    // --------------------------------------------------------

    const handleUseVideo =
      () => {

        if (!selectedFile) {
          return;
        }


        cleanup();


        resolve(
          selectedFile
        );
      };


    // --------------------------------------------------------
    // CONTINUE WITHOUT VIDEO
    // --------------------------------------------------------

    const handleContinue =
      () => {

        cleanup();


        resolve(
          null
        );
      };


    // --------------------------------------------------------
    // LISTENERS
    // --------------------------------------------------------

    fallbackVideoInput.addEventListener(
      "change",
      handleFileChange
    );


    useFallbackVideoButton.addEventListener(
      "click",
      handleUseVideo
    );


    continueWithoutVideoButton.addEventListener(
      "click",
      handleContinue
    );

  });
}


// ============================================================
// WINDOW MANAGEMENT
// ============================================================

export function enforceWindowSize() {

  /*
   * Don't shrink the window while the
   * fallback UI is visible.
   */
  const fallbackVisible =
    videoFallbackSection &&
    videoFallbackSection.style.display !==
      "none";


  const targetHeight =
    fallbackVisible
      ? VIDEO_FALLBACK_WINDOW_HEIGHT
      : NORMAL_WINDOW_HEIGHT;


  try {

    window.resizeTo(
      FIXED_WINDOW_WIDTH,
      targetHeight
    );

  } catch (error) {

    console.warn(
      "Unable to resize popup window:",
      error
    );
  }
}