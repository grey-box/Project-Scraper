/**
 * FOCUS MODE
 * Uses Mozilla Readability to strip website clutter and injects the main article content into a clean offline template.
 */

/**
 * Uses Readability to extract main article text and injects it into the offline template.
 */

export async function applyFocusMode(htmlData, inputUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlData, "text/html");

  doc.querySelectorAll("a[href]").forEach((anchor) => {
    try {
      let rawHref = anchor.getAttribute("href");
      if (rawHref && !rawHref.startsWith("http") && !rawHref.startsWith("mailto:") && !rawHref.startsWith("tel:") && !rawHref.startsWith("#")) {
        let absoluteUrl = new URL(rawHref, inputUrl).href;
        anchor.setAttribute("href", absoluteUrl);
      }
    } catch (e) {}
  });

  doc.querySelectorAll("img[src], video[src], source[src]").forEach((media) => {
    try {
      let rawSrc = media.getAttribute("src");
      if (rawSrc && !rawSrc.startsWith("http") && !rawSrc.startsWith("data:")) {
        if (rawSrc.startsWith("//")) {
          media.setAttribute("src", "https:" + rawSrc);
        } else {
          let absoluteUrl = new URL(rawSrc, inputUrl).href;
          media.setAttribute("src", absoluteUrl);
        }
      }
    } catch (e) {}
  });

  const reader = new Readability(doc);
  const article = reader.parse();

  if (!article || !article.content) {
    console.warn("Focus Mode: Readability could not parse the page.. Saving original");
    return htmlData;
  }

  console.log("Successfully found the article content");

  const templateRes = await fetch("../html/template.html");
  let cleanHtml = await templateRes.text();

  const safeTitle = article.title || "Saved Page";
  const safeByline = article.byline ? `<div class="byline">${article.byline}</div>` : "";

  cleanHtml = cleanHtml.replace(/{{TITLE}}/g, safeTitle);
  cleanHtml = cleanHtml.replace("{{BYLINE}}", safeByline);
  cleanHtml = cleanHtml.replace("{{CONTENT}}", article.content);

  return cleanHtml;
}

/**
 * Parses a raw HTML string to extract valid links (specifically used for Focus Mode).
 */

export function extractLinksFromHtml(htmlData, rootPage, restrictDomain) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlData, "text/html");
  const links = [];

  for (const anchor of doc.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) continue;

    try {
      const absoluteUrl = new URL(href, rootPage).href;
      if (restrictDomain) {
        const startHost = new URL(rootPage).hostname;
        const linkHost = new URL(absoluteUrl).hostname;
        if (startHost !== linkHost) continue;
      }
      if (!links.includes(absoluteUrl)) {
        links.push(absoluteUrl);
      }
    } catch (e) {
      continue;
    }
  }
  return new Set(links);
}