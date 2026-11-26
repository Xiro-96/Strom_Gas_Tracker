import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { bills, bonuses, listContracts, pricePeriods } from '@/data/repositories/contracts';
import { listMeters } from '@/data/repositories/meters';
import { listReadings } from '@/data/repositories/readings';
import { getSettings } from '@/data/repositories/settings';
import { todayISO } from '@/domain/dates';
import { collectDeadlines } from '@/domain/deadlines';
import { isUrgent, openDeadlines } from '@/features/switch/urgency';
import { formatCountdown } from '@/lib/format';

const STORAGE_KEY = 'sgt-hints-shown';

function shownToday(today: string): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === today;
  } catch {
    return false;
  }
}

function markShown(today: string) {
  try {
    localStorage.setItem(STORAGE_KEY, today);
  } catch {
    // privater Modus o. Ä.: dann eben bei jedem Start
  }
}

/** Spec Phase 3 – Hinweise beim App-Start: dringende Fristen einmal pro Tag als Toast. */
export function StartupHints() {
  const navigate = useNavigate();
  useEffect(() => {
    const today = todayISO();
    if (shownToday(today)) return;
    let cancelled = false;
    Promise.all([
      listContracts(),
      pricePeriods.list(),
      bonuses.list(),
      bills.list(),
      listReadings(),
      listMeters(),
      getSettings(),
    ])
      .then(([c, p, b, bi, r, m, s]) => {
        if (cancelled) return;
        const urgent = openDeadlines(
          collectDeadlines({
            contracts: c,
            pricePeriods: p,
            bonuses: b,
            bills: bi,
            readings: r,
            meters: m,
            settings: s,
            today,
          }),
          today,
        ).filter(isUrgent);
        const first = urgent[0];
        if (!first) return;
        markShown(today);
        toast.warning(`${first.deadline.title} – ${formatCountdown(first.days)}`, {
          description:
            urgent.length > 1
              ? `Und ${String(urgent.length - 1)} weitere dringende Fristen.`
              : first.deadline.detail,
          duration: 12_000,
          action: {
            label: 'Ansehen',
            onClick: () => {
              void navigate('/wechsel');
            },
          },
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [navigate]);
  return null;
}
