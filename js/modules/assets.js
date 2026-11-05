/**
 * ASSET PROCESSING
 * Finds, downloads, and rewrites local paths for static assets
 * like CSS, JavaScript, images, and PDFs.
 */

import { state } from './state.js';


// ============================================================
// PACKAGE PATH HELPERS
// ============================================================

/**
 * Returns the configured assets root.
 *
 * Default:
 * assets
 */
function getAssetsFolder() {

  return (
    state.packageConfig?.folders?.assets ||
    "assets"
  );

}


/**
 * Returns one of the configured asset folders.
 *
 * Example:
 *
 * getAssetFolder("images")
 *
 * Default result:
 *
 * assets/images
 */
function getAssetFolder(type) {

  const assetsFolder =
    getAssetsFolder();


  const defaults = {

    images:
      "images",

    videos:
      "videos",

    documents:
      "documents",

    styles:
      "styles",

    scripts:
      "scripts"

  };


  const folderName =
    state.packageConfig?.folders?.[type] ||
    defaults[type] ||
    type;


  return (
    assetsFolder +
    "/" +
    folderName
  );

}


/**
 * Returns a relative asset path from
 * the current HTML page.
 *
 * Root pages live at ZIP root:
 *
 * assets/images/photo.jpg
 *
 * Depth 1 pages live inside pages/:
 *
 * ../assets/images/photo.jpg
 */
function getAssetReference(
  type,
  filename,
  isRootPage = false
) {

  const folder =
    getAssetFolder(type);


  const prefix =
    (
      state.maxDepthValue === 0 ||
      isRootPage
    )
      ? ""
      : "../";


  return (
    prefix +
    folder +
    "/" +
    filename
  );

}


/**
 * Returns a path from a CSS file
 * to an image.
 *
 * CSS files are stored in:
 *
 * assets/styles/
 *
 * Images are stored in:
 *
 * assets/images/
 *
 * Therefore CSS references:
 *
 * ../images/photo.jpg
 */
function getCssImageReference(
  imageName
) {

  const imageFolder =
    state.packageConfig?.folders?.images ||
    "images";


  return (
    "../" +
    imageFolder +
    "/" +
    imageName
  );

}


// ============================================================
// SKIPPABLE URL CHECK
// ============================================================

/**
 * Checks if a URL is a mailto, tel,
 * javascript, data URI, etc.
 */
export function isSkippableAssetUrl(
  url
) {

  if (
    !url ||
    typeof url !== "string"
  ) {

    return true;

  }


  return (

    url.startsWith("about:") ||

    url.startsWith("javascript:") ||

    url.startsWith("data:") ||

    url.startsWith("mailto:") ||

    url.startsWith("tel:")

  );

}


// ============================================================
// PAGE LINK REWRITING
// ============================================================

/**
 * Rewrites standard page anchors to point
 * to locally saved HTML files.
 */
export function rewritePageLinks(
  htmlData,
  inputUrl,
  savedPagesMap,
  isRootPage = false
) {

  const parser =
    new DOMParser();


  const doc =
    parser.parseFromString(
      htmlData,
      "text/html"
    );


  for (
    const anchor
    of doc.querySelectorAll(
      "a[href]"
    )
  ) {

    const href =
      anchor.getAttribute(
        "href"
      );


    if (
      !href ||

      href.startsWith("#") ||

      href.startsWith("mailto:") ||

      href.startsWith("tel:") ||

      href
        .toLowerCase()
        .endsWith(".pdf")
    ) {

      continue;

    }


    let absoluteUrl;


    try {

      absoluteUrl =
        new URL(
          href,
          inputUrl
        ).href;


    } catch (e) {

      continue;

    }


    if (
      savedPagesMap &&
      savedPagesMap.has(
        absoluteUrl
      )
    ) {

      const localFile =
        savedPagesMap.get(
          absoluteUrl
        );


      anchor.setAttribute(
        "href",
        isRootPage
          ? localFile
          : "../" + localFile
      );

    }

  }


  return (
    doc.documentElement.outerHTML
  );

}


// ============================================================
// CSS PROCESSING
// ============================================================

/**
 * Downloads external stylesheets
 * and processes inline <style> blocks.
 */
export async function processCSSAndImages(
  htmlData,
  inputUrl,
  isRootPage = false
) {

  const parser =
    new DOMParser();


  let doc =
    parser.parseFromString(
      htmlData,
      "text/html"
    );


  const stylesFolder =
    getAssetFolder(
      "styles"
    );


  for (
    let linkElement
    of doc.querySelectorAll(
      'link[rel="stylesheet"]'
    )
  ) {

    try {

      let cssHref =
        linkElement.getAttribute(
          "href"
        );


      if (
        !cssHref ||
        isSkippableAssetUrl(
          cssHref
        )
      ) {

        continue;

      }


      if (
        !cssHref.startsWith(
          "https://"
        ) &&
        !cssHref.startsWith(
          "http://"
        )
      ) {

        cssHref =
          getAbsolutePath(
            cssHref,
            inputUrl
          ).href;

      }


      if (
        state.urlCSSs.includes(
          cssHref
        )
      ) {

        continue;

      }


      state.urlCSSs.push(
        cssHref
      );


      const cssData =
        await getData(
          cssHref
        );


      if (
        cssData !== "Failed" &&
        cssData !== ""
      ) {

        const processedCSS =
          await processCSSImages(
            cssData,
            cssHref
          );


        const cssName =
          getTitle(
            cssHref
          ) + ".css";


        // Save CSS in configured folder.
        state.zip.file(

          stylesFolder +
            "/" +
            cssName,

          processedCSS

        );


        // Rewrite HTML stylesheet reference.
        linkElement.setAttribute(

          "href",

          getAssetReference(
            "styles",
            cssName,
            isRootPage
          )

        );

      }


    } catch (error) {

      console.error(
        "CSS processing error:",
        error
      );

    }

  }


  // ==========================================================
  // INLINE CSS
  // ==========================================================

  for (
    let styleElement
    of doc.querySelectorAll(
      "style"
    )
  ) {

    try {

      let processedStyleContent =
        await processCSSImages(
          styleElement.textContent,
          inputUrl
        );


      /*
       * processCSSImages normally returns
       * paths relative to an external CSS file.
       *
       * Inline CSS lives inside the HTML page,
       * so convert those image references back
       * into HTML-relative paths.
       */
      const imageFolderName =
        state.packageConfig?.folders?.images ||
        "images";


      const externalCssPrefix =
        "../" +
        imageFolderName +
        "/";


      const inlineImagePrefix =
        (
          state.maxDepthValue === 0 ||
          isRootPage
        )
          ? getAssetFolder("images") + "/"
          : "../" +
            getAssetFolder("images") +
            "/";


      processedStyleContent =
        processedStyleContent.split(
          externalCssPrefix
        ).join(
          inlineImagePrefix
        );


      styleElement.textContent =
        processedStyleContent;


    } catch (error) {

      console.error(
        "Inline CSS processing error:",
        error
      );

    }

  }


  return (
    doc.documentElement.outerHTML
  );

}


// ============================================================
// CSS IMAGE PROCESSING
// ============================================================

/**
 * Parses CSS text to download background
 * images and rewrite their paths.
 */
export async function processCSSImages(
  cssData,
  cssUrl
) {

  const imageUrlRegex =
    /url\(["']?([^"')]+)["']?\)/g;


  let downloadPromises =
    [];


  const updatedCSS =
    cssData.replace(

      imageUrlRegex,

      (
        match,
        imageUrl
      ) => {

        let resolvedUrl =
          imageUrl;


        if (
          imageUrl.startsWith(
            "//"
          )
        ) {

          resolvedUrl =
            "https:" +
            imageUrl;


        } else if (

          !imageUrl.startsWith(
            "https://"
          ) &&

          !imageUrl.startsWith(
            "http://"
          )

        ) {

          resolvedUrl =
            getAbsolutePath(
              imageUrl,
              cssUrl
            ).href;

        }


        /*
         * Ignore URLs we should not download.
         *
         * Fonts are still skipped for now.
         */
        if (

          isSkippableAssetUrl(
            resolvedUrl
          ) ||

          resolvedUrl.endsWith(
            ".woff"
          ) ||

          resolvedUrl.endsWith(
            ".woff2"
          ) ||

          resolvedUrl.endsWith(
            ".ttf"
          ) ||

          resolvedUrl.endsWith(
            ".otf"
          )

        ) {

          return match;

        }


        let imageName =
          resolvedUrl
            .substring(
              resolvedUrl.lastIndexOf("/") +
              1
            )
            .replace(
              /[&\/\\#,+()$~%'":*?<>{}]/g,
              ""
            );


        /*
         * Fallback in case the URL ends
         * without a useful filename.
         */
        if (!imageName) {

          imageName =
            getSafeFilename(
              resolvedUrl,
              "png"
            );

        }


        if (
          !state.urlImages.includes(
            imageName
          )
        ) {

          state.urlImages.push(
            imageName
          );


          const promise =
            urlToPromise(
              resolvedUrl
            )

              .then(
                (imageData) => {

                  state.zip.file(

                    getAssetFolder(
                      "images"
                    ) +
                      "/" +
                      imageName,

                    imageData,

                    {
                      binary:
                        true
                    }

                  );

                }
              )

              .catch(
                () =>
                  console.error(
                    `Error fetching image from: ${resolvedUrl}`
                  )
              );


          downloadPromises.push(
            promise
          );

        }


        /*
         * External CSS is located in:
         *
         * assets/styles/
         *
         * Therefore images are reached via:
         *
         * ../images/file.png
         *
         * If the user renamed images to
         * article-images:
         *
         * ../article-images/file.png
         */
        return (
          `url("${getCssImageReference(imageName)}")`
        );

      }

    );


  await Promise.all(
    downloadPromises
  );


  return updatedCSS;

}


// ============================================================
// PDF / DOCUMENT PROCESSING
// ============================================================

/**
 * Finds and downloads linked PDF documents.
 */
export async function processPdfs(
  htmlData,
  inputUrl,
  isRootPage = false
) {

  const parser =
    new DOMParser();


  let doc =
    parser.parseFromString(
      htmlData,
      "text/html"
    );


  const documentsFolder =
    getAssetFolder(
      "documents"
    );


  for (
    let anchorElement
    of doc.querySelectorAll(
      'a[href$=".pdf"]'
    )
  ) {

    try {

      let pdfHref =
        anchorElement.getAttribute(
          "href"
        );


      if (
        !pdfHref ||
        isSkippableAssetUrl(
          pdfHref
        )
      ) {

        continue;

      }


      if (
        !pdfHref.startsWith(
          "https://"
        ) &&
        !pdfHref.startsWith(
          "http://"
        )
      ) {

        pdfHref =
          getAbsolutePath(
            pdfHref,
            inputUrl
          ).href;

      }


      if (
        state.urlPdfs.includes(
          pdfHref
        )
      ) {

        continue;

      }


      state.urlPdfs.push(
        pdfHref
      );


      const pdfData =
        await getData(
          pdfHref
        );


      if (
        pdfData !== "Failed" &&
        pdfData !== ""
      ) {

        // Get safe filename.
        let baseName =
          getSafeFilename(
            pdfHref,
            "pdf"
          );


        let pdfName =
          baseName;


        let counter =
          2;


        /*
         * Ensure the document filename
         * is unique inside the configured
         * documents folder.
         */
        while (
          state.zip.file(
            documentsFolder +
              "/" +
              pdfName
          )
        ) {

          const nameWithoutExt =
            baseName.substring(
              0,
              baseName.lastIndexOf(
                "."
              )
            );


          pdfName =
            `${nameWithoutExt}_${counter}.pdf`;


          counter++;

        }


        // Save PDF.
        state.zip.file(

          documentsFolder +
            "/" +
            pdfName,

          pdfData,

          {
            binary:
              true
          }

        );


        // Rewrite HTML link.
        anchorElement.setAttribute(

          "href",

          getAssetReference(
            "documents",
            pdfName,
            isRootPage
          )

        );

      }


    } catch (error) {

      console.error(
        "PDF processing error:",
        error
      );

    }

  }


  return (
    doc.documentElement.outerHTML
  );

}


// ============================================================
// IMAGE PROCESSING
// ============================================================

/**
 * Downloads standard <img> elements and
 * updates their source to the configured
 * image folder.
 */
export async function processImages(
  htmlData,
  inputUrl,
  isRootPage = false
) {

  const parser =
    new DOMParser();


  let doc =
    parser.parseFromString(
      htmlData,
      "text/html"
    );


  const imagesFolder =
    getAssetFolder(
      "images"
    );


  /*
   * Explicitly create the image folder.
   */
  state.zip.folder(
    imagesFolder
  );


  const downloadPromises =
    [];


  for (
    let imgElement
    of doc.querySelectorAll(
      "img"
    )
  ) {

    try {

      /*
       * Remove responsive-image metadata
       * so the browser uses our local src.
       */
      imgElement.removeAttribute(
        "srcset"
      );


      imgElement.removeAttribute(
        "data-srcset"
      );


      imgElement.removeAttribute(
        "sizes"
      );


      let imgSrc =

        imgElement.getAttribute(
          "src"
        ) ||

        imgElement.getAttribute(
          "data-src"
        );


      if (
        !imgSrc ||
        imgSrc.includes(
          "base64"
        )
      ) {

        continue;

      }


      if (
        imgSrc.startsWith(
          "//"
        )
      ) {

        imgSrc =
          "https:" +
          imgSrc;


      } else if (

        !imgSrc.startsWith(
          "https://"
        ) &&

        !imgSrc.startsWith(
          "http://"
        )

      ) {

        imgSrc =
          new URL(
            imgSrc,
            inputUrl
          ).href;

      }


      let imageName =
        getSafeFilename(
          imgSrc,
          "png"
        );


      if (
        !state.urlImages.includes(
          imageName
        )
      ) {

        state.urlImages.push(
          imageName
        );


        const promise =
          urlToPromise(
            imgSrc
          )

            .then(
              (imageData) => {

                state.zip.file(

                  imagesFolder +
                    "/" +
                    imageName,

                  imageData,

                  {
                    binary:
                      true
                  }

                );

              }
            )

            .catch(
              (fetchErr) => {

                console.error(
                  "Download Failed:",
                  imgSrc,
                  fetchErr
                );

              }
            );


        downloadPromises.push(
          promise
        );

      }


      /*
       * Rewrite <img src>.
       *
       * Root:
       * assets/images/file.png
       *
       * Child:
       * ../assets/images/file.png
       */
      imgElement.setAttribute(

        "src",

        getAssetReference(
          "images",
          imageName,
          isRootPage
        )

      );


    } catch (error) {

      console.error(
        "Image loop error:",
        error
      );

    }

  }


  await Promise.all(
    downloadPromises
  );


  return (
    doc.documentElement.outerHTML
  );

}


// ============================================================
// JAVASCRIPT PROCESSING
// ============================================================

/**
 * Downloads external JavaScript files
 * and rewrites script tags.
 */
export async function processJss(
  htmlData,
  inputUrl,
  isRootPage = false
) {

  const parser =
    new DOMParser();


  let doc =
    parser.parseFromString(
      htmlData,
      "text/html"
    );


  const downloadPromises =
    [];


  const scriptsFolder =
    getAssetFolder(
      "scripts"
    );


  for (
    let scriptElement
    of doc.querySelectorAll(
      "script[src]"
    )
  ) {

    try {

      let scriptSrc =
        scriptElement.getAttribute(
          "src"
        );


      if (
        !scriptSrc ||
        isSkippableAssetUrl(
          scriptSrc
        )
      ) {

        continue;

      }


      if (
        !scriptSrc.startsWith(
          "https://"
        ) &&
        !scriptSrc.startsWith(
          "http://"
        )
      ) {

        scriptSrc =
          getAbsolutePath(
            scriptSrc,
            inputUrl
          ).href;

      }


      if (
        state.urlJSs.includes(
          scriptSrc
        )
      ) {

        continue;

      }


      state.urlJSs.push(
        scriptSrc
      );


      const jsName =
        getTitle(
          scriptSrc
        ) + ".js";


      const promise =
        getData(
          scriptSrc
        )

          .then(
            (jsData) => {

              if (
                jsData !== "Failed" &&
                jsData !== ""
              ) {

                state.zip.file(

                  scriptsFolder +
                    "/" +
                    jsName,

                  jsData

                );

              }

            }
          )

          .catch(
            (error) =>
              console.error(
                "JS processing error:",
                error
              )
          );


      downloadPromises.push(
        promise
      );


      /*
       * Rewrite script source.
       */
      scriptElement.setAttribute(

        "src",

        getAssetReference(
          "scripts",
          jsName,
          isRootPage
        )

      );


    } catch (error) {

      console.error(
        "JS loop error:",
        error
      );

    }

  }


  await Promise.all(
    downloadPromises
  );


  return (
    doc.documentElement.outerHTML
  );

}


// ============================================================
// SAFE FILENAME
// ============================================================

/**
 * Strips invalid filesystem characters
 * from a URL to generate a safe local filename.
 */
export function getSafeFilename(
  url,
  defaultExt = "file"
) {

  let cleanUrl =
    String(
      url || ""
    )
      .split("?")[0]
      .split("#")[0];


  let filename =
    cleanUrl.substring(
      cleanUrl.lastIndexOf("/") +
      1
    );


  filename =
    filename.replace(
      /[^a-zA-Z0-9.\-_]/g,
      ""
    );


  if (
    filename.length >
    100
  ) {

    filename =
      filename.substring(
        filename.length -
        100
      );

  }


  if (!filename) {

    filename =
      "asset_" +
      Math.floor(
        Math.random() *
        100000
      ) +
      "." +
      defaultExt;

  }


  return filename;

}