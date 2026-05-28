"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { FadeIn } from "@/components/motion";
import { Button } from "@/components/ui/button";

interface MarkDetailNavProps {
  markLabel: string;
  positionLabel: string;
  projectName?: string;
  canPrev: boolean;
  canNext: boolean;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onShowHelp: () => void;
}

export function MarkDetailNav({
  markLabel,
  positionLabel,
  projectName,
  canPrev,
  canNext,
  onBack,
  onPrev,
  onNext,
  onShowHelp,
}: MarkDetailNavProps) {
  return (
    <FadeIn>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Breadcrumbs
          items={[
            { label: "Marks", onClick: onBack },
            ...(projectName ? [{ label: projectName }] : []),
            { label: markLabel, current: true },
          ]}
        />
        <div className="flex items-center gap-1">
          <span className="mr-2 text-ui-xs text-ink-3">{positionLabel}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onPrev}
            disabled={!canPrev}
            aria-label="Go to previous mark"
            aria-keyshortcuts="K"
            className="h-10 px-3 sm:h-8 sm:px-2.5"
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
            className="h-10 px-3 sm:h-8 sm:px-2.5"
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
            className="h-10 px-2.5 text-ink-3 hover:text-ink sm:h-8 sm:px-2"
          >
            <span className="font-mono text-ui-xs">?</span>
          </Button>
        </div>
      </div>
    </FadeIn>
  );
}
