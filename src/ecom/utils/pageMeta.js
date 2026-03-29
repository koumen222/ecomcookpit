function ensureMetaTag(selector, attrName, attrValue) {
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attrName, attrValue);
    document.head.appendChild(tag);
  }
  return tag;
}

function ensureLinkTag(selector, rel) {
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', rel);
    document.head.appendChild(tag);
  }
  return tag;
}

function normalizeUrl(value) {
  if (!value) return '';
  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return String(value);
  }
}

function normalizeText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function setDocumentMeta({
  title,
  description,
  image,
  url,
  type = 'website',
  siteName,
  appTitle,
  icon,
}) {
  if (typeof document === 'undefined') return;

  const resolvedTitle = normalizeText(title || document.title || 'Scalor') || 'Scalor';
  const resolvedDescription = normalizeText(description || '');
  const resolvedImage = normalizeUrl(image);
  const resolvedUrl = normalizeUrl(url || window.location.href);
  const resolvedSiteName = normalizeText(siteName || 'Scalor') || 'Scalor';
  const resolvedAppTitle = normalizeText(appTitle || resolvedSiteName || resolvedTitle) || 'Scalor';
  const resolvedIcon = normalizeUrl(icon);

  document.title = resolvedTitle;

  ensureMetaTag('meta[name="description"]', 'name', 'description').setAttribute('content', resolvedDescription);
  ensureMetaTag('meta[property="og:title"]', 'property', 'og:title').setAttribute('content', resolvedTitle);
  ensureMetaTag('meta[property="og:description"]', 'property', 'og:description').setAttribute('content', resolvedDescription);
  ensureMetaTag('meta[property="og:type"]', 'property', 'og:type').setAttribute('content', type);
  ensureMetaTag('meta[property="og:url"]', 'property', 'og:url').setAttribute('content', resolvedUrl);
  ensureMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name').setAttribute('content', resolvedSiteName);
  ensureMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card').setAttribute('content', resolvedImage ? 'summary_large_image' : 'summary');
  ensureMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title').setAttribute('content', resolvedTitle);
  ensureMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description').setAttribute('content', resolvedDescription);
  ensureMetaTag('meta[name="apple-mobile-web-app-title"]', 'name', 'apple-mobile-web-app-title').setAttribute('content', resolvedAppTitle);

  if (resolvedImage) {
    ensureMetaTag('meta[property="og:image"]', 'property', 'og:image').setAttribute('content', resolvedImage);
    ensureMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image').setAttribute('content', resolvedImage);
  }

  if (resolvedIcon) {
    ensureLinkTag('link[rel="icon"]', 'icon').setAttribute('href', resolvedIcon);
    ensureLinkTag('link[rel="apple-touch-icon"]', 'apple-touch-icon').setAttribute('href', resolvedIcon);
  }
}
