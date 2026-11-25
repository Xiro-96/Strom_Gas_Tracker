import type { ReadingKind } from '@/domain/types';

export const KIND_LABEL: Record<ReadingKind, string> = {
  regular: 'Abgelesen',
  switch: 'Wechseltag',
  meter_install: 'Zählereinbau',
  meter_removal: 'Zählerausbau',
  from_bill: 'Aus Rechnung',
  estimated: 'Geschätzt',
};
