"use client";

import { createElement, type JSX } from "react";

/**
 * FadeIn – now renders instantly as a plain HTML element.
 * All framer-motion animation has been removed.
 */
function FadeIn({
  children,
  className,
  delay: _delay,
  instant: _instant,
  as: Component = "div",
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  instant?: boolean;
  as?: keyof JSX.IntrinsicElements;
  [key: string]: unknown;
}) {
  return createElement(
    Component as keyof JSX.IntrinsicElements,
    { className, ...props },
    children,
  );
}

export { FadeIn };

