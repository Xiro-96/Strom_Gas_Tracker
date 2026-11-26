import {
  ChartNoAxesCombined,
  FileChartColumn,
  FileText,
  History,
  LayoutDashboard,
  Menu,
  Plus,
  Repeat,
  Tags,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Großer, zentraler Erfassen-Button in der Bottom-Navigation. */
  primary?: boolean;
  /** Barrierefreier Name, falls abweichend vom sichtbaren Label. */
  ariaLabel?: string;
}

/** Bottom-Navigation (mobil): Übersicht · Verlauf · (＋) · Verträge · Mehr */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Übersicht', icon: LayoutDashboard },
  { to: '/verlauf', label: 'Verlauf', icon: History },
  {
    to: '/erfassen',
    label: 'Erfassen',
    icon: Plus,
    primary: true,
    ariaLabel: 'Zählerstand erfassen',
  },
  { to: '/vertraege', label: 'Verträge', icon: FileText },
  { to: '/mehr', label: 'Mehr', icon: Menu },
];

/** Zusätzliche Bereiche – in der Sidebar (Desktop) und unter „Mehr“ (mobil). */
export const SECONDARY_NAV_ITEMS: readonly NavItem[] = [
  { to: '/auswertung', label: 'Auswertung', icon: ChartNoAxesCombined },
  { to: '/wechsel', label: 'Wechsel-Cockpit', icon: Repeat },
  { to: '/angebote', label: 'Angebote', icon: Tags },
  { to: '/bericht', label: 'Jahresbericht', icon: FileChartColumn },
];
