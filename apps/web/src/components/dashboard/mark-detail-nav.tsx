"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";

import { FadeIn } from "@/components/motion";
import { Button } from "@/components/ui/button";

interface MarkDetailNavProps {
  positionLabel: string;
  canPrev: boolean;
  canNext: boolean;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onShowHelp: () => void;
}

export function MarkDetailNav({
  positionLabel,
  canPrev,
  canNext,
  onBack,
  onPrev,
  onNext,
  onShowHelp,
}: MarkDetailNavProps) {
  return (
    <FadeIn className="mb-6 border-b border-rule pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          aria-keyshortcuts="Escape"
          className="interactive-lift min-h-11 gap-1.5 px-3 text-[0.9375rem] text-ink-2 hover:bg-paper-2 hover:text-ink sm:min-h-8 sm:px-2 sm:text-[0.8125rem]"
        >
          <ArrowLeft className="size-3.5" />
          Back to triage
        </Button>
        <div className="flex items-center gap-1">
          <span className="mr-2 text-[0.6875rem] text-ink-3">{positionLabel}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onPrev}
            disabled={!canPrev}
            aria-label="Go to previous mark"
            aria-keyshortcuts="K"
            className="interactive-lift h-11 px-3 sm:h-8 sm:px-2.5"
          >
            <ArrowLeft className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onNext}
            disabled={!canNext}
            aria-label="Go to next mark"
            aria-keyshortcuts="J"
            className="interactive-lift h-11 px-3 sm:h-8 sm:px-2.5"
          >
            <ArrowRight className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onShowHelp}
            aria-label="Show keyboard shortcuts"
            aria-keyshortcuts="?"
            className="interactive-lift h-11 px-2.5 text-ink-3 hover:text-ink sm:h-8 sm:px-2"
          >
            <span className="font-mono text-[0.75rem]">?</span>
          </Button>
        </div>
      </div>
    </FadeIn>
  );
}
