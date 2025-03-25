/**
 * Asynchronous function to fetch data (like HTML, CSS, or image blobs) from a specified URL.
 * @param {string} url - The URL to fetch the data from.
 * @returns {Promise<string>} - A promise that resolves to the fetched data or error if the fetch operation fails.
 */
let getData = async (url) => {
  let result = "";
  try {
    if(checkUrl(url)){
      result = await $.get(url);
    } else {
      result = "URL is not accessible";
    }
  } catch (error) {
    console.error("Error:", error);
  }
  return new Promise((resolve, reject) => {
    resolve(result);
  });
};

/**
 * Asynchronous function to check if a URL is accessible.
 * @param {string} url - The URL to be checked.
 * @returns {Promise<boolean>} - A promise that resolves to true if the URL is accessible and false otherwise.
 */
let checkUrl = async (url) => {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
};

/**
 * This function receives a URL and formats it to comply with file system naming conventions.
 * It is utilized for naming HTML files, CSS files, and image files.
 * @param {string} url - The URL to be formatted.
 * @returns {string} - The formatted URL string.
 */
function getTitle(url) {
  url = url.toString();
  url = url.substring(url.indexOf("://") + 3); // Removes protocol dynamically
  // If the URL is longer than 70 characters, only the last 70 characters are used.
  if (url.length >= 70) url = url.substring(url.length - 70);
  // Replacing all non-alphanumeric characters with underscores to prevent file naming issues.
  url = url.replace(/[^a-zA-Z0-9 ]/g, "_");
  return url;
}


/**
 * Retrieves the binary content of a file from a URL. This function is used to fetch image files
 * from external URLs and convert them into a format suitable for adding to a zip archive.
 *
 * @param {string} url - The URL from which to fetch binary content.
 * @returns {Promise<Uint8Array|string>} - A promise that resolves with the binary content or rejects with an error message.
 */
function urlToPromise(url) {
  return new Promise((resolve, reject) => {
      JSZipUtils.getBinaryContent(url, (err, data) => {
          if (err) {
              console.error(`Failed to fetch content from URL: ${url} - Error: ${err.message}`);
              reject(`Failed To Fetch Content from ${url}`);
          } else {
              resolve(data);
          }
      });
  });
}

/**
 * This function combines a relative path with a base URL to get the absolute URL.
 * @param {string} relPath - The relative path.
 * @param {string} baseUrl - The base URL.
 * @returns {URL} - The concatenated URL object.
 */
function getAbsolutePath(relPath, baseUrl) {
  // Creating a new URL object by concatenating the relative path with the base URL.
  return new URL(relPath, baseUrl);
}

/**
 * This function checks if a URL is a duplicate within a given list.
 * @param {string} url - The URL to be checked.
 * @param {Array} listUrl - The list of URLs to check against.
 * @returns {boolean} - Returns true if the URL is found in the list, false otherwise.
 */
function checkDuplicate(url, listUrl) {
  if (typeof listUrl.some !== "function") return false;
  return listUrl.some((item) => item.url === url);
}


