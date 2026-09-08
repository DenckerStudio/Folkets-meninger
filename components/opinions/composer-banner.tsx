'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { OpinionPointsEditor } from '@/components/opinions/opinion-points-editor';
import { SakPicker } from '@/components/opinions/sak-picker';
import { StanceExpandModal } from '@/components/opinions/stance-expand-modal';
import {
  OPINION_BODY_MIN,
  OPINION_POINTS_MIN,
  OPINION_TITLE_MAX,
  type OpinionPoint,
  type OpinionStance,
  type SakPickerOption,
} from '@/lib/opinions/types';
import { emptyOpinionPointDrafts, validateOpinionPoints } from '@/lib/opinions/validate';
import { routes } from '@/lib/routes';

type ComposerBannerProps = {
  sakOptions: SakPickerOption[];
};

export function ComposerBanner({ sakOptions }: ComposerBannerProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [issueId, setIssueId] = useState<string | null>(null);
  const [points, setPoints] = useState<OpinionPoint[]>(emptyOpinionPointDrafts);
  const [error, setError] = useState('');
  const [pointsError, setPointsError] = useState('');
  const [busy, setBusy] = useState(false);
  const [remoteOptions, setRemoteOptions] = useState<SakPickerOption[]>([]);
  const [loadingSaker, setLoadingSaker] = useState(sakOptions.length === 0);

  useEffect(() => {
    if (sakOptions.length > 0) {
      setLoadingSaker(false);
      return;
    }
    let cancelled = false;
    setLoadingSaker(true);
    fetch('/api/opinions/sak-options')
      .then((res) => (res.ok ? res.json() : { options: [] }))
      .then((data: { options?: SakPickerOption[] }) => {
        if (!cancelled && Array.isArray(data.options)) {
          setRemoteOptions(data.options);
        }
      })
      .catch(() => {
        if (!cancelled) setRemoteOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSaker(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sakOptions.length]);

  const mergedOptions = useMemo(() => {
    const seen = new Set<string>();
    const merged: SakPickerOption[] = [];
    for (const option of [...sakOptions, ...remoteOptions]) {
      if (!option.id || seen.has(option.id)) continue;
      seen.add(option.id);
      merged.push(option);
    }
    return merged;
  }, [remoteOptions, sakOptions]);

  const submit = async (stance: OpinionStance, body: string) => {
    if (!user) {
      router.push(`${routes.login}?next=${encodeURIComponent(routes.folketsMeninger)}`);
      return;
    }
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 5) {
      setError('Skriv en tittel på minst 5 tegn før du deler.');
      return;
    }
    const pointsResult = validateOpinionPoints(points);
    if (pointsResult.error) {
      setPointsError(pointsResult.error);
      setError(pointsResult.error);
      return;
    }
    setBusy(true);
    setError('');
    setPointsError('');
    try {
      const res = await fetch('/api/opinions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmedTitle,
          body,
          stance,
          points: pointsResult.points,
          stortingetIssueId: issueId,
        }),
      });
      const data = (await res.json()) as { error?: string; opinionId?: string };
      if (!res.ok) {
        setError(data.error || 'Kunne ikke publisere meningen');
        return;
      }
      if (data.opinionId) {
        router.push(routes.opinion(data.opinionId));
        router.refresh();
      }
    } catch {
      setError('En feil oppstod');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="relative rounded-xxl border border-[#00205b]/12 bg-white px-5 py-6 sm:px-8 sm:py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xxl" aria-hidden>
        <div className="absolute -left-16 -top-20 h-52 w-52 rounded-full bg-[#ba0c2f]/15 blur-3xl" />
        <div className="absolute -right-12 top-1/3 h-44 w-44 rounded-full bg-[#00205b]/18 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.92),_transparent_55%)]" />
      </div>

      <div className="relative space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ba0c2f]">Borgerinitiativ</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-[#001433] sm:text-2xl">
            Del din mening
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#001433]/65">
            Knytt meningen til saken du skriver om, del minst {OPINION_POINTS_MIN} kulepunkter for og imot,
            og velg For, Blank eller Imot. For og Imot krever minst {OPINION_BODY_MIN} tegn. Blank krever ingen
            begrunnelse.
          </p>
        </div>

        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Tittel på meningen"
          maxLength={OPINION_TITLE_MAX}
          className="w-full rounded-2xl border border-[#00205b]/15 bg-white/90 px-3 py-2.5 text-sm text-[#001433] outline-none placeholder:text-[#001433]/40 focus:ring-2 focus:ring-[#00205b]/25"
        />

        <SakPicker
          options={mergedOptions}
          value={issueId}
          onChange={setIssueId}
          context={title}
          loading={loadingSaker && mergedOptions.length === 0}
        />

        <OpinionPointsEditor
          value={points}
          onChange={(next) => {
            setPoints(next);
            setPointsError('');
          }}
          error={pointsError}
        />

        <StanceExpandModal
          minLength={OPINION_BODY_MIN}
          submitLabel="Publiser mening"
          onSubmit={submit}
          busy={busy}
          error={error}
        />
      </div>
    </section>
  );
}
