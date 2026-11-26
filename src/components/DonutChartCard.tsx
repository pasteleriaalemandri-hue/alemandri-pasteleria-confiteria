import React, { useState } from 'react';

export interface DonutSlice {
  id: string;
  label: string;
  value: number;
  color: string;
  formattedValue: string;
}

interface DonutChartCardProps {
  title: string;
  subtitle?: string;
  slices: DonutSlice[];
  centerLabel: string;
  centerValue: string;
  emptyText?: string;
  headerAction?: React.ReactNode;
}

export function DonutChartCard({
  title,
  subtitle,
  slices,
  centerLabel,
  centerValue,
  emptyText = 'Sin datos para el período seleccionado.',
  headerAction,
}: DonutChartCardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const nonZeroSlices = slices.filter((s) => s.value > 0);
  const total = nonZeroSlices.reduce((sum, s) => sum + s.value, 0);

  const size = 144;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeFraction = 0;
  const segments = nonZeroSlices.map((slice) => {
    const fraction = total > 0 ? slice.value / total : 0;
    const dashLength = fraction * circumference;
    const gapLength = Math.max(0, circumference - dashLength);
    const offset = -cumulativeFraction * circumference;
    cumulativeFraction += fraction;

    return {
      ...slice,
      pct: fraction * 100,
      dashArray: `${dashLength} ${gapLength}`,
      dashOffset: offset,
    };
  });

  const activeSegment = segments.find((s) => s.id === activeId) || null;

  return (
    <article className="bg-[#fff8f5] border border-[#eadfd8] rounded-2xl p-5 flex flex-col gap-4 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-[#eadfd8]">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-[#3b1e14] leading-snug">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-[#6d4c41] mt-0.5">{subtitle}</p>
          )}
        </div>
        {headerAction}
      </div>

      {total > 0 ? (
        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-4 flex-1">
          {/* SVG Donut Ring */}
          <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="w-full h-full -rotate-90"
              role="img"
              aria-label={title}
            >
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#efe5df"
                strokeWidth={strokeWidth}
              />
              {segments.map((seg) => {
                const isActive = activeId === seg.id;
                const isDimmed = activeId !== null && !isActive;
                return (
                  <circle
                    key={seg.id}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={isActive ? strokeWidth + 3 : strokeWidth}
                    strokeDasharray={seg.dashArray}
                    strokeDashoffset={seg.dashOffset}
                    strokeLinecap="butt"
                    opacity={isDimmed ? 0.45 : 1}
                    className="transition-all duration-200 cursor-pointer"
                    onMouseEnter={() => setActiveId(seg.id)}
                    onMouseLeave={() => setActiveId(null)}
                    onClick={() =>
                      setActiveId((prev) => (prev === seg.id ? null : seg.id))
                    }
                  />
                );
              })}
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6d4c41] truncate max-w-[84px]">
                {activeSegment ? activeSegment.label : centerLabel}
              </span>
              <span className="text-sm font-bold text-[#3b1e14] tabular-nums leading-tight mt-0.5">
                {activeSegment
                  ? `${activeSegment.pct.toFixed(1)}%`
                  : centerValue}
              </span>
            </div>
          </div>

          {/* Legend */}
          <ul className="w-full space-y-1.5 min-w-0 flex-1">
            {slices.map((slice) => {
              const pct = total > 0 ? (slice.value / total) * 100 : 0;
              const isActive = activeId === slice.id;
              return (
                <li key={slice.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveId(slice.id)}
                    onMouseLeave={() => setActiveId(null)}
                    onClick={() =>
                      setActiveId((prev) =>
                        prev === slice.id ? null : slice.id
                      )
                    }
                    className={`w-full flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                      isActive ? 'bg-[#f7ede7]' : 'hover:bg-[#fdf3ee]'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        aria-hidden="true"
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="font-medium text-[#3b1e14] truncate">
                        {slice.label}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums text-[#5a3b2e] whitespace-nowrap shrink-0">
                      {slice.formattedValue}{' '}
                      <span className="text-[#8c6d62] font-normal">
                        ({pct.toFixed(0)}%)
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center py-8 text-center text-xs text-[#6d4c41]">
          {emptyText}
        </div>
      )}
    </article>
  );
}
