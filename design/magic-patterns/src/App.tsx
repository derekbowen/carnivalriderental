import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ScrollToTop } from './components/ScrollToTop';
import { SiteLayout } from './components/SiteLayout';
import { InternalLayout } from './components/internal/InternalLayout';
import { Home } from './pages/Home';
import { BrowseRides } from './pages/BrowseRides';
import { RideDetail } from './pages/RideDetail';
import { EventRequest } from './pages/EventRequest';
import { RequestReceived } from './pages/RequestReceived';
import { RequestStatus } from './pages/RequestStatus';
import { RequestQueue } from './pages/internal/RequestQueue';
import { InternalRequestDetail } from './pages/internal/InternalRequestDetail';

export function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<SiteLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/rides" element={<BrowseRides />} />
          <Route path="/rides/:slug" element={<RideDetail />} />
          <Route path="/request" element={<EventRequest />} />
          <Route path="/request/received" element={<RequestReceived />} />
          <Route path="/requests/:reference" element={<RequestStatus />} />
          <Route path="*" element={<Home />} />
        </Route>
        <Route path="/internal" element={<InternalLayout />}>
          <Route index element={<RequestQueue />} />
          <Route path="requests/:reference" element={<InternalRequestDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>);

}