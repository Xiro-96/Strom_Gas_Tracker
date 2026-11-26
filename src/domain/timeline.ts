import type { Bill, Bonus, Contract, EnergyType, ISODate, PricePeriod } from '@/domain/types';

export interface TimelineBand {
  contractId: string;
  provider: string;
  tariffName: string;
  from: ISODate;
  /** letzter Liefertag bzw. heute bei offenem Vertrag */
  to: ISODate;
  open: boolean;
  /** Arbeitspreis zu Beginn (ct/kWh) */
  energyPriceCt?: number;
  /** Index in `providers` – Farbe je Anbieter */
  colorIndex: number;
}

export interface TimelineMarker {
  contractId: string;
  kind: 'cancellation' | 'bonus' | 'bill';
  date: ISODate;
}

export interface TimelineRow {
  energyType: EnergyType;
  bands: TimelineBand[];
  markers: TimelineMarker[];
}

const key = (provider: string) => provider.trim().toLocaleLowerCase('de-DE');

/** Diagramm 6 – Anbieter-Zeitstrahl: ein Band je Vertrag, Farbe je Anbieter, Ereignis-Marker. */
export function providerTimeline(input: {
  contracts: readonly Contract[];
  pricePeriods: readonly PricePeriod[];
  bonuses: readonly Bonus[];
  bills: readonly Bill[];
  today: ISODate;
}): { from: ISODate; to: ISODate; providers: string[]; rows: TimelineRow[] } {
  const sorted = [...input.contracts].sort((a, b) =>
    a.deliveryStart.localeCompare(b.deliveryStart),
  );
  const providers: string[] = [];
  const index = new Map<string, number>();
  for (const c of sorted) {
    if (!index.has(key(c.provider))) {
      index.set(key(c.provider), providers.length);
      providers.push(c.provider.trim());
    }
  }
  const rows: TimelineRow[] = [];
  for (const energyType of ['electricity', 'gas'] as const) {
    const contracts = sorted.filter((c) => c.energyType === energyType);
    if (contracts.length === 0) continue;
    const bands = contracts.map((c): TimelineBand => {
      const first = input.pricePeriods
        .filter((p) => p.contractId === c.id)
        .sort((a, b) => a.validFrom.localeCompare(b.validFrom))[0];
      const to = c.deliveryEnd ?? (input.today > c.deliveryStart ? input.today : c.deliveryStart);
      return {
        contractId: c.id,
        provider: c.provider.trim(),
        tariffName: c.tariffName,
        from: c.deliveryStart,
        to,
        open: c.deliveryEnd === undefined,
        ...(first ? { energyPriceCt: first.energyPriceCt } : {}),
        colorIndex: index.get(key(c.provider)) ?? 0,
      };
    });
    const ids = new Set(contracts.map((c) => c.id));
    const markers: TimelineMarker[] = [];
    for (const c of contracts) {
      if (c.cancellation?.sentAt)
        markers.push({ contractId: c.id, kind: 'cancellation', date: c.cancellation.sentAt });
    }
    for (const b of input.bonuses) {
      if (
        ids.has(b.contractId) &&
        b.receivedAt &&
        (b.status === 'received' || b.status === 'offset')
      )
        markers.push({ contractId: b.contractId, kind: 'bonus', date: b.receivedAt });
    }
    for (const bill of input.bills) {
      if (ids.has(bill.contractId))
        markers.push({
          contractId: bill.contractId,
          kind: 'bill',
          date: bill.issuedAt ?? bill.periodTo,
        });
    }
    markers.sort((a, b) => a.date.localeCompare(b.date));
    rows.push({ energyType, bands, markers });
  }
  const all = rows.flatMap((r) => [
    ...r.bands.flatMap((b) => [b.from, b.to]),
    ...r.markers.map((m) => m.date),
  ]);
  const from = all.reduce((min, d) => (d < min ? d : min), input.today);
  const to = all.reduce((max, d) => (d > max ? d : max), input.today);
  return { from, to, providers, rows };
}
