import { Table2, ChartNoAxesColumn } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export interface LegendItem {
  label: string;
  color: string;
  variant?: 'solid' | 'dashed' | 'ghost';
}

interface ChartCardProps {
  title: string;
  description: string;
  legend?: LegendItem[];
  table: ReactNode;
  children: ReactNode;
}

/** Rahmen für jedes Diagramm: Titel, Legende, Umschalter Diagramm ⇄ Tabelle (WCAG). */
export function ChartCard({ title, description, legend, table, children }: ChartCardProps) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={asTable}
            aria-label={asTable ? `${title} als Diagramm` : `${title} als Tabelle`}
            onClick={() => {
              setAsTable((v) => !v);
            }}
          >
            {asTable ? <ChartNoAxesColumn aria-hidden="true" /> : <Table2 aria-hidden="true" />}
            {asTable ? 'Diagramm' : 'Tabelle'}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {legend && legend.length > 1 && !asTable ? (
          <ul
            className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
            aria-label="Legende"
          >
            {legend.map((item) => (
              <li key={item.label} className="flex items-center gap-1.5">
                <svg width="18" height="8" aria-hidden="true">
                  {item.variant === 'ghost' ? (
                    <rect
                      x="0"
                      y="0"
                      width="18"
                      height="8"
                      rx="2"
                      fill={item.color}
                      opacity={0.3}
                    />
                  ) : (
                    <line
                      x1="0"
                      y1="4"
                      x2="18"
                      y2="4"
                      stroke={item.color}
                      strokeWidth={2}
                      strokeDasharray={item.variant === 'dashed' ? '4 3' : undefined}
                    />
                  )}
                </svg>
                {item.label}
              </li>
            ))}
          </ul>
        ) : null}
        {asTable ? <div className="max-h-80 overflow-auto">{table}</div> : children}
      </CardContent>
    </Card>
  );
}

export function DataTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="w-full text-sm tabular-nums">
      <caption className="sr-only">{caption}</caption>
      <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
        <tr>
          {head.map((h, i) => (
            <th
              key={h}
              scope="col"
              className={i === 0 ? 'py-2 pr-3 font-medium' : 'py-2 pl-3 text-right font-medium'}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((row) => (
          <tr key={String(row[0])}>
            {row.map((cell, i) => (
              <td key={i} className={i === 0 ? 'py-1.5 pr-3' : 'py-1.5 pl-3 text-right'}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
