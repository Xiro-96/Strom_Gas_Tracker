import { Flame, Zap, type LucideIcon } from 'lucide-react';
import type { EnergyType } from '@/domain/types';

export interface EnergyMeta {
  label: string;
  slug: 'strom' | 'gas';
  icon: LucideIcon;
  text: string;
  soft: string;
  /** CSS-Farbe für Diagramme. */
  color: string;
  /** Zweiter Ton derselben Energieart (Grundpreis im Kostendiagramm). */
  baseColor: string;
}

export const ENERGY: Record<EnergyType, EnergyMeta> = {
  electricity: {
    label: 'Strom',
    slug: 'strom',
    icon: Zap,
    text: 'text-electricity',
    soft: 'bg-electricity-soft',
    color: 'var(--chart-electricity)',
    baseColor: 'var(--chart-electricity-base)',
  },
  gas: {
    label: 'Gas',
    slug: 'gas',
    icon: Flame,
    text: 'text-gas',
    soft: 'bg-gas-soft',
    color: 'var(--chart-gas)',
    baseColor: 'var(--chart-gas-base)',
  },
};

export const ENERGY_TYPES: readonly EnergyType[] = ['electricity', 'gas'];

export function energyFromSlug(slug: string | undefined): EnergyType | undefined {
  if (slug === 'strom') return 'electricity';
  if (slug === 'gas') return 'gas';
  return undefined;
}
