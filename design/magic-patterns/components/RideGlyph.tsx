import React from 'react';
import type { GlyphKind } from '../types/ride';

type Props = { kind: GlyphKind; className?: string };

const wheelAngles = Array.from({ length: 12 }, (_, i) => (i * Math.PI * 2) / 12);
const smallWheelAngles = Array.from({ length: 8 }, (_, i) => (i * Math.PI * 2) / 8);
const scallops = `M38 58 ${Array.from({ length: 8 }, () => 'q7.75 7 15.5 0').join(' ')}`;
const carouselPoles = [56, 78, 100, 122, 144];
const swingChains: [number, number, number, number][] = [
  [48, 32, 28, 90],
  [68, 37, 56, 102],
  [88, 39, 84, 108],
  [112, 39, 116, 108],
  [132, 37, 144, 102],
  [152, 32, 172, 90],
];

export function RideGlyph({ kind, className }: Props) {
  return (
    <svg
      viewBox="0 0 200 140"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {kind === 'ferris' && (
        <g>
          <circle cx="100" cy="62" r="48" />
          <circle cx="100" cy="62" r="40" strokeOpacity={0.5} />
          <circle cx="100" cy="62" r="5" />
          {wheelAngles.map((a, i) => (
            <line key={`s${i}`} x1={100} y1={62} x2={100 + 48 * Math.cos(a)} y2={62 + 48 * Math.sin(a)} strokeOpacity={0.7} />
          ))}
          {wheelAngles.map((a, i) => (
            <rect key={`g${i}`} x={100 + 48 * Math.cos(a) - 3.5} y={62 + 48 * Math.sin(a) + 1} width="7" height="7" rx="1.5" />
          ))}
          <path d="M100 62 L70 130 M100 62 L130 130 M54 130 H146" />
          <line x1="16" y1="134" x2="184" y2="134" strokeOpacity={0.35} />
        </g>
      )}
      {kind === 'carousel' && (
        <g>
          <circle cx="100" cy="6" r="2" />
          <path d="M100 8 V16 M100 16 L162 48 H38 Z" />
          <rect x="38" y="48" width="124" height="10" />
          <path d={scallops} />
          {carouselPoles.map((x, i) => (
            <g key={x}>
              <line x1={x} y1={58} x2={x} y2={116} strokeOpacity={0.7} />
              <ellipse cx={x} cy={i % 2 === 0 ? 86 : 96} rx="9" ry="4" />
            </g>
          ))}
          <rect x="32" y="116" width="136" height="8" rx="2" />
          <line x1="16" y1="134" x2="184" y2="134" strokeOpacity={0.35} />
        </g>
      )}
      {kind === 'swing' && (
        <g>
          <path d="M86 24 L100 10 L114 24" />
          <ellipse cx="100" cy="30" rx="56" ry="9" />
          <line x1="100" y1="39" x2="100" y2="124" />
          {swingChains.map(([x1, y1, x2, y2]) => (
            <g key={`${x1}-${x2}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} strokeOpacity={0.7} />
              <rect x={x2 - 4} y={y2} width="8" height="5" rx="1" />
            </g>
          ))}
          <path d="M78 130 L100 114 L122 130 Z" />
          <line x1="16" y1="134" x2="184" y2="134" strokeOpacity={0.35} />
        </g>
      )}
      {kind === 'family' && (
        <g>
          <rect x="28" y="70" width="42" height="36" rx="3" />
          <rect x="28" y="52" width="22" height="18" rx="2" />
          <rect x="58" y="56" width="6" height="14" />
          <rect x="78" y="78" width="38" height="28" rx="3" />
          <rect x="124" y="78" width="38" height="28" rx="3" />
          <path d="M76 66 H118 M80 66 V78 M114 66 V78 M122 66 H164 M126 66 V78 M160 66 V78" />
          {[40, 60, 88, 106, 134, 152].map((x) => (
            <circle key={x} cx={x} cy={112} r="6" />
          ))}
          <path d="M70 92 H78 M116 92 H124" />
          <line x1="16" y1="120" x2="184" y2="120" />
          <line x1="16" y1="134" x2="184" y2="134" strokeOpacity={0.35} />
        </g>
      )}
      {kind === 'package' && (
        <g>
          <path d="M14 16 Q100 40 186 16" strokeOpacity={0.7} />
          {[30, 54, 78, 102, 126, 150, 172].map((x, i) => (
            <path key={x} d={`M${x} ${20 + (i === 3 ? 7 : i % 3 === 0 ? 1 : 5)} l5 9 l5 -9`} strokeOpacity={0.7} />
          ))}
          <circle cx="56" cy="74" r="30" />
          {smallWheelAngles.map((a, i) => (
            <line key={i} x1={56} y1={74} x2={56 + 30 * Math.cos(a)} y2={74 + 30 * Math.sin(a)} strokeOpacity={0.6} />
          ))}
          <path d="M56 74 L38 130 M56 74 L74 130" />
          <path d="M104 130 V80 L140 48 L176 80 V130" />
          <path d="M140 48 L122 80 M140 48 L158 80 M104 80 H176" strokeOpacity={0.7} />
          <path d="M132 130 V104 Q140 96 148 104 V130" />
          <path d="M140 48 V36 L150 40 L140 44" />
          <line x1="16" y1="134" x2="184" y2="134" strokeOpacity={0.35} />
        </g>
      )}
    </svg>
  );
}
