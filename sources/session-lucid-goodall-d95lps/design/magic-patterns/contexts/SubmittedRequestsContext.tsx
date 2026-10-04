import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { SubmittedRequest } from '../types/request';

type ContextValue = {
  submitted: Record<string, SubmittedRequest>;
  addSubmitted: (request: SubmittedRequest) => void;
};

const SubmittedRequestsContext = createContext<ContextValue | null>(null);

export function SubmittedRequestsProvider({ children }: { children: React.ReactNode }) {
  const [submitted, setSubmitted] = useState<Record<string, SubmittedRequest>>({});
  const addSubmitted = useCallback((request: SubmittedRequest) => {
    setSubmitted((prev) => ({ ...prev, [request.reference]: request }));
  }, []);
  const value = useMemo(() => ({ submitted, addSubmitted }), [submitted, addSubmitted]);
  return <SubmittedRequestsContext.Provider value={value}>{children}</SubmittedRequestsContext.Provider>;
}

export function useSubmittedRequests(): ContextValue {
  const ctx = useContext(SubmittedRequestsContext);
  if (!ctx) throw new Error('useSubmittedRequests must be used within SubmittedRequestsProvider');
  return ctx;
}
