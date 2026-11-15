/**
 * Compatibility entry point for the `@fw/ui` alias.
 *
 * The Rotation Planner and Scenario Studio were written against a slightly different control API
 * (Tabs with `items`/`idBase`, Select/Slider with value callbacks, a `useToast().show()` helper).
 * This module re-exports the shared FarmWise UI and replaces only those names with thin adapters
 * built from the shared primitives, so those pages look and behave like the rest of the app
 * without rewriting working feature code. Everything else comes straight from `./index`.
 */
import { forwardRef, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useEffect } from 'react';
import { showToast, useToast as useToastState, TOAST_EVENT, type ToastType } from './toast';
import { Button as SharedButton, Select as SharedSelect, Slider as SharedSlider, ErrorState as SharedErrorState, ToastContainer } from './components';

export * from './index';

/* Button: the planner pages treat an unspecified variant as a secondary (outlined) button. */
export const Button = forwardRef<HTMLButtonElement, React.ComponentProps<typeof SharedButton>>(function Button(props, ref) {
  return <SharedButton ref={ref} variant="secondary" {...props} />;
});

/* Tabs */
export type TabItem = { id: string; label: string; disabled?: boolean };

export function Tabs({ items, value, onChange, ariaLabel, idBase }: {
  items: TabItem[]; value: string; onChange: (id: string) => void; ariaLabel: string; idBase: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const enabled = items.filter((i) => !i.disabled);
  const onKeyDown = (e: React.KeyboardEvent, id: string) => {
    const idx = enabled.findIndex((i) => i.id === id);
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % enabled.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + enabled.length) % enabled.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = enabled.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const target = enabled[next];
    if (!target) return;
    onChange(target.id);
    refs.current[target.id]?.focus();
  };
  return (
    <div className="fw-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => { refs.current[item.id] = el; }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel`}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            className={`fw-tabs__tab ${selected ? 'fw-tabs__tab--active' : ''}`}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => onKeyDown(e, item.id)}
          >
            <span className="fw-tabs__label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ idBase, activeId, children }: { idBase: string; activeId: string; children: ReactNode }) {
  return (
    <div id={`${idBase}-panel`} role="tabpanel" aria-labelledby={`${idBase}-tab-${activeId}`} className="fw-tab-panel">
      {children}
    </div>
  );
}

/* Select */
export function Select<T extends string>({ label, value, options, onChange, disabled, hideLabel }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean; hideLabel?: boolean;
}) {
  return (
    <div className={hideLabel ? 'fw-field--label-hidden' : undefined}>
      <SharedSelect
        label={label}
        value={value}
        disabled={disabled}
        options={options}
        onChange={(e) => onChange(e.target.value as T)}
      />
    </div>
  );
}

/* Slider */
export function Slider({ label, value, min, max, step = 1, onChange, formatValue, description, disabled, name }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
  formatValue?: (v: number) => string; description?: string; disabled?: boolean; name?: string;
}) {
  return (
    <div data-slider-name={name} aria-disabled={disabled || undefined} style={disabled ? { opacity: 0.6, pointerEvents: 'none' } : undefined}>
      <SharedSlider
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        formatValue={formatValue}
        hint={description}
      />
    </div>
  );
}

/* Toast */
type LegacyToast = { title: string; tone?: 'info' | 'success' | 'danger' };

/** Mounts a toast container that listens for the global toast event. The app shell mounts its own, so this is for isolated hosts and tests. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { toasts, addToast, dismiss } = useToastState();
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<{ message: string; type?: ToastType }>).detail;
      addToast(d.message, d.type);
    };
    document.addEventListener(TOAST_EVENT, handler);
    return () => document.removeEventListener(TOAST_EVENT, handler);
  }, [addToast]);
  return (
    <>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

/** Retry-style error state: the planner pages label the action "Retry". */
export function ErrorState(props: React.ComponentProps<typeof SharedErrorState>) {
  return <SharedErrorState retryLabel="Retry" {...props} />;
}

export function useToast() {
  const show = useCallback((t: LegacyToast) => {
    const type: ToastType = t.tone === 'danger' ? 'error' : (t.tone ?? 'info');
    showToast(t.title, type);
  }, []);
  return useMemo(() => ({ show }), [show]);
}
