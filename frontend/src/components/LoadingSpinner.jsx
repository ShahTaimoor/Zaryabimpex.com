import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import SpinningText from './SpinningText';

export const LoadingSpinner = ({ size = 'md', className = '', inline = false }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  };

  const Element = inline ? 'span' : 'div';

  return (
    <Element className={`${inline ? 'inline-block' : 'block'} animate-spin rounded-full border-2 border-gray-300 border-t-primary-600 ${sizeClasses[size]} ${className}`}></Element>
  );
};

export const LoadingButton = ({ isLoading, loading, children, disabled, className = '', variant = 'default', size, ...props }) => {
  const busy = isLoading || loading;
  return (
    <Button
      {...props}
      disabled={disabled || busy}
      variant={variant}
      size={size}
      className={className}
    >
      {busy ? (
        <div className="flex items-center justify-center">
          <LoadingSpinner size="sm" className="mr-2" />
          <span>Loading...</span>
        </div>
      ) : (
        children
      )}
    </Button>
  );
};

export const LoadingCard = ({ className = '' }) => (
  <div className={`card animate-pulse ${className}`}>
    <div className="card-content">
      <div className="space-y-4">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
      </div>
    </div>
  </div>
);

export const LoadingGrid = ({ count = 6, className = '' }) => (
  <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
    {[...Array(count)].map((_, i) => (
      <LoadingCard key={i} />
    ))}
  </div>
);

export const LoadingTable = ({ rows = 5, columns = 4, className = '' }) => (
  <div className={`overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg ${className}`}>
    <table className="min-w-full divide-y divide-gray-300">
      <thead className="bg-gray-50">
        <tr>
          {[...Array(columns)].map((_, i) => (
            <th key={i} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="h-4 bg-gray-200 rounded w-20"></div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {[...Array(rows)].map((_, rowIndex) => (
          <tr key={rowIndex}>
            {[...Array(columns)].map((_, colIndex) => (
              <td key={colIndex} className="px-6 py-4 whitespace-nowrap">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const LoadingPage = ({ message = 'Loading...', useSpinningText = true, showMessage = false }) => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      {useSpinningText ? (
        <>
          <div className="w-24 h-24 mx-auto flex items-center justify-center">
            <SpinningText
              text="WISERCONSULTING POS WEBSITE 03130922988 — "
              radius={35}
              textClassName="text-[6px] fill-gray-600"
              speed={8}
              direction="normal"
              className="w-full h-full"
            />
          </div>
          <p className="text-gray-600 mt-4 text-sm font-medium">Wiserconsulting Pos Website</p>
          <p className="text-gray-500 mt-1 text-xs">03130922988</p>
        </>
      ) : (
        <LoadingSpinner size="xl" className="mx-auto" />
      )}
      {showMessage && <p className="text-gray-600 mt-4">{message}</p>}
    </div>
  </div>
);

export const SpinningTextLoader = ({ text, size = 'md', className = '' }) => {
  const sizeMap = { sm: 'w-12 h-12', md: 'w-20 h-20', lg: 'w-28 h-28' };
  const textSizeMap = { sm: 'text-[5px]', md: 'text-[6px]', lg: 'text-[8px]' };
  return (
    <div className={cn('inline-flex items-center justify-center [&_svg]:text-gray-500', sizeMap[size], className)}>
      <SpinningText
        text={text || 'LOADING — LOADING — '}
        radius={size === 'sm' ? 22 : size === 'lg' ? 42 : 35}
        textClassName={cn('fill-gray-500', textSizeMap[size])}
        speed={8}
      />
    </div>
  );
};

export const LoadingInline = ({ message = 'Loading...' }) => (
  <span className="inline-flex items-center justify-center py-1">
    <LoadingSpinner size="sm" inline={true} className="mr-2" />
    <span className="text-gray-600">{message}</span>
  </span>
);
