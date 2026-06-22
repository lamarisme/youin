"use client";

import { Maximize2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FullImagePreviewProps {
  src: string;
  alt: string;
  children: ReactNode;
  buttonLabel?: string;
}

export function FullImagePreview({
  src,
  alt,
  children,
  buttonLabel = "View full",
}: FullImagePreviewProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="group relative h-full">
        <button
          type="button"
          aria-label={buttonLabel}
          className="block h-full w-full cursor-zoom-in rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-mark/35"
          onClick={() => setOpen(true)}
        >
          {children}
        </button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="absolute right-2 top-2 h-7 gap-1 rounded-md bg-paper/90 px-2 text-ui-xs shadow-sm opacity-0 transition-opacity hover:bg-paper focus-visible:opacity-100 group-hover:opacity-100"
          onClick={() => setOpen(true)}
        >
          <Maximize2 className="size-3" aria-hidden />
          {buttonLabel}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] gap-3 bg-paper p-3 sm:max-w-6xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{buttonLabel}</DialogTitle>
            <DialogDescription>
              Expanded image preview for {alt}.
            </DialogDescription>
          </DialogHeader>
          {/* Arbitrary capture URLs can be signed, external, or data-backed, so keep a native image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-[calc(100vh-5rem)] w-full object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
