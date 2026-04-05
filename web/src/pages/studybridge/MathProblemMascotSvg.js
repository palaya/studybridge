import { useId } from 'react';

/**
 * Math Problem card mascot (Today page). clipPath ids are unique per instance.
 */
export default function MathProblemMascotSvg({ style, className }) {
  const uid = useId().replace(/:/g, '');
  const clip0 = `math-mascot-${uid}-c0`;
  const clip1 = `math-mascot-${uid}-c1`;

  return (
    <svg
      className={className}
      style={{ width: 56, height: 'auto', display: 'block', flexShrink: 0, ...style }}
      width="99"
      height="123"
      viewBox="0 0 99 123"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="49.5" cy="73.5" r="49.5" fill="#5BA7FD" />
      <g clipPath={`url(#${clip0})`}>
        <rect x="54" y="57.9094" width="21" height="21" rx="10.5" fill="white" />
        <circle cx="67.5" cy="71.4094" r="8.5" fill="black" />
      </g>
      <g clipPath={`url(#${clip1})`}>
        <rect x="24" y="57.9094" width="21" height="21" rx="10.5" fill="white" />
        <circle cx="37.5" cy="71.4094" r="8.5" fill="black" />
      </g>
      <path
        d="M25 56.7042L36.3842 52.9094"
        stroke="black"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M55 48.9094C62.1408 45.0219 66.6875 45.0386 75 48.9094"
        stroke="black"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M33 96.2751C41.1209 98.7943 59.4902 100.466 68 87"
        stroke="black"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M64 83C65.5278 85.0694 69.8667 88.9259 75 87.7972"
        stroke="black"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse
        cx="44.5635"
        cy="18.5442"
        rx="9.14674"
        ry="16.6793"
        transform="rotate(-15.8606 44.5635 18.5442)"
        fill="#5BA7FD"
      />
      <ellipse
        cx="62.503"
        cy="18.4285"
        rx="9.14674"
        ry="16.6793"
        transform="rotate(14.3818 62.503 18.4285)"
        fill="#5BA7FD"
      />
      <defs>
        <clipPath id={clip0}>
          <rect x="54" y="57.9094" width="21" height="21" rx="10.5" fill="white" />
        </clipPath>
        <clipPath id={clip1}>
          <rect x="24" y="57.9094" width="21" height="21" rx="10.5" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}
