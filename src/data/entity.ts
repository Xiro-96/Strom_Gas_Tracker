import type { BaseEntity } from '@/domain/types';

export type NewEntity<T extends BaseEntity> = Omit<T, keyof BaseEntity> & { isDemo?: boolean };

export function nowISO(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}

export function stamp<T extends BaseEntity>(input: NewEntity<T>): T {
  const now = nowISO();
  return { ...input, id: newId(), createdAt: now, updatedAt: now } as T;
}

export const isActive = (e: BaseEntity) => !e.deletedAt;
