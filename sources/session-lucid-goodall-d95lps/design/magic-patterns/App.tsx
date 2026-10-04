import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { BrandTheme } from './components/layout/BrandTheme';
import { ScrollManager } from './components/layout/ScrollManager';
import { SiteLayout } from './components/layout/SiteLayout';
import { SubmittedRequestsProvider } from './contexts/SubmittedRequestsContext';
import { Home } from './pages/Home';
import { BrowseRides } from './pages/BrowseRides';
import { RideDetail } from './pages/RideDetail';
import { EventRequest } from './pages/EventRequest';
import { RequestSubmitted } from './pages/RequestSubmitted';
import { RequestStatus } from './pages/RequestStatus';
import { InternalQueue } from './pages/internal/InternalQueue';
import { InternalRequestDetail } from './pages/internal/InternalRequestDetail';
import { NotFound } from './pages/NotFound';

export function App() {
  return (
    <BrandTheme>
      <SubmittedRequestsProvider>
        <BrowserRouter>
          <ScrollManager />
          <Routes>
            <Route element={<SiteLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/rides" element={<BrowseRides />} />
              <Route path="/rides/:slug" element={<RideDetail />} />
              <Route path="/request" element={<EventRequest />} />
              <Route path="/request/submitted/:reference" element={<RequestSubmitted />} />
              <Route path="/status" element={<RequestStatus />} />
              <Route path="/status/:reference" element={<RequestStatus />} />
              <Route path="/internal" element={<InternalQueue />} />
              <Route path="/internal/:reference" element={<InternalRequestDetail />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SubmittedRequestsProvider>
    </BrandTheme>
  );
}
