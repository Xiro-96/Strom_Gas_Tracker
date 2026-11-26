import { ArrowLeft, FileQuestion } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { contractStatus } from '@/domain/contractStatus';
import { BonusesSection } from '@/features/contracts/detail/BonusesSection';
import { CancellationSection } from '@/features/contracts/detail/CancellationSection';
import { ContractInfoSection } from '@/features/contracts/detail/ContractInfoSection';
import { CostSummary } from '@/features/contracts/detail/CostSummary';
import { InstallmentsSection } from '@/features/contracts/detail/InstallmentsSection';
import { DeleteContract, NotesSection } from '@/features/contracts/detail/NotesSection';
import { BillsSection, TransactionsSection } from '@/features/contracts/detail/PaymentsSection';
import { PricesSection } from '@/features/contracts/detail/PricesSection';
import { CONTRACT_STATUS, deliveryLabel } from '@/features/contracts/labels';
import { useCostData } from '@/features/contracts/useCostData';
import { ENERGY } from '@/features/shared/energy';

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="self-start text-muted-foreground">
      <Link to="/vertraege">
        <ArrowLeft aria-hidden="true" />
        Alle Verträge
      </Link>
    </Button>
  );
}

export function ContractDetailPage() {
  const { id } = useParams();
  const cost = useCostData();

  if (cost.status === 'loading') {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Lädt">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="h-36 animate-pulse bg-muted/40" />
        ))}
      </div>
    );
  }

  const data = cost.contracts;
  const contract = data.contracts.find((c) => c.id === id);
  if (!contract) {
    return (
      <>
        <BackLink />
        <EmptyState
          icon={FileQuestion}
          title="Vertrag nicht gefunden"
          description="Der Vertrag wurde gelöscht oder der Link ist veraltet."
        />
      </>
    );
  }

  const energy = ENERGY[contract.energyType];
  const Icon = energy.icon;
  const costs = cost.byEnergy[contract.energyType];
  const forecast = costs?.forecasts[contract.id];
  const status = CONTRACT_STATUS[contractStatus(contract, cost.today)];
  const ofContract = <T extends { contractId: string }>(rows: T[]) =>
    rows.filter((r) => r.contractId === contract.id);
  const meter = cost.energy.meters.find((m) => m.id === contract.meterId);
  const bonuses = ofContract(data.bonuses);

  return (
    <div key={contract.id} className="flex flex-col gap-4">
      <BackLink />
      <PageHeader
        title={contract.provider}
        description={`${contract.tariffName} · ${deliveryLabel(contract)}`}
        actions={
          <div className="flex flex-col items-end gap-1">
            <Badge variant={contract.energyType}>
              <Icon aria-hidden="true" />
              {energy.label}
            </Badge>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        }
      />
      {forecast ? (
        <CostSummary
          contract={contract}
          forecast={forecast}
          annual={costs.annual}
          today={cost.today}
        />
      ) : null}
      <PricesSection
        contract={contract}
        periods={ofContract(data.pricePeriods)}
        meter={meter}
        today={cost.today}
      />
      <BonusesSection contract={contract} bonuses={bonuses} today={cost.today} />
      <InstallmentsSection contract={contract} forecast={forecast} />
      <TransactionsSection
        contract={contract}
        transactions={ofContract(data.transactions)}
        today={cost.today}
      />
      <BillsSection contract={contract} bills={ofContract(data.bills)} />
      <CancellationSection contract={contract} bonuses={bonuses} />
      <ContractInfoSection contract={contract} />
      <NotesSection contract={contract} />
      <DeleteContract contract={contract} />
    </div>
  );
}
