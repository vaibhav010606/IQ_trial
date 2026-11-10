/** Sets the portal ink (see body[data-portal] in index.css). */
export const setPortal = (portal) => {
  if (typeof document !== 'undefined') document.body.dataset.portal = portal;
};

/** First letters of the first two words, for the sidebar avatar. */
export const initials = (name = '') =>
  name.replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '·';
