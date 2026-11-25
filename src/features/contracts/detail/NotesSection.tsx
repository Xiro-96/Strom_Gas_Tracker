import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { deleteContract, updateContract } from '@/data/repositories/contracts';
import type { Contract } from '@/domain/types';
import { Section } from '@/features/contracts/detail/Section';

export function NotesSection({ contract }: { contract: Contract }) {
  const [notes, setNotes] = useState(contract.notes ?? '');
  return (
    <Section title="Notizen">
      <Textarea
        aria-label="Notizen"
        rows={3}
        value={notes}
        onChange={(event) => {
          setNotes(event.target.value);
        }}
      />
      <Button
        variant="outline"
        className="self-end"
        disabled={notes === (contract.notes ?? '')}
        onClick={() => {
          void updateContract(contract.id, { notes }).then(() =>
            toast.success('Notiz gespeichert'),
          );
        }}
      >
        Notiz speichern
      </Button>
    </Section>
  );
}

export function DeleteContract({ contract }: { contract: Contract }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  return (
    <>
      <Button
        variant="ghost"
        className="self-start text-danger hover:text-danger"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Trash2 aria-hidden="true" />
        Vertrag löschen
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vertrag löschen?</DialogTitle>
            <DialogDescription>
              {contract.provider} ({contract.tariffName}) wird mit Preisen, Boni, Zahlungen und
              Rechnungen gelöscht. Die Ablesungen bleiben erhalten.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
              }}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void deleteContract(contract.id).then(() => {
                  toast.success('Vertrag gelöscht');
                  void navigate('/vertraege', { replace: true });
                });
              }}
            >
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
