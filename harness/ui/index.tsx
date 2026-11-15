// HARNESS stand-in for Shaheem's src/ui (PRD §3/§5). Public names follow the PRD export list:
// Button, IconButton, Card, Badge, Tabs, Slider, Select, Dialog, Drawer, Tooltip, Toast,
// Skeleton, EmptyState, ErrorState, ChartFrame. Feature code must import these via "@fw/ui".
// At integration, "@fw/ui" is re-pointed to src/ui; any prop mismatch is listed in harness/README.md.
import {
  createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState,
  type ButtonHTMLAttributes, type HTMLAttributes, type KeyboardEvent, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { SourceKind } from "@fw/contracts";
import "./ui.css";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ---------------------------------- Button --------------------------------- */
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "sm";
  loading?: boolean;
};
export function Button({ variant = "secondary", size = "md", loading, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx("fw-btn", `fw-btn--${variant}`, size === "sm" && "fw-btn--sm", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="fw-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className={cx("fw-iconbtn", className)} {...rest}>
      {children}
    </button>
  );
}

export const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
);

/* ----------------------------------- Card ---------------------------------- */
export function Card({ className, selected, children, ...rest }: HTMLAttributes<HTMLElement> & { selected?: boolean }) {
  return <section className={cx("fw-card", selected && "fw-card--selected", className)} {...rest}>{children}</section>;
}

/* ---------------------------------- Badge ---------------------------------- */
export type BadgeTone = "neutral" | "info" | "success" | "warn" | "danger" | "estimate";
export function Badge({ tone = "neutral", children, className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={cx("fw-badge", `fw-badge--${tone}`, className)} {...rest}>{children}</span>;
}

export const SOURCE_LABEL: Record<SourceKind, string> = {
  NASA_OBSERVED: "NASA observed",
  NASA_OFFLINE_SNAPSHOT: "NASA offline snapshot",
  SIMULATED_IOT: "Simulated sensor",
  FARMER_REPORTED: "Farmer input",
  USER_SOIL_TEST: "Farmer soil test",
  DEMO_IMAGE: "Demo example",
  MODEL_ESTIMATE: "Model estimate",
};
const SOURCE_TONE: Record<SourceKind, BadgeTone> = {
  NASA_OBSERVED: "info", NASA_OFFLINE_SNAPSHOT: "info", SIMULATED_IOT: "warn",
  FARMER_REPORTED: "success", USER_SOIL_TEST: "success", DEMO_IMAGE: "neutral", MODEL_ESTIMATE: "estimate",
};
/** Provenance label required next to every displayed number (PRD §4). */
export function SourceBadge({ source, className }: { source: SourceKind; className?: string }) {
  return <Badge tone={SOURCE_TONE[source]} className={className} data-source={source}>{SOURCE_LABEL[source]}</Badge>;
}

/* ----------------------------------- Tabs ---------------------------------- */
export type TabItem = { id: string; label: string; disabled?: boolean };
export function Tabs({ items, value, onChange, ariaLabel, idBase }: {
  items: TabItem[]; value: string; onChange: (id: string) => void; ariaLabel: string; idBase: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const enabled = items.filter((t) => !t.disabled);
  const onKey = (e: KeyboardEvent) => {
    const i = enabled.findIndex((t) => t.id === value);
    let next: TabItem | undefined;
    if (e.key === "ArrowRight") next = enabled[(i + 1) % enabled.length];
    else if (e.key === "ArrowLeft") next = enabled[(i - 1 + enabled.length) % enabled.length];
    else if (e.key === "Home") next = enabled[0];
    else if (e.key === "End") next = enabled[enabled.length - 1];
    if (next) { e.preventDefault(); onChange(next.id); refs.current[next.id]?.focus(); }
  };
  return (
    <div role="tablist" aria-label={ariaLabel} className="fw-tabs">
      {items.map((t) => (
        <button
          key={t.id}
          ref={(el) => { refs.current[t.id] = el; }}
          role="tab"
          type="button"
          id={`${idBase}-tab-${t.id}`}
          aria-selected={value === t.id}
          aria-controls={`${idBase}-panel`}
          tabIndex={value === t.id ? 0 : -1}
          disabled={t.disabled}
          className={cx("fw-tab", value === t.id && "fw-tab--active")}
          onClick={() => onChange(t.id)}
          onKeyDown={onKey}
        >{t.label}</button>
      ))}
    </div>
  );
}
export function TabPanel({ idBase, activeId, children }: { idBase: string; activeId: string; children: ReactNode }) {
  return <div role="tabpanel" id={`${idBase}-panel`} aria-labelledby={`${idBase}-tab-${activeId}`} tabIndex={0} className="fw-tabpanel">{children}</div>;
}

/* ---------------------------------- Slider --------------------------------- */
export function Slider({ label, value, min, max, step = 1, onChange, formatValue, description, disabled, name }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
  formatValue?: (v: number) => string; description?: string; disabled?: boolean; name?: string;
}) {
  const id = useId();
  const text = formatValue ? formatValue(value) : String(value);
  return (
    <div className={cx("fw-slider", disabled && "fw-slider--disabled")}>
      <div className="fw-slider__head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="fw-slider__value">{text}</output>
      </div>
      <input
        id={id} name={name} type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        aria-valuetext={text} aria-describedby={description ? `${id}-d` : undefined}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {description ? <p id={`${id}-d`} className="fw-slider__desc">{description}</p> : null}
    </div>
  );
}

/* ---------------------------------- Select --------------------------------- */
export function Select<T extends string>({ label, value, options, onChange, disabled, hideLabel }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean; hideLabel?: boolean;
}) {
  const id = useId();
  return (
    <div className="fw-field">
      <label htmlFor={id} className={hideLabel ? "fw-sr-only" : "fw-field__label"}>{label}</label>
      <select id={id} className="fw-select" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/* --------------------------------- Overlays -------------------------------- */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
let scrollLocks = 0;
function useOverlay(open: boolean, onClose: () => void, panel: React.RefObject<HTMLDivElement | null>) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useLayoutEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    scrollLocks += 1;
    document.body.style.overflow = "hidden";
    const node = panel.current;
    const first = node?.querySelector<HTMLElement>("[data-autofocus]") ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== "Tab" || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) { e.preventDefault(); node.focus(); return; }
      const firstEl = items[0], lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      scrollLocks -= 1;
      if (scrollLocks <= 0) { scrollLocks = 0; document.body.style.overflow = ""; }
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, [open, panel]);
}

type OverlayProps = { open: boolean; onClose: () => void; title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode; size?: "md" | "lg" | "xl" };

export function Dialog({ open, onClose, title, description, children, footer, size = "md" }: OverlayProps) {
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  useOverlay(open, onClose, panel);
  if (!open) return null;
  return createPortal(
    <div className="fw-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={description ? `${id}-d` : undefined}
        tabIndex={-1} className={cx("fw-dialog", `fw-dialog--${size}`)}>
        <div className="fw-overlay__head">
          <div>
            <h2 id={`${id}-t`}>{title}</h2>
            {description ? <div id={`${id}-d`} className="fw-muted">{description}</div> : null}
          </div>
          <IconButton label="Close" onClick={onClose}><CloseIcon /></IconButton>
        </div>
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region must be keyboard-reachable (axe scrollable-region-focusable) */}
        <div className="fw-overlay__body" role="region" aria-label={`${title} content`} tabIndex={0}>{children}</div>
        {footer ? <div className="fw-overlay__foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, description, children, footer }: OverlayProps) {
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  useOverlay(open, onClose, panel);
  if (!open) return null;
  return createPortal(
    <div className="fw-backdrop fw-backdrop--drawer" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} tabIndex={-1} className="fw-drawer">
        <div className="fw-overlay__head">
          <div>
            <h2 id={`${id}-t`}>{title}</h2>
            {description ? <div className="fw-muted">{description}</div> : null}
          </div>
          <IconButton label="Close" onClick={onClose}><CloseIcon /></IconButton>
        </div>
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region must be keyboard-reachable (axe scrollable-region-focusable) */}
        <div className="fw-overlay__body" role="region" aria-label={`${title} content`} tabIndex={0}>{children}</div>
        {footer ? <div className="fw-overlay__foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/* --------------------------------- Tooltip --------------------------------- */
export function Tooltip({ content, children }: { content: ReactNode; children: (props: { "aria-describedby": string | undefined; onMouseEnter: () => void; onMouseLeave: () => void; onFocus: () => void; onBlur: () => void }) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const k = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open]);
  return (
    <span className="fw-tooltip-wrap">
      {children({ "aria-describedby": open ? id : undefined, onMouseEnter: () => setOpen(true), onMouseLeave: () => setOpen(false), onFocus: () => setOpen(true), onBlur: () => setOpen(false) })}
      {open ? <span role="tooltip" id={id} className="fw-tooltip">{content}</span> : null}
    </span>
  );
}

/* ---------------------------------- Toast ---------------------------------- */
type ToastMsg = { id: number; title: string; tone?: "info" | "success" | "danger" };
const ToastCtx = createContext<{ show: (t: Omit<ToastMsg, "id">) => void } | null>(null);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastMsg[]>([]);
  const show = useCallback((t: Omit<ToastMsg, "id">) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { ...t, id }]);
    window.setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div className="fw-toasts" role="status" aria-live="polite">
        {items.map((t) => <div key={t.id} className={cx("fw-toast", t.tone && `fw-toast--${t.tone}`)}>{t.title}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

/* ----------------------------- States & charts ----------------------------- */
export function Skeleton({ height = 16, width = "100%", label = "Loading" }: { height?: number; width?: number | string; label?: string }) {
  return <div className="fw-skeleton" style={{ height, width }} role="status" aria-label={label} />;
}
export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return <div className="fw-state"><h2>{title}</h2>{body ? <p className="fw-muted">{body}</p> : null}{action}</div>;
}
export function ErrorState({ title, body, onRetry }: { title: string; body?: ReactNode; onRetry?: () => void }) {
  return (
    <div className="fw-state fw-state--error" role="alert">
      <h2>{title}</h2>{body ? <p>{body}</p> : null}
      {onRetry ? <Button variant="primary" onClick={onRetry}>Retry</Button> : null}
    </div>
  );
}
/** Wrapper for every chart: title, source/estimate labels, keyboard/screen-reader summary. */
export function ChartFrame({ title, sources, summary, children, legend }: { title: string; sources: SourceKind[]; summary: string; children: ReactNode; legend?: ReactNode }) {
  const id = useId();
  return (
    <figure className="fw-chart" aria-labelledby={`${id}-t`} aria-describedby={`${id}-s`}>
      <figcaption className="fw-chart__head">
        <h3 id={`${id}-t`}>{title}</h3>
        <span className="fw-chart__sources">{sources.map((s) => <SourceBadge key={s} source={s} />)}</span>
      </figcaption>
      {legend ? <div className="fw-chart__legend">{legend}</div> : null}
      <div className="fw-chart__body">{children}</div>
      <p id={`${id}-s`} className="fw-chart__summary">{summary}</p>
    </figure>
  );
}
