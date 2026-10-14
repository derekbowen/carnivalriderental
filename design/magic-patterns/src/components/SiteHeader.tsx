import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { FerrisWheelIcon, MenuIcon, XIcon } from 'lucide-react';
import { primaryButtonClass } from '../utils/formStyles';

const navItems = [
{ to: '/rides', label: 'Browse rides' },
{ to: '/#how-it-works', label: 'How it works' },
{ to: '/requests/BAC-2026-0148', label: 'Track a request' }];


export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <div className="awning h-1.5" aria-hidden="true" />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
        <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pop text-white">
            <FerrisWheelIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="font-display text-[22px] text-ink">Book a Carnival</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {navItems.map((item) =>
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
            `whitespace-nowrap text-sm transition-colors duration-150 ${
            isActive && !item.to.includes('#') ? 'text-ink font-medium' : 'text-ink-soft hover:text-ink'}`

            }>
            
              {item.label}
            </NavLink>
          )}
          <Link to="/request" className={`${primaryButtonClass} px-4 py-2 text-sm`}>
            Start an event request
          </Link>
        </nav>

        <button
          type="button"
          className="rounded-md p-2 text-ink md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}>
          
          {open ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        </button>
      </div>

      {open &&
      <nav aria-label="Mobile" className="border-t border-line bg-canvas px-6 py-4 md:hidden">
          <ul className="flex flex-col gap-3">
            {navItems.map((item) =>
          <li key={item.to}>
                <Link to={item.to} onClick={() => setOpen(false)} className="block py-1 text-[15px] text-ink">
                  {item.label}
                </Link>
              </li>
          )}
            <li>
              <Link to="/request" onClick={() => setOpen(false)} className={`${primaryButtonClass} mt-2 w-full`}>
                Start an event request
              </Link>
            </li>
          </ul>
        </nav>
      }
    </header>);

}