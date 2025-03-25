// Initial user settings which are set via messages from the BroadcastChannel
let startingURLInput = "";
let currentPage = "";
let isExcludeImages = false;
let isFocusMode = false;
let isRestrictDomain = false;
let maxDepthValue = 0;
let firstPage = true;

// Lists to keep track of different types of URLs and avoid duplicates
let urlList = [];
let urlCSSs = [];
let urlImages = [];
let urlVideos = [];
let urlJSs = [];

// Keep track of base count for when links are at 0 depth
let zeroDepthCounter = 0;
let totalZeroDepthCounter = 0;

// Flag to track if the scraping is completed
let scrapingDone = false;

// Used to show/hide user feedback form section
let feedbackFormSection = document.getElementById("feedback-form-section");
feedbackFormSection.style.display = "none";

/**
 * Updates the 'flagDownload' in the chrome storage with the given boolean value.
 * This function acts as a way to set a flag that indicates whether a download operation is ongoing.
 * @param {boolean} isDownloading - A boolean value indicating the download status.
 */
const setDownloadFlag = (isDownloading) => {
  chrome.storage.sync.set({ downloadFlag: isDownloading });
};


/**
 * Sets the maximum depth for our search
 */
const setMaxDepth = (newMaxDepthValue) => {
  maxDepthValue = newMaxDepthValue;
};

/**
 * Sets the current page for our search
 */
const setCurrentPage = (newCurrentPage) => {
  currentPage = newCurrentPage;
};

// Creating a new BroadcastChannel instance to communicate between different contexts
const broadcastChannel = new BroadcastChannel("scraper_data");

/**
 * Event listener to handle messages from the broadcast channel.
 * These messages contain user settings for the scraping process.
 * Once the message is received, it initiates the download process.
 */
broadcastChannel.addEventListener("message", (event) => {
  // Destructuring the event data array to extract individual settings
  [startingURLInput, isFocusMode, isRestrictDomain, newMaxDepthValue] = event.data;

  // Calling function to set download flag
  setDownloadFlag(true);

  // Set Max Depth Value
  setMaxDepth(newMaxDepthValue);
  
  // Set the current page
  setCurrentPage(startingURLInput);

  // Initiating the save process
  startScrapingProcess();
});

// Initialize a variable with the extension's ID
let extId = chrome.runtime.id;

// Initialize a variable to track the depth of the crawl, set to zero by default
let depth = 0;

// Create a new JSZip instance to hold the zipped contents
let zip = new JSZip();

/**
 * A function to simulate asynchronous work with a given delay.
 * This function resets the progress bar and progress text if the current progress is 100%.
 *
 * @param {number} delay - The delay in milliseconds before the function executes.
 * @returns {Promise} - A promise that resolves if the current progress is 100%.
 */
function performLoadingProcess(delay) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Checking if the current progress is at 100%
      if (document.getElementById("current-progress").innerText === "100%") {
        // Resetting the progress text and bar to 0%
        document.getElementById("current-progress").innerText = "0%";
        document.getElementById("progress-bar").style.width = "0%";

        // Resetting the progress bar to be not displayed
        document.getElementById("current-progress").style.display = "none";
        document.getElementById("progress-bar").style.display = "none";

        // Resolve the promise indicating the async work is done
        resolve();
      }
    }, delay);
  });
}

/**
 * Calculates the download progress percentage.
 *
 * @param {number} currentCount - The current count of processed items.
 * @param {number} totalCount - The total number of items to process.
 * @returns {string} - The progress percentage as a string.
 */
function calculateProgressPercentage(currentCount, totalCount) {
  if (totalCount === 0) {
    return "0%";
  }

  let percentage = Math.ceil((currentCount / totalCount) * 100);
  if (percentage > 100) {
    percentage = 100;
  }

  return percentage.toString() + "%";
}

/**
 * This function basically keeps track of count of an estimate for
 * the page when things are at zero depth.
 *
 * ToDo: This function should probably be a standard for all calculations
 *
 * @param {*} inputUrl - The url which
 */
async function zeroDepthCounterEstimator(inputUrl) {
  // Note that we are estimating length
  console.log("Estimating the length of urls to be processed");

  // Setup some basic stuff for getting information out of the page
  let html = await getData(inputUrl);
  let parser = new DOMParser();
  let parsed = parser.parseFromString(html, "text/html");

  // Get the total number of links for css, pdf and javascript for an estimate
  let cssTotal = parsed.querySelectorAll("link[rel='stylesheet']").length;
  let pdfTotal = Array.from(parsed.getElementsByTagName("a")).filter(
    (element) => element.href.includes(".pdf")
  ).length;
  let javascriptTotal = Array.from(
    parsed.getElementsByTagName("script")
  ).filter((element) => element.hasAttribute("src")).length;
  let imagesTotal = Array.from(parsed.getElementsByTagName("img")).length;
  let videoTotal = Array.from(parsed.querySelectorAll('video[src], iframe[src]')).length;

  // Set the total amount for zero depth
  totalZeroDepthCounter =
    cssTotal + pdfTotal + javascriptTotal + videoTotal + imagesTotal;

  return new Promise((resolve, reject) => {
    resolve();
  });
}

/**
 * Updates the progress bar for zero depths
 */
function zeroDepthCounterUpdate() {
  // Use requestAnimationFrame to ensure the DOM updates
  // await new Promise((resolve) => requestAnimationFrame(resolve));

  if (maxDepthValue == 0) {
    // Update the progress
    console.log("Progress Update");
    zeroDepthCounter++;

    const progressPercentage = calculateProgressPercentage(
      zeroDepthCounter + 1,
      totalZeroDepthCounter
    );
    document.getElementById("current-progress").innerText = progressPercentage;
    document.getElementById("progress-bar").style.width = progressPercentage;
  }
}

/**
 * This is main function that iterates through the list of all pages and starts scrapping process.
 */
async function startScrapingProcess() {
  // Start to process the links we want to scrape.
  await processLinks();

  // Wait for 3 seconds before continuing
  await performLoadingProcess(3000);

  // Generate the zip file name from the hostname of the starting URL
  let zipName = new URL(startingURLInput).hostname;

  // Generate the zip file and initiate the download process
  zip.generateAsync({ type: "blob" }).then((content) => {
    console.log("ZIP Download Process");
    let urlBlob = URL.createObjectURL(content);

    // Initiate the download process and catch any errors that occur
    chrome.downloads
      .download({
        url: urlBlob,
        filename: zipName + ".zip",
        saveAs: true,
      })
      .catch((error) => {
        // Log any errors that occur in the download process.
        console.error("Error in Download Process: " + error);
      });
  });

  // Add a listener to track the download progress and display the feedback form upon completion
  chrome.downloads.onChanged.addListener(function (downloadFile) {
    if (downloadFile.state && downloadFile.state.current === "complete") {
      feedbackFormSection.style.display = "block";
    }
  });

  // // Reset the download flag and clear the zip variable for future use
  setDownloadFlag(false);
  zip = new JSZip();
}
/**
 * Processes both external CSS files and inline styles within the HTML to 
 * handle images and replace them with locally stored images.
 *
 * @param {string} htmlData - The HTML content in which to find CSS and inline styles.
 * @param {string} inputUrl - The base URL of the HTML file to resolve relative paths.
 * @returns {Promise<string>} - The modified HTML with updated CSS links and inline styles.
 */
async function processCSSAndImages(htmlData, inputUrl) {
  console.log("Processing CSS Files and Inline Styles");

  // Parse the HTML data using DOMParser
  const parser = new DOMParser();
  let doc = parser.parseFromString(htmlData, "text/html");

  // Process external CSS files (linked via <link> tags)
  const linkElements = doc.querySelectorAll('link[rel="stylesheet"]');

  for (let linkElement of linkElements) {
    try {
      let cssHref = linkElement.getAttribute("href");

      if (maxDepthValue === 0) zeroDepthCounterUpdate();

      // Convert to absolute URL if necessary
      if (!cssHref.startsWith("https://") && !cssHref.startsWith("http://")) {
        cssHref = getAbsolutePath(cssHref, inputUrl).href;
      }

      // Skip processing if CSS file has already been processed
      if (urlCSSs.includes(cssHref)) continue;
      urlCSSs.push(cssHref);

      // Fetch the CSS file data
      const cssData = await getData(cssHref);

      if (cssData !== "Failed") {
        // Process the CSS file for images
        const processedCSS = await processCSSImages(cssData, cssHref);

        // Add the processed CSS to the zip
        zip.file("css/" + getTitle(cssHref) + ".css", processedCSS);

        // Update the link tag to point to the local CSS file
        let cssFolderLocation = firstPage === true ? "css/" : "../css/";
        linkElement.setAttribute("href", cssFolderLocation + getTitle(cssHref) + ".css");
      } else {
        console.error(`Failed to fetch CSS file: ${cssHref}`);
      }
    } catch (error) {
      console.error(error);
    }
  }

  // Process inline <style> tags
  const styleElements = doc.querySelectorAll('style');

  for (let styleElement of styleElements) {
    try {
      let styleContent = styleElement.textContent;

      // Process inline CSS to handle image URLs
      let processedStyleContent = await processCSSImages(styleContent, inputUrl);

      // Update the <style> tag with the processed content
      styleElement.textContent = processedStyleContent;
    } catch (error) {
      console.error(error);
    }
  }

  // Return the updated HTML
  return doc.documentElement.outerHTML;
}

/**
* Processes CSS content (from external CSS files or inline styles) to find image URLs, download the images,
* and replace them with locally stored paths. Handles errors like 404 and ensures image processing continues.
*
* @param {string} cssData - The raw CSS content to be processed.
* @param {string} cssUrl - The URL of the CSS file (or base URL for inline styles) to resolve relative image paths.
* @returns {Promise<string>} - The processed CSS with updated image URLs pointing to locally stored images.
*/
async function processCSSImages(cssData, cssUrl) {
  // Regular expression to match `url()` in CSS (used for images)
  const imageUrlRegex = /url\(["']?([^"')]+)["']?\)/g;

  // Array to store promises for each image download
  let downloadPromises = [];

  // Perform a replace, collecting promises for asynchronous image fetching
  const updatedCSS = cssData.replace(imageUrlRegex, (match, imageUrl) => {
    let resolvedUrl = imageUrl;

    // Handle different types of URLs
    if (imageUrl.startsWith("//")) {
      resolvedUrl = "https:" + imageUrl;
    } else if (!imageUrl.startsWith("https://") && !imageUrl.startsWith("http://")) {
      resolvedUrl = getAbsolutePath(imageUrl, cssUrl).href;
    }

    // Extract the image file name from the resolved URL
    let imageName = resolvedUrl.substring(resolvedUrl.lastIndexOf("/") + 1).replace(/[&\/\\#,+()$~%'":*?<>{}]/g, "");

    // Check if the image has already been processed
    if (!urlImages.includes(imageName)) {
      urlImages.push(imageName);

      // Add a new promise to handle the asynchronous image downloading
      const promise = urlToPromise(resolvedUrl)
        .then((imageData) => {
          // Add the image to the zip asynchronously
          zip.file("img/" + imageName, imageData, { binary: true });
          console.log(`Image downloaded and added to zip: ${resolvedUrl}`);
        })
        .catch((err) => {
          // Handle any errors during the download (e.g., 404)
          console.error(`Error fetching image from: ${resolvedUrl}`);
        });

      // Add the promise to the array
      downloadPromises.push(promise);
    }

    // Replace the original URL in the CSS with the local path
    return `url("../img/${imageName}")`;
  });

  // Wait for all download promises to complete
  await Promise.all(downloadPromises);

  return updatedCSS;
}

/**
 * 
 * Processes to handle PDF files
 *
 * @param {string} htmlData - The HTML content in which to find PDFs
 * @param {string} inputUrl - The base URL of the HTML file to resolve relative paths.
 * @returns {Promise<string>} - The modified HTML with updated PDF links
 */
async function processPdfs(htmlData, inputUrl) {
  console.log("Processing PDFs");

  // Parse the HTML data using DOMParser
  const parser = new DOMParser();
  let doc = parser.parseFromString(htmlData, "text/html");

  // Select all anchor tags that link to PDFs
  const anchorElements = doc.querySelectorAll('a[href$=".pdf"]');

  for (let anchorElement of anchorElements) {
    // Get the PDF file URL
    let pdfHref = anchorElement.getAttribute("href");

    try {

      if (maxDepthValue === 0) zeroDepthCounterUpdate();

      // Convert to absolute URL if necessary
      if (!pdfHref.startsWith("https://") && !pdfHref.startsWith("http://")) {
        pdfHref = getAbsolutePath(pdfHref, inputUrl).href;
      }

      // Skip processing if the PDF file has already been processed
      if (urlPdfs.includes(pdfHref)) continue;
      urlPdfs.push(pdfHref);

      // Fetch the PDF file data
      const pdfData = await getData(pdfHref);

      if (pdfData !== "Failed") {
        // Add the PDF to the zip file
        zip.file("pdf/" + getTitle(pdfHref) + ".pdf", pdfData, { binary: true });

        // Update the anchor tag to point to the local PDF file
        let pdfFolderLocation = firstPage === true ? "pdf/" : "../pdf/";
        anchorElement.setAttribute("href", pdfFolderLocation + getTitle(pdfHref) + ".pdf");
      } else {
        console.error(`Failed to fetch PDF file: ${pdfHref}`);
      }
    } catch (error) {
      console.error(error);
    }
  }

  // Return the updated HTML
  return doc.documentElement.outerHTML;
}

/**
 * Processes to handle Image files
 *
 * @param {string} htmlData - The HTML content in which to find images.
 * @param {string} inputUrl - The base URL of the HTML file to resolve relative paths.
 * @returns {Promise<string>} - The modified HTML with updated image links
 */
async function processImages(htmlData, inputUrl) {
  console.log("Processing Image Files");

  // Parse the HTML data using DOMParser
  const parser = new DOMParser();
  let doc = parser.parseFromString(htmlData, "text/html");

  // Select all <img> tags
  const imgElements = doc.querySelectorAll('img');

  for (let imgElement of imgElements) {
    // Get the image src attribute 
    let imgSrc = imgElement.getAttribute("src");

    try {

      // Update the progress bar for zero depth
      if (maxDepthValue === 0) zeroDepthCounterUpdate();

      // If the src attribute is null or the image is a base64 encoded string, skip this iteration
      if (imgSrc === null || imgSrc.includes("base64")) continue;

      // Convert to absolute URL if necessary
      if (!imgSrc.startsWith("https://") && !imgSrc.startsWith("http://")) {
        imgSrc = getAbsolutePath(imgSrc, inputUrl).href;
      }

      // Extract the image name from the URL
      let imageName = imgSrc.substring(imgSrc.lastIndexOf("/") + 1).replace(/[&\/\\#,+()$~%'":*?<>{}]/g, "");

      // Check if the image has already been processed
      if (!urlImages.includes(imageName)) {
        urlImages.push(imageName);

        // Fetch the image data
        const imageData = await urlToPromise(imgSrc);

        // Add the image to the zip file
        zip.file("img/" + imageName, imageData, { binary: true });

        console.log(`Image downloaded and added to zip: ${imgSrc}`);
      }

      // Update the <img> tag to point to the locally stored image
      let imgFolderLocation = firstPage === true ? "img/" : "../img/";
      imgElement.setAttribute("src", imgFolderLocation + imageName);

    } catch (error) {
      console.error(`Error processing image: ${imgSrc}`, error);
    }
  }

  // Return the updated HTML
  return doc.documentElement.outerHTML;
}

/**
 * Processes to handle Javascript files
 *
 * @param {string} htmlData - The HTML content in which to find javascript files.
 * @param {string} inputUrl - The base URL of the HTML file to resolve relative paths.
 * @returns {Promise<string>} - The modified HTML with updated javscript srcs.
 */
async function processJss(htmlData, inputUrl) {
  console.log("Processing JavaScript Files");

  // Parse the HTML data using DOMParser
  const parser = new DOMParser();
  let doc = parser.parseFromString(htmlData, "text/html");

  // Process external <script> tags with a src attribute
  const scriptElements = doc.querySelectorAll('script[src]');

  for (let scriptElement of scriptElements) {
    try {
      let scriptSrc = scriptElement.getAttribute("src");

      if (maxDepthValue === 0) zeroDepthCounterUpdate();

      // Convert to absolute URL if necessary
      if (!scriptSrc.startsWith("https://") && !scriptSrc.startsWith("http://")) {
        scriptSrc = getAbsolutePath(scriptSrc, inputUrl).href;
      }

      // Skip processing if JavaScript file has already been processed
      if (urlJSs.includes(scriptSrc)) continue;
      urlJSs.push(scriptSrc);

      // Fetch the JavaScript file data
      const jsData = await getData(scriptSrc);

      if (jsData !== "Failed") {
        // Add the JavaScript file to the zip
        zip.file("js/" + getTitle(scriptSrc) + ".js", jsData);

        // Update the <script> tag to point to the local JavaScript file
        let jsFolderLocation = firstPage === true ? "js/" : "../js/";
        scriptElement.setAttribute("src", jsFolderLocation + getTitle(scriptSrc) + ".js");
      } else {
        console.error(`Failed to fetch JavaScript file: ${scriptSrc}`);
      }
    } catch (error) {
      console.error(error);
    }
  }

  // Optional: Process inline <script> tags (without src) if you need to handle them
  const inlineScriptElements = doc.querySelectorAll('script:not([src])');
  for (let inlineScript of inlineScriptElements) {
    try {
      // Process the inline script content if necessary
      let scriptContent = inlineScript.textContent;
      
      // You can choose to process this content as needed (e.g., save it or manipulate it)
      // For now, we leave it unchanged, but you can add logic here if needed.
      
      // Example: Save inline scripts to a file or perform other processing
      // zip.file("js/inline-script-" + Date.now() + ".js", scriptContent);
      
      // Optionally leave inline scripts as is or modify them
    } catch (error) {
      console.error(error);
    }
  }

  // Return the updated HTML
  return doc.documentElement.outerHTML;
}

/**
 * 
 * Processes to handle Javascript files
 *
 * @param {string} htmlData - The HTML content in which to find video files.
 * @param {string} inputUrl - The base URL of the HTML file to resolve relative paths.
 * @returns {Promise<string>} - The modified HTML with updated video srcs.
 */
async function processVideos(htmlData, inputUrl) {
  console.log("Processing Video Files");

  // Parse the HTML data using DOMParser
  const parser = new DOMParser();
  let doc = parser.parseFromString(htmlData, "text/html");

  // Select all <video> and <iframe> tags with a src attribute
  const videoElements = doc.querySelectorAll('video[src], iframe[src]');

  for (let videoElement of videoElements) {
    try {
      let videoSrc = videoElement.getAttribute("src");

      // If src is null or a base64 encoded video, skip processing
      if (!videoSrc || videoSrc.startsWith("data:")) continue;

      // Resolve relative paths to absolute URLs
      if (!videoSrc.startsWith("https://") && !videoSrc.startsWith("http://")) {
        videoSrc = getAbsolutePath(videoSrc, inputUrl).href;
      }

      // Extract the video name from the src URL and sanitize it
      let videoName = videoSrc
        .substring(videoSrc.lastIndexOf("/") + 1)
        .replace(/[&\/\\#,+()$~%'":*?<>{}]/g, "");

      // Check if the video has already been processed
      if (!urlVideos.includes(videoName)) {
        urlVideos.push(videoName);

        // Fetch the video data and add it to the zip
        const videoData = await urlToPromise(videoSrc);
        zip.file("video/" + videoName, videoData, { binary: true });

        console.log(`Video downloaded and added to zip: ${videoSrc}`);
      }

      // Update the <video> or <iframe> tag to point to the local video file
      let videoFolderLocation = firstPage === true ? "video/" : "../video/";
      videoElement.setAttribute("src", videoFolderLocation + videoName);

      // Update the zero depth counter
      if (maxDepthValue === 0) {
        zeroDepthCounterUpdate();
      }

    } catch (error) {
      console.error(`Error processing video from: ${videoSrc}`, error);
    }
  }

  // Return the updated HTML
  return doc.documentElement.outerHTML;
}

/**
 *
 * @param {*} inputUrl - The URL to be processed
 * @param {*} html - The HTML to be processed
 * @returns {Promise<string>}
 */
async function processHTML(inputUrl, html = "") {
  // Get the HTML data for each page
  if (html == "") htmlData = await getData(inputUrl);
  else htmlData = html;

  htmlData = await processImages(htmlData, inputUrl)
  htmlData = await processPdfs(htmlData, inputUrl);
  htmlData = await processCSSAndImages(htmlData, inputUrl);
  htmlData = await processJss(htmlData, inputUrl);
  htmlData = await processVideos(htmlData, inputUrl);
  
  return new Promise((resolve, reject) => {
    resolve(htmlData);
  });
}

/**
 * Process the links for each website we intend to download.
 */
async function processLinks() {
  /* We have used a BFS approach
   * considering the structure as
   * a tree. It uses a queue based
   * approach to traverse
   * links upto a particular depth
   */

  if (maxDepthValue == 0) {
    // Get the total estimate of links to go through
    await zeroDepthCounterEstimator(currentPage);

    // ProcessHTML
    html = await processHTML(currentPage);

    zip.file(getTitle(currentPage) + ".html", html);

    // Reset the zero depth information
    zeroDepthCounter = 0;
    totalZeroDepthCounter = 0;
  } else if (maxDepthValue == 1) {
    await getLinks();

    // Start for the html
    let html = "";

    // Link counters
    let currentCount = 0;
    let totalCount = urlList.length;

    for (let url of urlList) {
      // Set the html value
      if (currentCount === 0) {
        console.log("Processing: " + url);
        html = await getData(currentPage);
        html = await processHTML(currentPage, html);
      } else {
        console.log("Processing: " + url);
        html = await getData(url);
        html = await processHTML(url, html);
      }

      // Use requestAnimationFrame to ensure the DOM updates
      await new Promise((resolve) => requestAnimationFrame(resolve));

      // Store the HTML in the zip object
      if (currentCount === 0) {
        zip.file(getTitle(currentPage) + ".html", html);
        firstPage = false;
      } else {
        zip.file("html/" + getTitle(url) + ".html", html);
      }

      // Update the progress
      currentCount++;

      // Update the Percentage
      const progressPercentage = calculateProgressPercentage(
        currentCount,
        totalCount
      );

      document.getElementById("current-progress").innerText =
        progressPercentage;
      document.getElementById("progress-bar").style.width = progressPercentage;

    }
  } else {
    // Set a bunch of default values
    let html = "";
    let queue = [];
    queue.push(currentPage);

    for (let i of [...Array(maxDepthValue).keys()]) {
      while (queue.length) {
        let url = queue.shift();
        let urls = await getLinks(url);

        // Link counters
        let currentCount = 0;
        let totalCount = urlList.length;

        for (let j of urls) {
          // Set the html value
          if (html === "") {
            html = getData(currentPage);
            html = await processHTML(currentPage, html);
          } else {
            html = getData(j);
            html = await processHTML(j, html);
          }

          // Update the progress
          currentCount++;

          // Update the Percentage
          const progressPercentage = calculateProgressPercentage(
            currentCount,
            totalCount
          );
          document.getElementById("current-progress").innerText =
            progressPercentage;
          document.getElementById("progress-bar").style.width =
            progressPercentage;

          // Store the HTML in the zip object
          zip.file("html/" + getTitle(j) + ".html", html);

          // Store j in the queue for future use
          queue.push(j);
        }
      }
    }
  }
}

/**
 * Asynchronously processes HTML data to find and modify links to point to local files,
 * nd downloads linked PDF files to include in a zip file. The function is recursive
 * and will scrape links up to a specified maximum depth.
 *
 * @param {string} inputUrl - The input or current page within the tab also works for multiple links.
 * @returns {Promis<Array>} - The list of all the Urls for the page
 */
async function getLinks(inputUrl = currentPage) {
  // Temp storage of current urls
  tempUrls = new Set();

  // Get the html data for each page
  html = await getData(inputUrl);

  let parser = new DOMParser();
  let parsed = parser.parseFromString(html, "text/html");

  // Search for all the urls on the first given page
  for (const anchor of parsed.getElementsByTagName("a")) {
    let relative = anchor.getAttribute("href");
    let absoluteUrl = anchor.href;

    // Skip a bunch of unneeded links
    if (
      absoluteUrl.includes("mailto") ||
      absoluteUrl.includes("tel") ||
      absoluteUrl.includes("#") ||
      absoluteUrl.length === 0
    )
      continue;

    // Assure that the chrome-extension Urls are corrected to the absolute urls
    if (
      absoluteUrl.includes("chrome-extension://" + extId) ||
      absoluteUrl.includes("chrome-extension://")
    )
      absoluteUrl = getAbsolutePath(relative, inputUrl).href;

    // Make sure that there are no instances of URL in our program
    if (absoluteUrl instanceof URL) continue;

    // Make sure that no urls are already in the list
    if (!urlList.includes(absoluteUrl)) {
      // Note that the Url is being added to the list of Urls
      console.log("Adding to list: " + absoluteUrl);

      // Store the URLs
      tempUrls.add(absoluteUrl);
      urlList.push(absoluteUrl);
    }
  }
  return new Promise((resolve, reject) => {
    resolve(tempUrls);
  });
}