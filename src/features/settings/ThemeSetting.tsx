import { Monitor, Moon, Sun } from 'lucide-react';
import type { ThemePreference } from '@/app/theme/theme';
import { useTheme } from '@/app/theme/useTheme';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Moon }[] = [
  { value: 'dark', label: 'Dunkel', icon: Moon },
  { value: 'light', label: 'Hell', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
];

function isThemePreference(value: string): value is ThemePreference {
  return OPTIONS.some((option) => option.value === value);
}

export function ThemeSetting() {
  const { preference, setPreference } = useTheme();
  return (
    <ToggleGroup
      type="single"
      aria-label="Design"
      value={preference}
      onValueChange={(value) => {
        // Radix liefert '' beim erneuten Tippen auf die aktive Option – Auswahl bleibt bestehen.
        if (isThemePreference(value)) setPreference(value);
      }}
      className="w-full sm:w-auto"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <ToggleGroupItem key={value} value={value} aria-label={label}>
          <Icon aria-hidden="true" />
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
