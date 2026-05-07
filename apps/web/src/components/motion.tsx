"use client";

import { motion, type HTMLMotionProps, type Transition } from "framer-motion";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

const fadeInVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

const springTransition: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
  mass: 1,
};

function FadeIn({
  children,
  className,
  delay,
  as: Component = "div",
  ...props
}: Omit<HTMLMotionProps<"div">, "children"> & {
  children: React.ReactNode;
  delay?: number;
  as?: keyof typeof motion;
}) {
  const MotionComponent = motion[Component] as typeof motion.div;
  return (
    <MotionComponent
      initial="hidden"
      animate="visible"
      variants={fadeInVariants}
      transition={{ ...springTransition, delay: delay ?? 0 }}
      className={className}
      {...props}
    >
      {children}
    </MotionComponent>
  );
}

function FadeInStagger({
  children,
  className,
  staggerDelay = 0.08,
}: {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: staggerDelay } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function FadeInItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={fadeInVariants} className={className}>
      {children}
    </motion.div>
  );
}

const InteractiveLift = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(function InteractiveLift({ children, className, ...props }, ref) {
  return (
    <motion.div
      ref={ref}
      whileHover={{ y: -1 }}
      whileTap={{ y: 0, scale: 0.99 }}
      transition={springTransition}
      className={cn("transition-colors duration-200", className)}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </motion.div>
  );
});

export { FadeIn, FadeInItem, FadeInStagger, InteractiveLift, springTransition };
