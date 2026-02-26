/**
 * EmbryoMarkerSVG — SVG marker for embryos on the plate frame.
 *
 * 3 visual states:
 *   - pending: semi-transparent outline with number
 *   - classified: green fill with checkmark
 *   - active: green fill with pulse animation + number
 */

type MarkerStatus = 'pending' | 'classified' | 'active';

interface EmbryoMarkerSVGProps {
  cx: number;
  cy: number;
  r: number;
  index: number;
  status: MarkerStatus;
  onClick: () => void;
}

export function EmbryoMarkerSVG({ cx, cy, r, index, status, onClick }: EmbryoMarkerSVGProps) {
  const fontSize = r * 0.75;

  if (status === 'active') {
    return (
      <g onClick={onClick} className="cursor-pointer">
        {/* Pulse ring */}
        <circle
          cx={cx}
          cy={cy}
          r={r * 1.4}
          fill="none"
          stroke="#34D399"
          strokeWidth={r * 0.08}
          className="animate-marker-pulse"
        />
        {/* Solid circle */}
        <circle cx={cx} cy={cy} r={r} fill="#34D399" stroke="#047857" strokeWidth={r * 0.12} />
        {/* Number */}
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize={fontSize}
          fontWeight="bold"
          style={{ textShadow: '0 0 2px rgba(0,0,0,0.5)' }}
        >
          {index + 1}
        </text>
      </g>
    );
  }

  if (status === 'classified') {
    const badgeR = r * 0.3;
    const badgeCx = cx + r * 0.6;
    const badgeCy = cy - r * 0.6;
    return (
      <g onClick={onClick} className="cursor-pointer">
        <circle cx={cx} cy={cy} r={r} fill="rgba(52,211,153,0.25)" stroke="#34D399" strokeWidth={r * 0.1} />
        {/* Number (same as pending but green) */}
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#34D399"
          fontSize={fontSize}
          fontWeight="bold"
        >
          {index + 1}
        </text>
        {/* Mini ✓ badge top-right */}
        <circle cx={badgeCx} cy={badgeCy} r={badgeR} fill="#047857" stroke="white" strokeWidth={r * 0.05} />
        <text
          x={badgeCx}
          y={badgeCy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize={badgeR * 1.3}
          fontWeight="bold"
        >
          ✓
        </text>
      </g>
    );
  }

  // pending
  return (
    <g onClick={onClick} className="cursor-pointer">
      <circle cx={cx} cy={cy} r={r} fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.5)" strokeWidth={r * 0.08} />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="rgba(255,255,255,0.7)"
        fontSize={fontSize * 0.9}
        style={{ textShadow: '0 0 2px rgba(0,0,0,0.5)' }}
      >
        {index + 1}
      </text>
    </g>
  );
}
