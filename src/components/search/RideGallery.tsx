"use client";

import { useRef, useState } from "react";
import { ImageOffIcon } from "lucide-react";

export function RideGallery({ photos, title }: { photos: { src: string; alt: string }[]; title: string }) {
  const [selected, setSelected] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const photo = photos[selected];
  if (!photo) return (
    <div className="mt-4 flex aspect-[4/3] items-center justify-center rounded-2xl bg-placeholder text-ink-soft" role="img" aria-label={`No photo of ${title} available`}>
      <ImageOffIcon className="mr-2 h-6 w-6" aria-hidden="true" /> No photo available
    </div>
  );
  return (
    <section className="mt-4 min-w-0" aria-label={`${title} photos`} data-testid="ride-gallery">
      <button type="button" onClick={() => dialog.current?.showModal()} className="block aspect-[4/3] w-full overflow-hidden rounded-2xl bg-placeholder focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-strong" aria-label={`Enlarge photo ${selected + 1} of ${photos.length}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.src} alt={photo.alt} width={800} height={600} className="h-full w-full object-contain" />
      </button>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-muted">
        <span aria-live="polite">Photo {selected + 1} of {photos.length}</span>
        <button type="button" onClick={() => dialog.current?.showModal()} className="min-h-11 font-semibold text-accent-strong hover:underline">Enlarge photo</button>
      </div>
      {photos.length > 1 && (
        <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5" aria-label="Choose a ride photo">
          {photos.map((item, index) => (
            <button key={item.src} type="button" onClick={() => setSelected(index)} aria-label={`Show photo ${index + 1} of ${photos.length}`} aria-pressed={selected === index} className={`aspect-[4/3] min-h-11 overflow-hidden rounded-lg border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong ${selected === index ? "border-accent-strong" : "border-transparent"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.src} alt="" width={160} height={120} loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <dialog ref={dialog} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-5xl overflow-auto rounded-2xl bg-surface p-4 text-ink backdrop:bg-black/75" aria-label={`${title}, photo ${selected + 1} of ${photos.length}`}>
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="font-semibold">{title} · Photo {selected + 1} of {photos.length}</p>
          <button type="button" onClick={() => dialog.current?.close()} className="btn-ghost min-h-11">Close photo</button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.src} alt={photo.alt} width={1200} height={900} className="max-h-[70dvh] w-full object-contain" />
      </dialog>
    </section>
  );
}
