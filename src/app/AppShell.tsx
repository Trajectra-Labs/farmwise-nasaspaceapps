/**
 * AppShell — Shaheem
 * Sidebar navigation (desktop), compact header + slide-in menu (mobile),
 * global toasts and the assistant drawer mount.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Sprout, RefreshCcw, ChartNoAxesCombined, ScanSearch, Database,
  MessagesSquare, Sun, Moon, MapPin, Menu, X, Wheat,
} from 'lucide-react';
import { useFarmWise } from '@/core/store';
import { Icon, IconButton, ToastContainer } from '@/ui/components';
import { useEscapeLayer, useFocusTrap, useScrollLock } from '@/ui/overlay';
import { useToast, TOAST_EVENT, type ToastType } from '@/ui/toast';
import { AssistantDrawer } from '@/features/assistant/AssistantDrawer';
import { ErrorBoundary } from './ErrorBoundary';
import './AppShell.css';

const NAV_ITEMS: { path: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/farm', label: 'My Farm', icon: Sprout },
  { path: '/rotation', label: 'Rotation Planner', icon: RefreshCcw },
  { path: '/scenarios', label: 'Scenario Studio', icon: ChartNoAxesCombined },
  { path: '/plant', label: 'Plant Check', icon: ScanSearch },
  { path: '/evidence', label: 'Data & Evidence', icon: Database },
];

const MOBILE_QUERY = '(max-width: 768px)';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { state, toggleTheme } = useFarmWise();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { toasts, addToast, dismiss } = useToast();
  const location = useLocation();

  const sidebarRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarCloseRef = useRef<HTMLButtonElement>(null);

  const hasFarm = state.farm !== null;
  const nextTheme = state.theme === 'light' ? 'dark' : 'light';

  const restoreFocusRef = useRef(false);
  const closeMobileNav = useCallback((restoreFocus = false) => {
    restoreFocusRef.current = restoreFocus;
    setMobileNavOpen(false);
  }, []);

  // Mobile menu behaves as a modal: focus trapped, page behind inert, no scroll, Escape closes.
  useEscapeLayer(mobileNavOpen, () => closeMobileNav(true));
  useFocusTrap(sidebarRef, mobileNavOpen);
  useScrollLock(mobileNavOpen);
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    if (mobileNavOpen) {
      main.setAttribute('inert', '');
      sidebarCloseRef.current?.focus();
    } else {
      main.removeAttribute('inert');
      // Focus can only move back once the page is no longer inert.
      if (restoreFocusRef.current) {
        restoreFocusRef.current = false;
        menuButtonRef.current?.focus();
      }
    }
  }, [mobileNavOpen]);

  // Leaving the mobile layout while the menu is open would leave the page inert.
  useEffect(() => {
    if (!mobileNavOpen || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => { if (!mq.matches) setMobileNavOpen(false); };
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [mobileNavOpen]);

  // Per-route document title.
  useEffect(() => {
    document.title = `${getCurrentPageTitle(location.pathname)} · FarmWise`;
  }, [location.pathname]);

  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content" onClick={(e) => {
        e.preventDefault();
        const main = document.getElementById('main-content');
        main?.focus();
        main?.scrollIntoView();
      }}>Skip to main content</a>
      <aside
        id="main-navigation"
        ref={sidebarRef}
        className={`app-sidebar ${mobileNavOpen ? 'open' : ''}`}
        aria-label="Main navigation"
      >
        <div className="sidebar-brand">
          <NavLink to="/" className="sidebar-brand__link" onClick={() => closeMobileNav()}>
            <span className="brand-mark" aria-hidden="true"><Wheat size={20} strokeWidth={1.75} /></span>
            <span className="sidebar-brand__text">
              <span className="sidebar-brand__name">FarmWise</span>
              <span className="sidebar-brand__tagline">Crop rotation planner</span>
            </span>
          </NavLink>
          <IconButton
            ref={sidebarCloseRef}
            label="Close navigation"
            className="sidebar-close-btn"
            onClick={() => closeMobileNav(true)}
          >
            <Icon icon={X} />
          </IconButton>
        </div>

        {hasFarm ? (
          <nav className="sidebar-nav" aria-label="Pages">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) => `sidebar-nav__item ${isActive ? 'sidebar-nav__item--active' : ''}`}
                onClick={() => closeMobileNav()}
              >
                <Icon icon={item.icon} className="sidebar-nav__icon" />
                <span className="sidebar-nav__label">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        ) : (
          <p className="sidebar-setup-note">Set up a farm or open the sample farm to start planning.</p>
        )}

        <div className="sidebar-footer">
          {hasFarm && (
            <button
              type="button"
              className="sidebar-action sidebar-action--assistant"
              onClick={() => {
                closeMobileNav();
                document.dispatchEvent(new CustomEvent('fw:open-assistant'));
              }}
            >
              <Icon icon={MessagesSquare} />
              <span>Ask FarmWise</span>
            </button>
          )}

          <button
            type="button"
            className="sidebar-action"
            onClick={toggleTheme}
            aria-label={`Switch to ${nextTheme} mode`}
          >
            <Icon icon={nextTheme === 'dark' ? Moon : Sun} />
            <span>{nextTheme === 'dark' ? 'Dark mode' : 'Light mode'}</span>
          </button>

          {state.farm && (
            <div className="sidebar-farm" title={state.farm.name}>
              <Icon icon={MapPin} size="sm" />
              <span className="sidebar-farm__name">{state.farm.name}</span>
            </div>
          )}
        </div>
      </aside>

      {mobileNavOpen && (
        <div className="mobile-nav-backdrop" aria-hidden="true" onClick={() => closeMobileNav(true)} />
      )}

      <div className="app-main" ref={mainRef}>
        <header className="app-header-mobile">
          <IconButton
            ref={menuButtonRef}
            label="Open navigation"
            aria-expanded={mobileNavOpen}
            aria-controls="main-navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <Icon icon={Menu} />
          </IconButton>
          <NavLink to="/" className="header-brand">
            <span className="brand-mark brand-mark--sm" aria-hidden="true"><Wheat size={18} strokeWidth={1.75} /></span>
            <span>FarmWise</span>
          </NavLink>
          <IconButton label={`Switch to ${nextTheme} mode`} onClick={toggleTheme}>
            <Icon icon={nextTheme === 'dark' ? Moon : Sun} />
          </IconButton>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="page-content"
          aria-label={`${getCurrentPageTitle(location.pathname)} page`}
        >
          {children}
        </main>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <ToastBridge addToast={addToast} />

      {/* Isolated so a fault in the assistant cannot take down the whole shell */}
      <ErrorBoundary silent>
        <AssistantDrawer />
      </ErrorBoundary>
    </div>
  );
}

// Features trigger toasts with showToast() from '@/ui' (a 'fw:toast' event).
function ToastBridge({ addToast }: { addToast: (msg: string, type?: ToastType) => void }) {
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ message: string; type?: ToastType }>;
      addToast(ce.detail.message, ce.detail.type);
    };
    document.addEventListener(TOAST_EVENT, handler);
    return () => document.removeEventListener(TOAST_EVENT, handler);
  }, [addToast]);
  return null;
}

function getCurrentPageTitle(pathname: string): string {
  if (pathname.startsWith('/onboarding')) return 'Get started';
  const item = NAV_ITEMS.find(n => n.path === pathname || (n.path !== '/' && pathname.startsWith(n.path + '/')));
  return item?.label ?? 'FarmWise';
}
