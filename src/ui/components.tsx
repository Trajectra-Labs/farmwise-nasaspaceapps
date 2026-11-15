/**
 * FarmWise Shared UI Components — Shaheem
 *
 * Single source of truth for reusable UI. Feature code imports from '@/ui'.
 * Visual values come from src/styles/tokens.css; do not hard-code sizes here.
 *
 * Overlay behaviour (Dialog, Drawer, Popover, Tooltip, mobile navigation):
 *  - one Escape stack: Escape closes only the topmost open layer
 *  - modal layers use the native <dialog> element (showModal), which makes the
 *    rest of the page inert and renders in the browser top layer
 *  - Tab / Shift+Tab wrap inside modal layers
 *  - focus returns to the element that opened the layer
 */
import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  X, ChevronDown, TriangleAlert, Inbox, Info, CircleCheck, CircleAlert, CircleX, ChevronRight,
} from 'lucide-react';
import type { SourceKind } from '@/contracts/farmwise';
import { useEscapeLayer, useScrollLock, getFocusable, trapFocus } from './overlay';
import { SOURCE_LABELS } from './sources';
import type { ToastMessage } from './toast';
import './components.css';

/* ════════════════════════════════════════════════════════════
   Icons
   ════════════════════════════════════════════════════════════ */

const ICON_SIZE = { sm: 18, md: 20, lg: 24 } as const;

/** Renders a lucide icon at a token size. Decorative unless `label` is given. */
export function Icon({ icon: Glyph, size = 'md', label, className = '' }: {
  icon: LucideIcon;
  size?: keyof typeof ICON_SIZE;
  label?: string;
  className?: string;
}) {
  return (
    <Glyph
      size={ICON_SIZE[size]}
      strokeWidth={1.75}
      className={`fw-icon ${className}`}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
    />
  );
}

/* ════════════════════════════════════════════════════════════
   Modal surface (overlay hooks live in ./overlay)
   ════════════════════════════════════════════════════════════ */

/**
 * Shared modal surface used by Dialog and Drawer. Mounted only while open.
 */
function ModalSurface({ onClose, labelledBy, variant, children }: {
  onClose: () => void;
  labelledBy: string;
  variant: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; });

  useEscapeLayer(true, onClose);
  useScrollLock(true);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    try {
      if (!dialog.open) dialog.showModal();
    } catch {
      dialog.setAttribute('open', '');
    }
    const firstField = dialog.querySelector<HTMLElement>('[data-autofocus]');
    (firstField ?? getFocusable(dialog)[0] ?? dialog).focus();

    // Focus trap lives in this effect so its listeners are removed *before* focus is restored.
    const releaseTrap = trapFocus(dialog);
    // The browser may close the dialog itself (e.g. repeated Escape); keep React in sync.
    const onNativeClose = () => closeRef.current();
    const onCancel = (e: Event) => { e.preventDefault(); closeRef.current(); };
    dialog.addEventListener('close', onNativeClose);
    dialog.addEventListener('cancel', onCancel);
    return () => {
      releaseTrap();
      dialog.removeEventListener('close', onNativeClose);
      dialog.removeEventListener('cancel', onCancel);
      if (dialog.open) { try { dialog.close(); } catch { dialog.removeAttribute('open'); } }
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`fw-modal fw-modal--${variant}`}
      aria-labelledby={labelledBy}
      aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </dialog>
  );
}

/* ════════════════════════════════════════════════════════════
   Buttons
   ════════════════════════════════════════════════════════════ */

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = 'primary', size = 'md', loading, icon, iconPosition = 'left', fullWidth,
  children, disabled, className = '', type = 'button', ...rest
}, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={`fw-btn fw-btn--${variant} fw-btn--${size} ${fullWidth ? 'fw-btn--full' : ''} ${loading ? 'fw-btn--loading' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="fw-btn__spinner" aria-hidden="true" />}
      {icon && iconPosition === 'left' && <span className="fw-btn__icon">{icon}</span>}
      {children !== undefined && children !== null && <span className="fw-btn__label">{children}</span>}
      {icon && iconPosition === 'right' && <span className="fw-btn__icon">{icon}</span>}
    </button>
  );
});

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'secondary';
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, size = 'md', variant = 'ghost', children, className = '', type = 'button', ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={`fw-icon-btn fw-icon-btn--${size} fw-icon-btn--${variant} ${className}`}
        aria-label={label}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

/* ════════════════════════════════════════════════════════════
   Surfaces
   ════════════════════════════════════════════════════════════ */

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick' | 'title'> {
  children?: React.ReactNode;
  /** Optional heading rendered at the top of the card (shortcut for CardHeader). */
  title?: string;
  headingLevel?: 2 | 3 | 4;
  /** Marks a selectable card as the current choice. */
  selected?: boolean;
  className?: string;
  onClick?: () => void;
  padding?: 'default' | 'compact' | 'none';
  tone?: 'default' | 'accent' | 'muted';
  'aria-pressed'?: boolean;
}

export function Card({ children, className = '', onClick, onKeyDown, padding = 'default', tone = 'default', title, headingLevel = 3, selected, ...rest }: CardProps) {
  // Clickable cards act as buttons: Enter/Space activate them unless the caller handles keys itself.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || !onClick || e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };
  // A labelled card is a landmark region for assistive technology; unlabelled ones stay plain blocks.
  const Tag = title || rest['aria-labelledby'] || rest['aria-label'] ? 'section' : 'div';
  return (
    <Tag
      className={`fw-card fw-card--pad-${padding} fw-card--${tone} ${onClick ? 'fw-card--clickable' : ''} ${selected ? 'fw-card--selected' : ''} ${className}`}
      onClick={onClick}
      onKeyDown={onClick || onKeyDown ? handleKeyDown : undefined}
      {...rest}
    >
      {title && <CardHeader title={title} as={`h${headingLevel}` as 'h2' | 'h3' | 'h4'} />}
      {children}
    </Tag>
  );
}

/** Title row for a card: optional icon, title, subtitle and right-aligned actions. */
export function CardHeader({ title, subtitle, icon, actions, as: Heading = 'h3', id }: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  as?: 'h2' | 'h3' | 'h4';
  id?: string;
}) {
  return (
    <div className="fw-card-header">
      <div className="fw-card-header__text">
        <Heading className="fw-card-header__title fw-card-title" id={id}>
          {icon && <Icon icon={icon} className="fw-card-header__icon" />}
          <span>{title}</span>
        </Heading>
        {subtitle && <p className="fw-card-header__subtitle fw-meta">{subtitle}</p>}
      </div>
      {actions && <div className="fw-card-header__actions">{actions}</div>}
    </div>
  );
}

/** Labelled value: KPI or observation. Shows "Unknown" for missing values. */
export function Stat({ label, value, unit, caption, source, size = 'md', tone = 'default' }: {
  label: React.ReactNode;
  value: React.ReactNode | null | undefined;
  unit?: string;
  caption?: React.ReactNode;
  source?: SourceKind;
  size?: 'md' | 'lg' | 'xl';
  tone?: 'default' | 'warning';
}) {
  const missing = value === null || value === undefined || value === '';
  return (
    <div className={`fw-stat fw-stat--${size} fw-stat--${tone}`}>
      <span className="fw-stat__label">{label}</span>
      <span className="fw-stat__value">
        {missing ? <span className="fw-stat__unknown">Unknown</span> : value}
        {!missing && unit && <span className="fw-stat__unit">{unit}</span>}
      </span>
      {(caption || source) && (
        <span className="fw-stat__caption">
          {source && <SourceBadge source={source} />}
          {caption && <span>{caption}</span>}
        </span>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Badges
   ════════════════════════════════════════════════════════════ */

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'nasa' | 'simulated' | 'user' | 'estimate';
const TONE_TO_VARIANT: Record<string, BadgeVariant> = {
  neutral: 'default', info: 'info', success: 'success', warn: 'warning', danger: 'error', estimate: 'estimate',
};

/**
 * Small status label. Accepts the shared `variant`, a feature-level `tone`
 * (neutral | info | success | warn | danger | estimate), a plain `label`, or a data `source`.
 */
export function Badge({ children, variant, tone, label, source, className = '', ...rest }: {
  children?: React.ReactNode;
  variant?: BadgeVariant;
  tone?: 'neutral' | 'info' | 'success' | 'warn' | 'danger' | 'estimate';
  label?: string;
  source?: SourceKind;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>) {
  if (source) {
    const meta = SOURCE_LABELS[source] ?? { label: source, variant: 'default' as const };
    return <span className={`fw-badge fw-badge--${meta.variant} ${className}`} data-source={source} {...rest}>{children ?? meta.label}</span>;
  }
  const resolved: BadgeVariant = variant ?? (tone ? TONE_TO_VARIANT[tone] ?? 'default' : 'default');
  return <span className={`fw-badge fw-badge--${resolved} ${className}`} {...rest}>{children ?? label}</span>;
}

export function SourceBadge({ source }: { source: SourceKind }) {
  const { label, variant } = SOURCE_LABELS[source] ?? { label: source, variant: 'default' as const };
  return <Badge variant={variant} data-source={source}>{label}</Badge>;
}

export function ConfidenceBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const variant = level === 'high' ? 'success' : level === 'medium' ? 'info' : 'warning';
  return <Badge variant={variant}>{level.charAt(0).toUpperCase() + level.slice(1)} confidence</Badge>;
}

/* ════════════════════════════════════════════════════════════
   Form controls
   ════════════════════════════════════════════════════════════ */

function FieldMessage({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error) {
    return (
      <span id={`${id}-error`} className="fw-field__error" role="alert">
        <Icon icon={CircleAlert} size="sm" />
        {error}
      </span>
    );
  }
  if (hint) return <span id={`${id}-hint`} className="fw-field__hint">{hint}</span>;
  return null;
}

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, id, className = '', ...rest }: TextFieldProps) {
  const auto = useId();
  const fieldId = id ?? `field${auto.replace(/:/g, '')}`;
  return (
    <div className={`fw-field ${error ? 'fw-field--error' : ''} ${className}`}>
      {label && <label className="fw-field__label" htmlFor={fieldId}>{label}</label>}
      <input
        id={fieldId}
        className="fw-field__control"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        aria-label={label ? undefined : rest.placeholder}
        {...rest}
      />
      <FieldMessage id={fieldId} error={error} hint={hint} />
    </div>
  );
}

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextArea({ label, error, hint, id, className = '', ...rest }: TextAreaProps) {
  const auto = useId();
  const fieldId = id ?? `field${auto.replace(/:/g, '')}`;
  return (
    <div className={`fw-field ${error ? 'fw-field--error' : ''} ${className}`}>
      {label && <label className="fw-field__label" htmlFor={fieldId}>{label}</label>}
      <textarea
        id={fieldId}
        className="fw-field__control fw-field__control--textarea"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        aria-label={label ? undefined : (rest.placeholder ?? 'Notes')}
        {...rest}
      />
      <FieldMessage id={fieldId} error={error} hint={hint} />
    </div>
  );
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, hint, options, id, className = '', ...rest }: SelectProps) {
  const auto = useId();
  const fieldId = id ?? `select${auto.replace(/:/g, '')}`;
  return (
    <div className={`fw-field ${error ? 'fw-field--error' : ''} ${className}`}>
      <label className="fw-field__label" htmlFor={fieldId}>{label}</label>
      <div className="fw-select">
        <select
          id={fieldId}
          className="fw-field__control fw-select__control"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          {...rest}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Icon icon={ChevronDown} size="sm" className="fw-select__chevron" />
      </div>
      <FieldMessage id={fieldId} error={error} hint={hint} />
    </div>
  );
}

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  formatValue?: (v: number) => string;
  hint?: string;
}

export function Slider({ label, value, min, max, step = 1, unit = '', onChange, formatValue, hint }: SliderProps) {
  const auto = useId();
  const id = `slider${auto.replace(/:/g, '')}`;
  const display = formatValue ? formatValue(value) : `${value > 0 ? '+' : ''}${value}${unit}`;
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <div className="fw-slider">
      <div className="fw-slider__header">
        <label className="fw-slider__label" htmlFor={id}>{label}</label>
        <output className="fw-slider__value" htmlFor={id} aria-live="polite">{display}</output>
      </div>
      <input
        id={id} type="range" className="fw-slider__input"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        aria-valuetext={display}
        aria-describedby={hint ? `${id}-hint` : undefined}
        style={{ '--val': `${pct}%` } as React.CSSProperties}
      />
      {hint && <span id={`${id}-hint`} className="fw-slider__hint">{hint}</span>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Tabs — segmented control with roving tabindex and arrow keys
   ════════════════════════════════════════════════════════════ */

export interface TabsProps {
  tabs: { id: string; label: string; badge?: string; icon?: LucideIcon }[];
  activeTab: string;
  onTabChange: (id: string) => void;
  label?: string;
  children?: React.ReactNode;
}

export function Tabs({ tabs, activeTab, onTabChange, label = 'Sections' }: TabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const id = tabs[next].id;
    onTabChange(id);
    refs.current[id]?.focus();
  };
  return (
    <div className="fw-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, i) => {
        const selected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={el => { refs.current[tab.id] = el; }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            className={`fw-tabs__tab ${selected ? 'fw-tabs__tab--active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={e => onKeyDown(e, i)}
          >
            {tab.icon && <Icon icon={tab.icon} size="sm" />}
            <span className="fw-tabs__label">{tab.label}</span>
            {tab.badge && <span className="fw-tabs__badge">{tab.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, activeTab, children }: { id: string; activeTab: string; children: React.ReactNode }) {
  return (
    <div
      id={`tabpanel-${id}`} role="tabpanel" aria-labelledby={`tab-${id}`}
      hidden={activeTab !== id}
      className="fw-tab-panel"
    >
      {activeTab === id && children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Dialog & Drawer
   ════════════════════════════════════════════════════════════ */

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  /** Alias of `actions`. */
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Dialog({ open, onClose, title, description, children, actions: actionsProp, footer, size = 'md' }: DialogProps) {
  const actions = actionsProp ?? footer;
  const titleId = `dialog-title${useId().replace(/:/g, '')}`;
  if (!open) return null;
  return (
    <ModalSurface onClose={onClose} labelledBy={titleId} variant={`dialog fw-modal--${size}`}>
      <div className="fw-overlay-panel fw-dialog">
        <header className="fw-overlay-header">
          <div>
            <h2 id={titleId} className="fw-overlay-title">{title}</h2>
            {description && <p className="fw-overlay-description">{description}</p>}
          </div>
          <IconButton label="Close dialog" onClick={onClose} className="fw-overlay-close">
            <Icon icon={X} />
          </IconButton>
        </header>
        <div className="fw-overlay-body">{children}</div>
        {actions && <footer className="fw-overlay-actions">{actions}</footer>}
      </div>
    </ModalSurface>
  );
}

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: 'right' | 'left';
}

export function Drawer({ open, onClose, title, description, children, footer, side = 'right' }: DrawerProps) {
  const titleId = `drawer-title${useId().replace(/:/g, '')}`;
  if (!open) return null;
  return (
    <ModalSurface onClose={onClose} labelledBy={titleId} variant={`drawer fw-modal--${side}`}>
      <div className="fw-overlay-panel fw-drawer">
        <header className="fw-overlay-header">
          <div>
            <h2 id={titleId} className="fw-overlay-title">{title}</h2>
            {description && <p className="fw-overlay-description">{description}</p>}
          </div>
          <IconButton label="Close" onClick={onClose} className="fw-overlay-close">
            <Icon icon={X} />
          </IconButton>
        </header>
        <div className="fw-overlay-body">{children}</div>
        {footer && <footer className="fw-overlay-actions">{footer}</footer>}
      </div>
    </ModalSurface>
  );
}

/* ════════════════════════════════════════════════════════════
   Popover — non-modal panel anchored to a trigger button
   ════════════════════════════════════════════════════════════ */

export function Popover({ label, icon, title, children, align = 'start', variant = 'ghost', size = 'sm' }: {
  label: string;
  icon?: LucideIcon;
  title: string;
  children: React.ReactNode;
  align?: 'start' | 'end';
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
}) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const uid = useId().replace(/:/g, '');
  const panelId = `popover${uid}`;
  const titleId = `popover-title${uid}`;

  const close = useCallback((restore = true) => {
    setOpen(false);
    if (restore) triggerRef.current?.focus();
  }, []);

  useEscapeLayer(open, () => close(true));

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the measured shift when the popover closes
    if (!open) { setShift(0); return; }
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const margin = 12;
    let dx = 0;
    if (rect.right > window.innerWidth - margin) dx = window.innerWidth - margin - rect.right;
    if (rect.left + dx < margin) dx = margin - rect.left;
    setShift(dx);
    (getFocusable(panel)[0] ?? panel).focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && e.target instanceof Node && !wrapRef.current.contains(e.target)) close(false);
    };
    const onFocus = (e: FocusEvent) => {
      if (wrapRef.current && e.target instanceof Node && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('focusin', onFocus);
    };
  }, [open, close]);

  return (
    <span className="fw-popover" ref={wrapRef}>
      <Button
        ref={triggerRef}
        variant={variant}
        size={size}
        icon={icon ? <Icon icon={icon} size="sm" /> : undefined}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => (open ? close(true) : setOpen(true))}
      >
        {label}
      </Button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={`fw-popover__panel fw-popover__panel--${align}`}
          style={shift ? { transform: `translateX(${shift}px)` } : undefined}
        >
          <div className="fw-popover__header">
            <h3 id={titleId} className="fw-popover__title">{title}</h3>
            <IconButton label="Close" size="sm" onClick={() => close(true)}>
              <Icon icon={X} size="sm" />
            </IconButton>
          </div>
          <div className="fw-popover__body">{children}</div>
        </div>
      )}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════
   Tooltip — hover/focus, dismissible with Escape
   ════════════════════════════════════════════════════════════ */

export function Tooltip({ children, content }: { children: React.ReactElement; content: string }) {
  const [visible, setVisible] = useState(false);
  const [shift, setShift] = useState(0);
  const tipRef = useRef<HTMLSpanElement>(null);
  const tipId = `tooltip${useId().replace(/:/g, '')}`;
  useEscapeLayer(visible, () => setVisible(false));
  // Keep the tip inside the viewport (and inside an open dialog, which clips overflow) by
  // shifting it horizontally once it is shown. Centred on the trigger whenever there is room.
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!visible || !tip) { setShift(0); return; }
    const margin = 8;
    const bounds = tip.closest('dialog')?.getBoundingClientRect();
    const left = Math.max(bounds?.left ?? 0, 0) + margin;
    const right = Math.min(bounds?.right ?? window.innerWidth, window.innerWidth) - margin;
    tip.style.setProperty('--tip-shift', '0px');
    const rect = tip.getBoundingClientRect();
    let next = 0;
    if (rect.right > right) next = right - rect.right;
    if (rect.left + next < left) next = left - rect.left;
    setShift(next);
  }, [visible, content]);
  const child = React.Children.only(children) as React.ReactElement<Record<string, unknown>>;
  const trigger = React.cloneElement(child, {
    'aria-describedby': tipId,
    onMouseEnter: () => setVisible(true),
    onMouseLeave: () => setVisible(false),
    onFocus: () => setVisible(true),
    onBlur: () => setVisible(false),
  });
  return (
    <span className="fw-tooltip-wrapper">
      {trigger}
      <span
        id={tipId}
        ref={tipRef}
        role="tooltip"
        className={`fw-tooltip ${visible ? 'fw-tooltip--visible' : ''}`}
        style={{ '--tip-shift': `${shift}px` } as React.CSSProperties}
      >
        {content}
      </span>
    </span>
  );
}

/** Small information button with an explanatory tooltip. */
export function InfoTip({ label, content }: { label: string; content: string }) {
  return (
    <Tooltip content={content}>
      <IconButton label={label} size="sm" className="fw-infotip">
        <Icon icon={Info} size="sm" />
      </IconButton>
    </Tooltip>
  );
}

/* ════════════════════════════════════════════════════════════
   Toasts
   ════════════════════════════════════════════════════════════ */

const TOAST_ICON: Record<NonNullable<ToastMessage['type']>, LucideIcon> = {
  info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleX,
};

export function ToastContainer({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fw-toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map(t => (
        <div key={t.id} className={`fw-toast fw-toast--${t.type ?? 'info'}`} role="status">
          <Icon icon={TOAST_ICON[t.type ?? 'info']} className="fw-toast__icon" />
          <span className="fw-toast__message">{t.message}</span>
          <IconButton label="Dismiss notification" size="sm" onClick={() => onDismiss(t.id)}>
            <Icon icon={X} size="sm" />
          </IconButton>
        </div>
      ))}
    </div>
  );
}


/* ════════════════════════════════════════════════════════════
   Status: loading, empty, error
   ════════════════════════════════════════════════════════════ */

export function Skeleton({ width, height, className = '', label }: { width?: string | number; height?: string | number; className?: string; label?: string }) {
  const px = (v: string | number | undefined, fallback: string) => (typeof v === 'number' ? `${v}px` : v ?? fallback);
  return (
    <div
      className={`fw-skeleton ${className}`}
      style={{ width: px(width, '100%'), height: px(height, '20px') }}
      {...(label ? { role: 'status', 'aria-label': label } : { 'aria-hidden': true })}
    />
  );
}

export function EmptyState({ icon, title, description, body, action }: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  /** Alias of `description`. */
  body?: React.ReactNode;
  action?: React.ReactNode;
}) {
  description = description ?? body;
  return (
    <div className="fw-empty-state">
      <div className="fw-empty-state__icon" aria-hidden="true">{icon ?? <Icon icon={Inbox} size="lg" />}</div>
      <h2 className="fw-empty-state__title">{title}</h2>
      {description && <p className="fw-empty-state__desc">{description}</p>}
      {action && <div className="fw-empty-state__action">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, description, body, onRetry, retryLabel = 'Try again' }: {
  retryLabel?: string;
  title?: string;
  description?: React.ReactNode;
  /** Alias of `description`. */
  body?: React.ReactNode;
  onRetry?: () => void;
}) {
  description = description ?? body;
  return (
    <div className="fw-empty-state fw-empty-state--error" role="alert">
      <div className="fw-empty-state__icon" aria-hidden="true"><Icon icon={TriangleAlert} size="lg" /></div>
      <h2 className="fw-empty-state__title">{title ?? 'Something went wrong'}</h2>
      {description && <p className="fw-empty-state__desc">{description}</p>}
      {onRetry && <Button variant="secondary" onClick={onRetry}>{retryLabel}</Button>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Charts & headers
   ════════════════════════════════════════════════════════════ */

export function ChartFrame({ title, source, sources, legend, caption, children, summary }: {
  title: string;
  /** Free-text source line, or a provenance kind rendered as a badge. */
  source?: string;
  /** Provenance kinds rendered as badges. */
  sources?: SourceKind[];
  legend?: React.ReactNode;
  caption?: string;
  children: React.ReactNode;
  summary?: string;
}) {
  const kinds: SourceKind[] = sources ?? (source && source in SOURCE_LABELS ? [source as SourceKind] : []);
  const sourceText = source && !(source in SOURCE_LABELS) ? source : undefined;
  return (
    <figure className="fw-chart-frame">
      <figcaption className="fw-chart-frame__header">
        <span className="fw-chart-frame__title">{title}</span>
        {sourceText && <span className="fw-chart-frame__source">{sourceText}</span>}
        {kinds.map((k) => <SourceBadge key={k} source={k} />)}
      </figcaption>
      {legend && <div className="fw-chart-frame__legend">{legend}</div>}
      <div className="fw-chart-frame__body">{children}</div>
      {caption && <p className="fw-chart-frame__caption">{caption}</p>}
      {summary && (
        <details className="fw-chart-frame__summary">
          <summary>Text summary of this chart</summary>
          <p>{summary}</p>
        </details>
      )}
    </figure>
  );
}

/**
 * Page header (h1 by default). Use level="section" for an in-page section heading (h2).
 * Actions move below the title on narrow screens.
 */
export function SectionHeader({ title, subtitle, actions, eyebrow, level = 'page' }: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
  level?: 'page' | 'section';
}) {
  const Heading = level === 'page' ? 'h1' : 'h2';
  return (
    <div className={`fw-section-header fw-section-header--${level}`}>
      <div className="fw-section-header__text">
        {eyebrow && <span className="fw-eyebrow fw-section-header__eyebrow">{eyebrow}</span>}
        <Heading className={level === 'page' ? 'fw-page-title' : 'fw-section-title'}>{title}</Heading>
        {subtitle && <p className="fw-section-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="fw-section-header__actions">{actions}</div>}
    </div>
  );
}


/* Legacy icon exports kept for compatibility */
export function ChevronIcon({ direction = 'right' }: { direction?: 'right' | 'left' | 'up' | 'down' }) {
  const angles: Record<string, number> = { right: 0, down: 90, left: 180, up: 270 };
  return <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" style={{ transform: `rotate(${angles[direction]}deg)` }} />;
}

export function SpinnerIcon() {
  return <span className="fw-btn__spinner" aria-hidden="true" />;
}
