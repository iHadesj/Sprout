// "Menos" no mesmo molde dos ícones do lucide-animated (lá não tem): o plus sem a haste
// vertical, que encolhe e volta no hover.
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";


export interface MinusIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface MinusIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  strokeWidth?: number;
}

const MinusIcon = forwardRef<MinusIconHandle, MinusIconProps>(
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
          transition={{ duration: 0.35 }}
          variants={{
            normal: {
              scaleX: 1,
            },
            animate: {
              scaleX: [1, 0.55, 1],
            },
          }}
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M5 12h14" />
        </motion.svg>
      </div>
    );
  }
);

MinusIcon.displayName = "MinusIcon";

export { MinusIcon };
