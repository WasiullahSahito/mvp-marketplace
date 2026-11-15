"use client";
import { useEffect, useState } from "react";
import type { ProductImage } from "@marketplace/shared";
import { PlaceholderImage } from "./PlaceholderImage";

// Main image + thumbnails. Swipe left/right on touch. Click the main image to enlarge (lightbox).
// An image with an empty url is a placeholder, tinted with the selected colour.
export function Gallery({
  images,
  tint,
  title,
  index,
  onIndexChange,
}: {
  images: ProductImage[];
  tint: string;
  title: string;
  index: number;
  onIndexChange: (i: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const last = images.length - 1;

  const go = (i: number) => onIndexChange(i < 0 ? last : i > last ? 0 : i);

  function onTouchEnd(x: number) {
    if (touchStart === null) return;
    const dx = x - touchStart;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
    setTouchStart(null);
  }

  // Keyboard controls while the lightbox is open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function picture(i: number, className: string) {
    const img = images[i];
    return img.url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={img.url} alt={img.alt || title} className={className} />
    ) : (
      <PlaceholderImage hex={tint} view={i} title={title.split(" – ")[0]} className={className} />
    );
  }

  if (images.length === 0) return null;

  return (
    <div>
      <div
        className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-stone-200 touch-pan-y"
        onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
        onTouchEnd={(e) => onTouchEnd(e.changedTouches[0].clientX)}
      >
        <button
          type="button"
          className="absolute inset-0 h-full w-full cursor-zoom-in"
          onClick={() => setOpen(true)}
          aria-label="Enlarge image"
        >
          {picture(index, "h-full w-full object-cover")}
        </button>
        <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
          Tap to enlarge · {index + 1}/{images.length}
        </span>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => onIndexChange(i)}
            aria-label={`Show image ${i + 1}`}
            aria-current={i === index}
            className={`h-16 w-20 min-w-[80px] shrink-0 overflow-hidden rounded-lg border-2 ${
              i === index ? "border-indigo-600" : "border-transparent"
            }`}
          >
            {picture(i, "h-full w-full object-cover")}
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
          onTouchEnd={(e) => onTouchEnd(e.changedTouches[0].clientX)}
        >
          <button
            type="button"
            className="absolute right-3 top-3 h-11 w-11 rounded-full bg-white/20 text-2xl text-white"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            ×
          </button>
          <button
            type="button"
            className="absolute left-2 h-11 w-11 rounded-full bg-white/20 text-2xl text-white"
            onClick={(e) => {
              e.stopPropagation();
              go(index - 1);
            }}
            aria-label="Previous image"
          >
            ‹
          </button>
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {picture(index, "aspect-[4/3] w-full rounded-lg object-cover")}
          </div>
          <button
            type="button"
            className="absolute right-2 top-1/2 h-11 w-11 rounded-full bg-white/20 text-2xl text-white"
            onClick={(e) => {
              e.stopPropagation();
              go(index + 1);
            }}
            aria-label="Next image"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
