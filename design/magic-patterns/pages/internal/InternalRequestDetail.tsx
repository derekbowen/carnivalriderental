import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon } from 'lucide-react';
import { InternalBanner } from '../../components/internal/InternalBanner';
import { InternalStatusBadge } from '../../components/internal/InternalStatusBadge';
import { EventBrief } from '../../components/internal/EventBrief';
import { SupplierCard } from '../../components/internal/SupplierCard';
import { WorkflowPanel } from '../../components/internal/WorkflowPanel';
import { PricingPanel } from '../../components/internal/PricingPanel';
import { internalRequests } from '../../data/internalRequests';
import { formatDateRange } from '../../utils/date';
import { leadSupplier } from '../../utils/quote';
import type { InternalRequest, InternalStatus } from '../../types/request';

export function InternalRequestDetail() {
  const { reference } = useParams();
  const request = internalRequests.find((r) => r.reference === reference);

  if (!request) {
    return (
      <div className="bg-[#F4F2EC]">
        <InternalBanner />
        <div className="mx-auto max-w-xl px-5 py-24 text-center">
          <h1 className="font-display text-3xl">Request not found</h1>
          <Link to="/internal" className="mt-6 inline-block text-sm font-semibold underline">Back to queue</Link>
        </div>
      </div>
    );
  }

  return <DetailView key={request.reference} request={request} />;
}

function DetailView({ request }: { request: InternalRequest }) {
  const [status, setStatus] = useState<InternalStatus>(request.status);
  const [nextAction, setNextAction] = useState(request.nextAction);
  const lead = leadSupplier(request.suppliers);

  return (
    <div className="bg-[#F4F2EC]">
      <InternalBanner />
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <Link to="/internal" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeftIcon size={15} aria-hidden="true" /> Request queue
        </Link>
        <div className="mt-4 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-sm font-semibold text-muted">{request.reference}</p>
            <h1 className="mt-1 font-display text-3xl">
              {request.rideName} · {request.city}, {request.state}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {formatDateRange(request.eventDate, request.eventDateEnd)} · {request.contact.organization}
            </p>
          </div>
          <InternalStatusBadge status={status} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <EventBrief request={request} />

            <section aria-labelledby="suppliers-heading">
              <div className="flex items-end justify-between">
                <h2 id="suppliers-heading" className="font-display text-lg">Suppliers</h2>
                <p className="text-xs text-muted">Researched → Contacted → Verified → Quoted → Committed</p>
              </div>
              <div className="mt-3 space-y-3">
                {request.suppliers.length > 0 ? (
                  request.suppliers.map((s) => <SupplierCard key={s.id} supplier={s} isLead={lead?.id === s.id} />)
                ) : (
                  <p className="rounded-xl border border-dashed border-line bg-white px-5 py-8 text-center text-sm text-muted">
                    No suppliers researched yet.
                  </p>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6 lg:col-span-4">
            <WorkflowPanel
              status={status}
              nextAction={nextAction}
              coordinator={request.coordinator}
              onStatusChange={setStatus}
              onNextActionChange={setNextAction}
            />
            <PricingPanel customerPrice={request.customerPrice} status={status} lead={lead} payment={request.payment} />
          </aside>
        </div>
      </div>
    </div>
  );
}
