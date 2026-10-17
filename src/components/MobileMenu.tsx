"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type NavLink = { href: string; label: string };

const shut = (d: HTMLDetailsElement | null) => {
  if (d) d.open = false;
};

/**
 * The phone menu. Still a <details> element, so it opens without JavaScript; with JavaScript it also
 * closes, because client-side navigation keeps the header mounted and a <details> stays open on its
 * own: on every route change, on a tap on one of its links (same-page links don't change the route),
 * on a tap outside it, and on Escape (focus returns to the button).
 */
export function MobileMenu({ links, cta }: { links: NavLink[]; cta: NavLink }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  const close = () => shut(ref.current);

  useEffect(() => shut(ref.current), [pathname]);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) shut(ref.current);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !ref.current?.open) return;
      shut(ref.current);
      ref.current.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details ref={ref} className="relative md:hidden" data-testid="mobile-menu">
      <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-md text-ink [&::-webkit-details-marker]:hidden" aria-label="Menu"><MenuIcon className="h-5 w-5" /></summary>
      <div className="absolute right-0 mt-2 w-60 rounded-xl border border-line bg-surface p-4 shadow-lg">
        <ul className="flex flex-col gap-3">
          {links.map((n) => <li key={n.href}><Link href={n.href} onClick={close} className="block py-1 text-[15px]">{n.label}</Link></li>)}
          <li><Link href={cta.href} onClick={close} className="btn-primary mt-1 w-full text-sm">{cta.label}</Link></li>
        </ul>
      </div>
    </details>
  );
}
