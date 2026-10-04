/** Fired after drafts are created, published or deleted so the navbar badge refreshes immediately. */
export const DRAFTS_CHANGED_EVENT = 'drafts:changed';

export const notifyDraftsChanged = () => window.dispatchEvent(new Event(DRAFTS_CHANGED_EVENT));
