/**
 * Overlay behaviour shared by Dialog, Drawer, Popover, Tooltip and the mobile menu — Shaheem
 *
 *  - useEscapeLayer: one Escape stack; Escape closes only the topmost open layer
 *  - useFocusTrap:   Tab / Shift+Tab wrap inside a container; stray focus is pulled back in
 *  - useScrollLock:  stops the page behind an overlay from scrolling (nested locks counted)
 */
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

type Layer = { id: number; close: () => void };
const layerStack: Layer[] = [];
let layerSeq = 0;
let escapeListenerInstalled = false;

function installEscapeListener() {
  if (escapeListenerInstalled || typeof document === 'undefined') return;
  escapeListenerInstalled = true;
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || layerStack.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    layerStack[layerStack.length - 1].close();
  }, true);
}

/** Registers an open layer so Escape closes it when it is topmost. */
export function useEscapeLayer(active: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    if (!active) return;
    installEscapeListener();
    const layer: Layer = { id: ++layerSeq, close: () => closeRef.current() };
    layerStack.push(layer);
    return () => {
      const i = layerStack.findIndex(l => l.id === layer.id);
      if (i >= 0) layerStack.splice(i, 1);
    };
  }, [active]);
}

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
  'summary',
].join(',');

/** Visible, enabled, non-inert focusable descendants in DOM order. */
export function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => {
    if (el.closest('[inert]')) return false;
    const style = window.getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
  });
}

/** Installs Tab wrapping on `root`. Returns a cleanup function. */
export function trapFocus(root: HTMLElement): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const items = getFocusable(root);
    if (items.length === 0) { e.preventDefault(); root.focus(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    const current = document.activeElement as HTMLElement | null;
    const inside = current ? root.contains(current) : false;
    if (e.shiftKey && (current === first || !inside)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (current === last || !inside)) { e.preventDefault(); first.focus(); }
  };
  const onFocusIn = (e: FocusEvent) => {
    if (root.isConnected && e.target instanceof Node && !root.contains(e.target)) {
      (getFocusable(root)[0] ?? root).focus();
    }
  };
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('focusin', onFocusIn);
  return () => {
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('focusin', onFocusIn);
  };
}

/** Keeps Tab and Shift+Tab inside `ref` while active. */
export function useFocusTrap(ref: RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    return trapFocus(ref.current);
  }, [ref, active]);
}

let scrollLocks = 0;
let savedOverflow = '';

/** Prevents the page behind an overlay from scrolling. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (scrollLocks === 0) { savedOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    scrollLocks++;
    return () => {
      scrollLocks--;
      if (scrollLocks === 0) document.body.style.overflow = savedOverflow;
    };
  }, [active]);
}
