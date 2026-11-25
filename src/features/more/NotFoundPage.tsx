import { Compass } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Seite nicht gefunden" />
      <EmptyState
        icon={Compass}
        title="Diese Seite gibt es nicht"
        description="Vielleicht ein alter Link oder ein Tippfehler in der Adresse."
        action={
          <Button asChild>
            <Link to="/">Zur Übersicht</Link>
          </Button>
        }
      />
    </>
  );
}
