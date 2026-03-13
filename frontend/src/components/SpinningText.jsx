import React from 'react';
import { cn } from '@/lib/utils';

const SpinningText = ({
  text = 'LOADING — LOADING — ',
  radius = 37,
  textClassName = 'text-[8px]',
  speed = 10,
  direction = 'normal',
  className,
}) => {
  const pathId = React.useId().replace(/:/g, '');

  return (
    <div className={cn('inline-flex', className)}>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <g
          className="origin-center animate-spin"
          style={{
            animationDuration: `${speed}s`,
            animationDirection: direction,
          }}
        >
          <path
            id={pathId}
            d={`
              M 50,50
              m -${radius},0
              a ${radius},${radius} 0 1,1 ${radius * 2},0
              a ${radius},${radius} 0 1,1 -${radius * 2},0
            `}
            fill="none"
          />
          <text
            className={cn(
              'uppercase font-normal tracking-widest fill-gray-600',
              textClassName
            )}
          >
            <textPath xlinkHref={`#${pathId}`} href={`#${pathId}`} startOffset="0%">
              {text}
            </textPath>
          </text>
        </g>
      </svg>
    </div>
  );
};

export default SpinningText;
