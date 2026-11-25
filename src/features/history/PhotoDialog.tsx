import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getPhoto } from '@/data/repositories/readings';

export function PhotoDialog({
  photoId,
  title,
  onClose,
}: {
  photoId: string | null;
  title: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={photoId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Foto</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        {photoId ? <PhotoView key={photoId} photoId={photoId} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PhotoView({ photoId }: { photoId: string }) {
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
      alt="Foto des Zählerstands"
      className="max-h-[60dvh] w-full rounded-2xl object-contain"
    />
  ) : (
    <p className="py-8 text-center text-sm text-muted-foreground">Foto wird geladen …</p>
  );
}
