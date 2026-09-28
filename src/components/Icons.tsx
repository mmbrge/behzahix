import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ArrowLeft = (p: IconProps) => (
  <Base {...p}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </Base>
);

export const Play = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" stroke="none" />
  </Base>
);

export const Check = (p: IconProps) => (
  <Base {...p}>
    <path d="m5 12 5 5 9-10" />
  </Base>
);

export const Cross = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const Clock = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Base>
);

export const Menu = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
);

export const Sparkle = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5" />
  </Base>
);

export const Ai = (p: IconProps) => (
  <Base {...p}>
    <rect x="5" y="5" width="14" height="14" rx="3" />
    <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    <path d="M9.5 15 11 9h2l1.5 6M10 13h4" />
  </Base>
);

export const Brush = (p: IconProps) => (
  <Base {...p}>
    <path d="M14.5 4.5 19.5 9.5 11 18l-5-5 8.5-8.5Z" />
    <path d="M6 13c-2 0-3 1.5-3 3.5V20h3.5C8.5 20 10 19 10 17" />
  </Base>
);

export const Code = (p: IconProps) => (
  <Base {...p}>
    <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" />
  </Base>
);

export const Windows = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 5.5 10.5 4.5v7H3zM13 4.2 21 3v8.5h-8zM3 13h7.5v6.5L3 18.5zM13 13h8v8l-8-1.2z" />
  </Base>
);

export const Instagram = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" />
  </Base>
);

export const Linkedin = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
    <path d="M8 10.5V16M8 7.8v.01M11.5 16v-5.5M11.5 13c0-1.7 1-2.5 2.3-2.5S16 11.3 16 13v3" />
  </Base>
);

export const Telegram = (p: IconProps) => (
  <Base {...p}>
    <path d="M21 4 3 11l6 2.2M21 4l-3 16-7.5-6.5M21 4 9 13.2m0 0V19l3-3" />
  </Base>
);

export const Youtube = (p: IconProps) => (
  <Base {...p}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
    <path d="m10 9.5 5 2.5-5 2.5z" fill="currentColor" />
  </Base>
);
