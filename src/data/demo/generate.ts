import { addDays, daysBetween, eachDay } from '@/domain/dates';
import { dayWeight } from '@/domain/distribution';
import type { Bonus, Contract, ISODate, Meter, PricePeriod, Reading } from '@/domain/types';

/**
 * Erfundene Demo-Daten (Spec Phase 1): 2 Jahre, Ablesungen alle 14–21 Tage, saisonal,
 * zwei Anbieterwechsel je Energieart. Alle Namen und Nummern sind frei erfunden.
 */
export interface DemoData {
  meters: Meter[];
  readings: Reading[];
  contracts: Contract[];
  pricePeriods: PricePeriod[];
  bonuses: Bonus[];
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ELECTRICITY_PER_YEAR = 3400;
const GAS_KWH_PER_YEAR = 13000;
const GAS_BASE_LOAD = 0.15;

export function generateDemoData(today: ISODate, seed = 42): DemoData {
  const rand = mulberry32(seed);
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('');
  const id = () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
  const at = `${today}T00:00:00.000Z`;
  const base = { createdAt: at, updatedAt: at, isDemo: true as const };

  const start = addDays(today, -730);
  const dates: ISODate[] = [start];
  for (;;) {
    const next = addDays(dates.at(-1) ?? start, 14 + Math.floor(rand() * 8));
    if (next > today) break;
    dates.push(next);
  }
  const nearest = (target: ISODate) =>
    dates.reduce((best, d) =>
      Math.abs(daysBetween(d, target)) < Math.abs(daysBetween(best, target)) ? d : best,
    );
  const switches = [nearest(addDays(start, 250)), nearest(addDays(start, 615))];

  const strom: Meter = {
    ...base,
    id: id(),
    energyType: 'electricity',
    name: 'Stromzähler (Demo)',
    unit: 'kWh',
    decimals: 1,
    rolloverModulus: 1_000_000,
    meterNumber: 'DEMO-STROM-0001',
    activeFrom: start,
  };
  const gas: Meter = {
    ...base,
    id: id(),
    energyType: 'gas',
    name: 'Gaszähler (Demo)',
    unit: 'm3',
    decimals: 3,
    rolloverModulus: 100_000,
    meterNumber: 'DEMO-GAS-0001',
    activeFrom: start,
    gasFactors: [
      { validFrom: start, zFactor: 0.9531, calorificValue: 11.084 },
      { validFrom: addDays(start, 365), zFactor: 0.9528, calorificValue: 11.121 },
    ],
  };

  const readings: Reading[] = [];
  const track = (
    meter: Meter,
    startValue: number,
    perInterval: (from: ISODate, to: ISODate) => number,
  ) => {
    let value = startValue;
    const factor = 10 ** meter.decimals;
    dates.forEach((date, i) => {
      if (i > 0) value += perInterval(dates[i - 1] ?? date, date) * (0.88 + rand() * 0.24);
      readings.push({
        ...base,
        id: id(),
        meterId: meter.id,
        date,
        value: Math.floor(value * factor) / factor,
        kind: switches.includes(date) ? 'switch' : 'regular',
      });
    });
  };
  const doy = (d: ISODate) => daysBetween(`${d.slice(0, 4)}-01-01`, d);
  track(strom, 23456.7, (from, to) =>
    eachDay(from, to).reduce(
      (sum, d) =>
        sum +
        (ELECTRICITY_PER_YEAR / 365) * (1 + 0.18 * Math.cos((2 * Math.PI * (doy(d) - 15)) / 365)),
      0,
    ),
  );
  track(gas, 8123.456, (from, to) => {
    const kwh = eachDay(from, to).reduce(
      (sum, d) => sum + GAS_KWH_PER_YEAR * dayWeight(d, 'gas', GAS_BASE_LOAD),
      0,
    );
    return kwh / (0.953 * 11.1);
  });

  const contracts: Contract[] = [];
  const pricePeriods: PricePeriod[] = [];
  const bonuses: Bonus[] = [];
  const offers = {
    electricity: [
      {
        provider: 'Voltaro Energie',
        group: 'Voltaro Gruppe',
        tariff: 'Voltaro Klar 12',
        ct: 31.9,
        gp: 120,
      },
      { provider: 'Flinkstrom', group: 'Nordwerk AG', tariff: 'Flink Online', ct: 27.5, gp: 150 },
      { provider: 'Lumen Stadtwerke', group: 'Lumen', tariff: 'Lumen Fix', ct: 29.4, gp: 138 },
    ],
    gas: [
      { provider: 'Gasquell', group: 'Gasquell', tariff: 'Quell Basis', ct: 11.2, gp: 180 },
      { provider: 'Brennwert Plus', group: 'Nordwerk AG', tariff: 'Plus 12', ct: 9.8, gp: 150 },
      { provider: 'Thermia Gas', group: 'Thermia', tariff: 'Thermia Treu', ct: 10.4, gp: 162 },
    ],
  } as const;
  for (const meter of [strom, gas]) {
    const bounds = [start, ...switches];
    offers[meter.energyType].forEach((offer, i) => {
      const deliveryStart = bounds[i] ?? start;
      const nextStart = bounds[i + 1];
      const contract: Contract = {
        ...base,
        id: id(),
        energyType: meter.energyType,
        meterId: meter.id,
        provider: offer.provider,
        providerGroup: offer.group,
        tariffName: offer.tariff,
        customerNumber: `DEMO-${String(i + 1).padStart(3, '0')}`,
        contractDate: addDays(deliveryStart, -35),
        deliveryStart,
        ...(nextStart ? { deliveryEnd: addDays(nextStart, -1) } : {}),
        minTermMonths: 12,
        termStartsAt: 'delivery',
        noticePeriod: { value: 1, unit: 'months' },
        renewal: { type: 'monthly' },
        priceGuarantee: { until: addDays(deliveryStart, 364), scope: 'limited' },
        installmentPlan: [
          {
            validFrom: deliveryStart,
            amountEur: meter.energyType === 'gas' ? 125 : 82,
            dayOfMonth: 15,
          },
        ],
        status: nextStart ? 'ended' : 'active',
      };
      contracts.push(contract);
      pricePeriods.push({
        ...base,
        id: id(),
        contractId: contract.id,
        validFrom: deliveryStart,
        energyPriceCt: offer.ct,
        basePriceEurPerYear: offer.gp,
        enteredAs: 'ct_per_kwh',
      });
      if (i > 0) {
        bonuses.push({
          ...base,
          id: id(),
          contractId: contract.id,
          kind: 'new_customer',
          amountEur: meter.energyType === 'gas' ? 150 : 100,
          condition:
            'Nach 12 Monaten ununterbrochener Belieferung, Verrechnung mit der Jahresrechnung.',
          requiresDeliveryMonths: 12,
          settlement: 'offset_in_bill',
          status: nextStart ? 'offset' : 'promised',
        });
      }
    });
  }

  return { meters: [strom, gas], readings, contracts, pricePeriods, bonuses };
}
