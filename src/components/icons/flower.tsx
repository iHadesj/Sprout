// Flor no mesmo molde dos ícones do lucide-animated (lá não tem): cinco pétalas em volta
// do miolo, que giram um quinto de volta no hover.
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";


export interface FlowerIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface FlowerIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  strokeWidth?: number;
}

const FlowerIcon = forwardRef<FlowerIconHandle, FlowerIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, strokeWidth = 1.75, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: () => controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
      };
    }, [controls]);

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseEnter?.(e);
        } else {
          controls.start("animate");
        }
      },
      [controls, onMouseEnter]
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseLeave?.(e);
        } else {
          controls.start("normal");
        }
      },
      [controls, onMouseLeave]
    );

    return (
      <div
        className={className}
        style={{ display: "inline-flex" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <motion.svg
          animate={controls}
          fill="none"
          height={size}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
          variants={{
            normal: {
              rotate: 0,
            },
            animate: {
              rotate: 72,
            },
          }}
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="2.2" />
          <path d="M12 9.8c-1.6-1.9-1.6-4.3 0-5.8 1.6 1.5 1.6 3.9 0 5.8Z" />
          <path d="M14.1 11.3c1.2-2.2 3.4-3.2 5.5-2.6-.2 2.2-1.9 3.8-4.4 3.9" transform="rotate(0 12 12)" />
          <path d="M13.4 14c2.4.6 3.8 2.6 3.5 4.7-2.1 0-3.9-1.5-4.4-3.9" />
          <path d="M10.6 14c-.5 2.4-2.3 3.9-4.4 3.9-.3-2.1 1.1-4.1 3.5-4.7" />
          <path d="M9.9 11.3c-2.5-.1-4.2-1.7-4.4-3.9 2.1-.6 4.3.4 5.5 2.6" />
        </motion.svg>
      </div>
    );
  }
);

FlowerIcon.displayName = "FlowerIcon";

export { FlowerIcon };
