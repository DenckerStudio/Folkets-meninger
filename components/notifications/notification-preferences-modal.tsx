'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Bell, CalendarClock, Lock, Mail, Smartphone, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { routes } from '@/lib/routes';
import {
  FREE_NOTIFICATION_PREFERENCES,
  MAX_MAX_CASE_AGE_DAYS,
  MIN_MAX_CASE_AGE_DAYS,
  type NotificationPreferenceType,
  type NotificationPreferencesV2,
} from '@/lib/notifications/filters';

const TYPE_OPTIONS: Array<{ id: NotificationPreferenceType; label: string; description: string }> = [
  { id: 'new_case', label: 'Nye saker', description: 'Nye Stortingssaker i temaer og emner du følger.' },
  { id: 'reply_to_opinion', label: 'Svar på mine meninger', description: 'Når noen reagerer på eller svarer på meningene dine.' },
  { id: 'vote_open_close', label: 'Avstemninger åpner/lukker', description: 'Når avstemninger du følger åpner eller lukker.' },
  { id: 'hearing_deadline', label: 'Høringsfrister', description: 'Påminnelser om høringsfrister.' },
];

const FREQUENCY_OPTIONS: Array<{ id: NotificationPreferencesV2['frequency']; label: string; description: string }> = [
  { id: 'realtime', label: 'Med en gang', description: 'Én e-post per varsel.' },
  { id: 'daily', label: 'Daglig sammendrag', description: 'Én e-post per dag.' },
  { id: 'weekly', label: 'Ukentlig sammendrag', description: 'Én e-post per uke.' },
];

const UPGRADE_HREF = `${routes.minSide}?tab=stemme-plus`;

type Props = {
  open: boolean;
  onClose: () => void;
};

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return isMobile;
}

function LockedBadge() {
  return (
    <Link
      href={UPGRADE_HREF}
      className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand hover:bg-brand/20"
    >
      <Lock className="h-3 w-3" aria-hidden />
      Stemme+
    </Link>
  );
}

function Section({
  icon,
  title,
  locked,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {locked ? <LockedBadge /> : null}
      </div>
      <div className={cn('space-y-2', locked && 'opacity-60')}>{children}</div>
    </section>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-3 py-3',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-[var(--brand,#00205b)]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span> : null}
      </span>
    </label>
  );
}

export function NotificationPreferencesModal({ open, onClose }: Props) {
  const reduced = useReducedMotion();
  const isMobile = useIsMobile();
  const closeBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const [prefs, setPrefs] = React.useState<NotificationPreferencesV2>(FREE_NOTIFICATION_PREFERENCES);
  const [isPlus, setIsPlus] = React.useState(false);
  const [v2Available, setV2Available] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setMessage(null);
      try {
        const res = await fetch('/api/notifications/preferences', { cache: 'no-store' });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setMessage(json.error ?? 'Kunne ikke hente innstillinger');
          return;
        }
        const p = json.preferences ?? {};
        setPrefs({
          skip_finished: p.skip_finished,
          max_case_age_days: p.max_case_age_days,
          enabled_types: p.enabled_types,
          only_followed: p.only_followed,
          channel_in_app: p.channel_in_app,
          channel_push: p.channel_push,
          channel_email: p.channel_email,
          frequency: p.frequency,
        });
        setIsPlus(Boolean(json.stemme_plus));
        setV2Available(json.v2_available !== false);
      } catch {
        if (!cancelled) setMessage('Kunne ikke hente innstillinger');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Move focus into the modal when it opens (Lukk is the first focusable control).
  React.useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => closeBtnRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  const update = <K extends keyof NotificationPreferencesV2>(key: K, value: NotificationPreferencesV2[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const toggleType = (id: NotificationPreferenceType, on: boolean) => {
    setPrefs((prev) => ({
      ...prev,
      enabled_types: on ? [...new Set([...prev.enabled_types, id])] : prev.enabled_types.filter((t) => t !== id),
    }));
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error ?? 'Kunne ikke lagre innstillinger');
        return;
      }
      onClose();
    } catch {
      setMessage('Kunne ikke lagre innstillinger');
    } finally {
      setSaving(false);
    }
  };

  const locked = !isPlus;

  const body = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Din plan</p>
            <p className="text-sm font-semibold text-foreground">{loading ? 'Laster…' : isPlus ? 'Stemme+' : 'Gratis'}</p>
          </div>
          {!loading && !isPlus ? (
            <Link
              href={UPGRADE_HREF}
              className="inline-flex min-h-11 items-center rounded-xl bg-brand px-3 text-sm font-semibold text-white"
            >
              Oppgrader
            </Link>
          ) : null}
        </div>

        <Section icon={<CalendarClock className="h-4 w-4" />} title="Gamle og ferdige saker" locked={locked}>
          <ToggleRow
            id="np-skip-finished"
            label="Ikke varsle om ferdigbehandlede saker"
            checked={locked ? true : prefs.skip_finished}
            disabled={locked || !v2Available}
            onChange={(v) => update('skip_finished', v)}
          />
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-3">
            <span className="text-sm font-medium text-foreground">Ikke varsle om saker eldre enn (dager)</span>
            <input
              type="number"
              min={MIN_MAX_CASE_AGE_DAYS}
              max={MAX_MAX_CASE_AGE_DAYS}
              disabled={locked || !v2Available}
              value={locked ? 30 : prefs.max_case_age_days}
              onChange={(e) => update('max_case_age_days', Number(e.target.value) || 30)}
              className="h-11 w-20 rounded-lg border border-border bg-background px-2 text-right text-sm"
            />
          </label>
          {locked ? (
            <p className="text-xs text-muted-foreground">
              Gratis: du får aldri varsler om ferdigbehandlede saker eller saker eldre enn 30 dager.
            </p>
          ) : null}
        </Section>

        <Section icon={<Bell className="h-4 w-4" />} title="Varseltyper" locked={locked}>
          {TYPE_OPTIONS.map((t) => (
            <ToggleRow
              key={t.id}
              id={`np-type-${t.id}`}
              label={t.label}
              description={t.description}
              checked={locked ? true : prefs.enabled_types.includes(t.id)}
              disabled={locked || !v2Available}
              onChange={(v) => toggleType(t.id, v)}
            />
          ))}
        </Section>

        <Section icon={<Sparkles className="h-4 w-4" />} title="Kun det jeg følger" locked={locked}>
          <ToggleRow
            id="np-only-followed"
            label="Kun temaer, partier og saker jeg følger"
            checked={locked ? false : prefs.only_followed}
            disabled={locked || !v2Available}
            onChange={(v) => update('only_followed', v)}
          />
        </Section>

        <Section icon={<Smartphone className="h-4 w-4" />} title="Kanaler">
          <ToggleRow
            id="np-channel-in-app"
            label="I appen"
            disabled={!v2Available}
            checked={prefs.channel_in_app}
            onChange={(v) => update('channel_in_app', v)}
          />
          <ToggleRow
            id="np-channel-push"
            label="Push-varsler"
            disabled={!v2Available}
            checked={prefs.channel_push}
            onChange={(v) => update('channel_push', v)}
          />
          {locked ? (
            <p className="px-1 text-xs text-muted-foreground">
              E-postvarsler er kun for Stemme+. <Link href={UPGRADE_HREF} className="font-semibold text-brand hover:underline">Oppgrader</Link>
            </p>
          ) : (
            <ToggleRow
              id="np-channel-email"
              label="E-post"
              checked={prefs.channel_email}
              disabled={!v2Available}
              onChange={(v) => update('channel_email', v)}
            />
          )}
        </Section>

        <Section icon={<Mail className="h-4 w-4" />} title="Hvor ofte">
          {locked ? (
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-3">
              <p className="text-sm font-medium text-foreground">Ukentlig i appen</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Gratis brukere får ett samlet varsel i appen hver uke (ingen e-post). Med Stemme+ kan du velge e-post med en gang, daglig eller ukentlig.
              </p>
              <Link href={UPGRADE_HREF} className="mt-2 inline-flex text-xs font-semibold text-brand hover:underline">
                Oppgrader til Stemme+
              </Link>
            </div>
          ) : (
            FREQUENCY_OPTIONS.map((f) => (
              <label
                key={f.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/40 px-3 py-3"
              >
                <input
                  type="radio"
                  name="np-frequency"
                  className="mt-0.5 h-4 w-4"
                  checked={prefs.frequency === f.id}
                  disabled={!v2Available}
                  onChange={() => update('frequency', f.id)}
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">{f.label}</span>
                  <span className="block text-xs text-muted-foreground">{f.description}</span>
                </span>
              </label>
            ))
          )}
        </Section>

        {locked ? (
          <div className="rounded-xl border border-brand/30 bg-brand/5 p-4">
            <p className="text-sm font-semibold text-brand">Få full kontroll med Stemme+</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Filtrer gamle saker, velg varseltyper, kun det du følger, e-post og frekvens.
            </p>
            <Link href={UPGRADE_HREF} className="mt-2 inline-flex text-sm font-semibold text-brand hover:underline">
              Se Stemme+
            </Link>
          </div>
        ) : null}
      </div>

      <div className="border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {!loading && !v2Available ? (
          <p className="mb-2 text-xs text-muted-foreground">
            Lagring er ikke tilgjengelig ennå: databasen mangler oppdateringen for de nye innstillingene. Standardvalgene gjelder til da.
          </p>
        ) : null}
        {message ? <p className="mb-2 text-xs text-destructive">{message}</p> : null}
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || loading || !v2Available}
          className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Lagrer…' : 'Lagre'}
        </button>
      </div>
    </div>
  );

  const header = (
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <h2 className="text-base font-semibold">Varslingsinnstillinger</h2>
      <button
        ref={closeBtnRef}
        type="button"
        onClick={onClose}
        aria-label="Lukk"
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        isMobile ? (
          <motion.div
            key="np-mobile"
            role="dialog"
            aria-modal="true"
            aria-label="Varslingsinnstillinger"
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed inset-0 z-[95] flex flex-col bg-background pt-[env(safe-area-inset-top,0px)]"
          >
            {header}
            {body}
          </motion.div>
        ) : (
          <motion.div
            key="np-desktop"
            className="fixed inset-0 z-[95] flex items-center justify-center p-4"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Varslingsinnstillinger"
              initial={reduced ? false : { opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-[18px] border border-border/60 bg-card shadow-[0_24px_48px_-12px_rgb(0_0_0/0.3)]"
            >
              {header}
              {body}
            </motion.div>
          </motion.div>
        )
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
