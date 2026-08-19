import { POLL_FYLKE_MIN_VOTES } from '@/lib/polls/norway-counties';
import type { PollFylkeTotals } from '@/lib/polls/types';

type PollResultViewProps = {
  byFylke: PollFylkeTotals[];
};

export function PollResultView({ byFylke }: PollResultViewProps) {
  if (byFylke.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Fylkesresultater vises når nok anonyme stemmer er samlet (minst {POLL_FYLKE_MIN_VOTES} per fylke).
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <caption className="sr-only">Anonyme resultater per fylke</caption>
        <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Fylke</th>
            <th className="px-4 py-3 font-medium">Ja</th>
            <th className="px-4 py-3 font-medium">Nei</th>
            <th className="px-4 py-3 font-medium">Blank</th>
            <th className="px-4 py-3 font-medium">Totalt</th>
          </tr>
        </thead>
        <tbody>
          {byFylke.map((row) => (
            <tr key={row.code} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
              {row.sufficientData ? (
                <>
                  <td className="px-4 py-3 text-muted-foreground">{row.ja}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.nei}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.blank}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.total}</td>
                </>
              ) : (
                <td colSpan={4} className="px-4 py-3 text-muted-foreground">
                  For få stemmer ({row.total}/{POLL_FYLKE_MIN_VOTES})
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
