import { Copy, Mail, Share2 } from 'lucide-react';
import { useId } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

/** Fertiger Text zum Kopieren, Teilen oder Mailen (Spec 7.3, Wechsel-Cockpit). */
export function TextGenerator({
  title,
  subject,
  body,
}: {
  title: string;
  subject: string;
  body: string;
}) {
  const id = useId();
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return (
    <details className="group rounded-xl border px-3 py-2">
      <summary className="cursor-pointer py-1 text-sm font-medium">{title}</summary>
      <div className="flex flex-col gap-2 pt-2">
        <p className="text-xs text-muted-foreground">
          Betreff: <span className="text-foreground">{subject}</span>
        </p>
        <label htmlFor={id} className="sr-only">
          {title}
        </label>
        <Textarea id={id} readOnly rows={12} value={body} className="font-mono text-xs" />
        <p className="text-xs text-muted-foreground">
          Platzhalter in eckigen Klammern vor dem Absenden ausfüllen.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard
                .writeText(body)
                .then(() => toast.success('Text kopiert'))
                .catch(() => toast.error('Kopieren nicht möglich – Text markieren und kopieren.'));
            }}
          >
            <Copy aria-hidden="true" />
            Kopieren
          </Button>
          {canShare ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.share({ title: subject, text: body }).catch(() => undefined);
              }}
            >
              <Share2 aria-hidden="true" />
              Teilen
            </Button>
          ) : null}
          <Button asChild size="sm" variant="outline">
            <a href={mailto}>
              <Mail aria-hidden="true" />
              E-Mail
            </a>
          </Button>
        </div>
      </div>
    </details>
  );
}
