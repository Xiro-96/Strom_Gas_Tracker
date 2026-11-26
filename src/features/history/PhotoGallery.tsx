import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getPhoto } from '@/data/repositories/readings';
import type { Meter, Reading } from '@/domain/types';
import { formatDate, formatMeterValue } from '@/lib/format';

function Thumb({ photoId, alt }: { photoId: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    void getPhoto(photoId).then((photo) => {
      if (cancelled || !photo) return;
      objectUrl = URL.createObjectURL(photo.blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId]);
  return url ? (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className="aspect-square w-full rounded-xl object-cover"
    />
  ) : (
    <div className="aspect-square w-full animate-pulse rounded-xl bg-muted" aria-hidden="true" />
  );
}

/** Spec Phase 4 – Galerie: alle Zählerfotos mit Datum und Stand; Antippen öffnet das Foto groß. */
export function PhotoGallery({
  readings,
  meters,
  onOpen,
}: {
  readings: readonly Reading[];
  meters: ReadonlyMap<string, Meter>;
  onOpen: (photo: { id: string; title: string }) => void;
}) {
  const withPhotos = readings.filter((r) => r.photoId).toReversed();
  if (withPhotos.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Fotos</h2>
        </CardTitle>
        <CardDescription>
          {withPhotos.length} Zählerfotos – zum Nachweis bei Anbieter und Netzbetreiber.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {withPhotos.map((r) => {
            const meter = meters.get(r.meterId);
            const title = `${formatDate(r.date)} · ${meter ? formatMeterValue(r.value, meter.decimals, meter.unit) : String(r.value)}`;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-1 rounded-xl text-left text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  aria-label={`Foto vom ${title}`}
                  onClick={() => {
                    if (r.photoId) onOpen({ id: r.photoId, title });
                  }}
                >
                  {r.photoId ? <Thumb photoId={r.photoId} alt="" /> : null}
                  <span className="text-muted-foreground">{formatDate(r.date)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
