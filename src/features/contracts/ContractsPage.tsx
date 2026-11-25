import { ChevronRight, FileText, Gauge, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { contractStatus } from '@/domain/contractStatus';
import type { Contract } from '@/domain/types';
import { ContractWizard } from '@/features/contracts/ContractWizard';
import { CONTRACT_STATUS, currentMeters, deliveryLabel } from '@/features/contracts/labels';
import { useCostData, type EnergyCosts } from '@/features/contracts/useCostData';
import { ENERGY, ENERGY_TYPES } from '@/features/shared/energy';
import { describeBalance, formatCt } from '@/lib/format';

export function ContractsPage() {
  const cost = useCostData();
  const [wizardOpen, setWizardOpen] = useState(false);

  if (cost.status === 'loading') {
    return (
      <>
        <PageHeader title="Verträge" description="Anbieter, Preise, Boni, Abschläge und Fristen" />
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Lädt">
          {[0, 1].map((i) => (
            <Card key={i} className="h-28 animate-pulse bg-muted/40" />
          ))}
        </div>
      </>
    );
  }

  const meters = currentMeters(cost.energy.meters);
  const hasMeters = Object.keys(meters).length > 0;
  const contracts = cost.contracts.contracts;
  const openWizard = (
    <Button
      onClick={() => {
        setWizardOpen(true);
      }}
    >
      <Plus aria-hidden="true" />
      Vertrag anlegen
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Verträge"
        description="Anbieter, Preise, Boni, Abschläge und Fristen"
        actions={hasMeters && contracts.length > 0 ? openWizard : null}
      />
      {!hasMeters ? (
        <EmptyState
          icon={Gauge}
          title="Erst einen Zähler anlegen"
          description="Ein Vertrag gehört zu einem Strom- oder Gaszähler. Lege den Zähler in der Übersicht an – oder lade dort die Demo-Daten."
          action={
            <Button asChild variant="outline">
              <Link to="/">Zur Übersicht</Link>
            </Button>
          }
        />
      ) : contracts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Noch keine Verträge"
          description="Lege deinen Vertrag mit Preisen, Boni und Abschlag an. Dann siehst du Kosten, Effektivpreis und ob dein Abschlag passt."
          action={openWizard}
        />
      ) : (
        ENERGY_TYPES.map((energy) => {
          const list = contracts
            .filter((c) => c.energyType === energy)
            .sort((a, b) => b.deliveryStart.localeCompare(a.deliveryStart));
          if (list.length === 0) return null;
          const Icon = ENERGY[energy].icon;
          return (
            <section
              key={energy}
              className="flex flex-col gap-3"
              aria-labelledby={`vertraege-${energy}`}
            >
              <h2
                id={`vertraege-${energy}`}
                className="flex items-center gap-2 text-base font-semibold"
              >
                <Icon aria-hidden="true" className={`size-4 ${ENERGY[energy].text}`} />
                {ENERGY[energy].label}
              </h2>
              {list.map((contract) => (
                <ContractLink
                  key={contract.id}
                  contract={contract}
                  costs={cost.byEnergy[energy]}
                  today={cost.today}
                />
              ))}
            </section>
          );
        })
      )}
      <ContractWizard open={wizardOpen} onOpenChange={setWizardOpen} meters={meters} />
    </>
  );
}

function ContractLink({
  contract,
  costs,
  today,
}: {
  contract: Contract;
  costs: EnergyCosts | undefined;
  today: string;
}) {
  const status = CONTRACT_STATUS[contractStatus(contract, today)];
  const forecast = costs?.forecasts[contract.id];
  const balance = forecast ? describeBalance(forecast.balanceEur) : null;
  const effective = forecast?.effective.withBonusCt;
  return (
    <Link
      to={`/vertraege/${contract.id}`}
      className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-card transition-colors hover:bg-accent/40"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <span className="truncate font-semibold">{contract.provider}</span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <span className="truncate text-sm text-muted-foreground">{contract.tariffName}</span>
        <span className="text-xs text-muted-foreground">{deliveryLabel(contract)}</span>
        {balance ? (
          <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>
              {balance.label} {balance.label === 'Ausgeglichen' ? '' : balance.amount}
            </span>
            {effective !== undefined && Number.isFinite(effective) ? (
              <span className="text-muted-foreground">effektiv {formatCt(effective)}</span>
            ) : null}
          </span>
        ) : null}
      </div>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
