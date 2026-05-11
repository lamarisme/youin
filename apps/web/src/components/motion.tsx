"use client";

import { createElement } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

const fadeInVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
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
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    const tag = Component as keyof React.JSX.IntrinsicElements;
    return createElement(tag, { className, ...props }, children);
  }

  const MotionComponent = motion[Component] as typeof motion.div;
  return (
    <MotionComponent
      initial="hidden"
      animate="visible"
      variants={fadeInVariants}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
        mass: 1,
        delay: delay ?? 0,
      }}
      className={className}
      {...props}
    >
      {children}
    </MotionComponent>
  );
}

export { FadeIn };
