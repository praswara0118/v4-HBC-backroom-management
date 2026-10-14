import React, { useMemo } from 'react';
import { encodeCode128B } from '../utils/barcodeGenerator';

interface BarcodeBadgeProps {
  value: string;
  height?: number;
  showText?: boolean;
  className?: string;
}

export const BarcodeBadge: React.FC<BarcodeBadgeProps> = ({
  value,
  height = 42,
  showText = true,
  className = '',
}) => {
  const bits = useMemo(() => {
    try {
      return encodeCode128B(value || 'RETUR');
    } catch {
      return [];
    }
  }, [value]);

  if (!bits || bits.length === 0) {
    return <span className="font-mono text-xs">{value}</span>;
  }

  const barWidth = 1.6;
  const totalWidth = bits.length * barWidth;

  return (
    <div className={`inline-flex flex-col items-center bg-white p-1.5 rounded border border-neutral-200 shadow-2xs ${className}`}>
      <svg
        width={totalWidth}
        height={height}
        viewBox={`0 0 ${totalWidth} ${height}`}
        className="max-w-full block"
        aria-label={`Barcode: ${value}`}
      >
        <rect width={totalWidth} height={height} fill="#ffffff" />
        {bits.map((bit, index) => {
          if (bit === 1) {
            return (
              <rect
                key={index}
                x={index * barWidth}
                y={0}
                width={barWidth}
                height={height}
                fill="#111827"
              />
            );
          }
          return null;
        })}
      </svg>
      {showText && (
        <span className="font-mono text-[11px] font-semibold tracking-wider text-neutral-800 mt-0.5 tabular-nums">
          {value}
        </span>
      )}
    </div>
  );
};
