/**
 * Toast state and the global toast API — Shaheem
 *   showToast('Saved', 'success')   // from anywhere
 * AppShell renders the toasts; features never mount their own container.
 */
import { useCallback, useState } from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  message: string;
  type?: ToastType;
}

export const TOAST_EVENT = 'fw:toast';

export function showToast(message: string, type: ToastType = 'info') {
  document.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, type } }));
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);
  const dismiss = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);
  return { toasts, addToast, dismiss };
}
