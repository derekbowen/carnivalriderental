import React from 'react';
import { Hero } from '../components/home/Hero';
import { CategoryGrid } from '../components/home/CategoryGrid';
import { ManagedSteps } from '../components/home/ManagedSteps';
import { EventTypeStrip } from '../components/home/EventTypeStrip';
import { PricingClarity } from '../components/home/PricingClarity';

export function Home() {
  return (
    <>
      <Hero />
      <CategoryGrid />
      <ManagedSteps />
      <EventTypeStrip />
      <PricingClarity />
    </>
  );
}
