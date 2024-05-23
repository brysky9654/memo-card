import { m } from "framer-motion";
import React, { SVGProps } from "react";
import { LazyLoadFramerMotion } from "../lib/framer-motion/lazy-load-framer-motion.tsx";
import { css } from "@emotion/css";

type Direction = "top" | "bottom" | "right";

const getRotation = (direction: Direction) => {
  switch (direction) {
    case "top":
      return 0;
    case "right":
      return 90;
    case "bottom":
      return 180;
  }
};

type Props = Pick<SVGProps<SVGSVGElement>, "onClick" | "className"> & {
  direction: Direction;
};

export const ChevronIcon = (props: Props) => {
  const { direction, ...restProps } = props;
  return (
    <LazyLoadFramerMotion>
      <m.svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        whileTap={{ scale: 0.9 }}
        animate={{ rotate: getRotation(direction) }}
        initial={false}
        className={css({
          ":focus": {
            outline: "none",
          },
        })}
        {...restProps}
      >
        <path
          d="M4 10.5L8.5 6L13 10.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeMiterlimit="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </m.svg>
    </LazyLoadFramerMotion>
  );
};
