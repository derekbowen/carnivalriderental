import type { RideCategory } from '../types/ride';

export const categories: RideCategory[] = [
{
  id: 'ferris-wheels',
  name: 'Ferris wheels',
  description: 'Landmark centerpieces, from classic 18 m wheels to large observation wheels.'
},
{
  id: 'carousels',
  name: 'Carousels',
  description: 'Heritage and double-deck carousels for all-ages crowds.'
},
{
  id: 'swing-rides',
  name: 'Swing rides',
  description: 'Wave swingers and tower swings with high hourly throughput.'
},
{
  id: 'kiddie-rides',
  name: 'Kiddie rides',
  description: 'Compact rides sized for younger guests and tighter sites.'
},
{
  id: 'packages',
  name: 'Full carnival packages',
  description: 'Multi-ride packages with a single operating crew.',
  comingLater: true
}];


export const eventSizes = [
{ id: 'under-500', label: 'Under 500 guests' },
{ id: '500-2000', label: '500 – 2,000 guests' },
{ id: '2000-10000', label: '2,000 – 10,000 guests' },
{ id: '10000-plus', label: '10,000+ guests' }] as
const;