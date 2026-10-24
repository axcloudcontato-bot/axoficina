// Native controls keep their browser behavior. These helpers are only used
// for composite controls and for restoring focus after an overlay closes.
export const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function focusableElements(container: ParentNode): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.tabIndex < 0 || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    for (let current: HTMLElement | null = element; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return true;
  });
}

export function restoreFocus(element: HTMLElement | null) {
  const target = element?.isConnected && !element.closest('[inert], [hidden]') && !element.matches(':disabled')
    ? element : document.getElementById('main-content');
  target?.focus({ preventScroll: true });
}

export function isTextInput(element: EventTarget | null) {
  return element instanceof HTMLElement && Boolean(element.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]'));
}
