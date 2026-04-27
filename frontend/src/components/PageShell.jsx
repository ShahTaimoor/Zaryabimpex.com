import React from 'react';

const PageShell = ({
  children,
  className = '',
  contentClassName = '',
  maxWidthClassName = 'max-w-[1600px]',
  centerContent = false,
}) => {
  const centerClass = centerContent ? 'min-h-[100dvh] flex items-center justify-center' : '';

  return (
    <div className={`min-h-[100dvh] ${className}`.trim()}>
      <div className={`mx-auto w-full ${maxWidthClassName} ${centerClass} ${contentClassName}`.trim()}>
        {children}
      </div>
    </div>
  );
};

export default PageShell;
