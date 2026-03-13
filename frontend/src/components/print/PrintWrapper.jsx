import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { useReactToPrint } from 'react-to-print';

/**
 * PrintWrapper - Wraps content and provides react-to-print integration.
 * No window.open() or direct window.print() - all printing goes through react-to-print.
 *
 * Props:
 *   - children: ReactNode - Content to print
 *   - onBeforeGetContent: () => Promise | void
 *   - onAfterPrint: () => void
 *   - documentTitle: string
 *   - pageStyle: string - Injected CSS for print
 *   - contentRef: ref - Optional external ref
 */
const PrintWrapper = forwardRef(({
  children,
  onBeforeGetContent,
  onAfterPrint,
  documentTitle = 'Document',
  pageStyle = '',
  contentRef: externalRef,
  className = ''
}, ref) => {
  const internalRef = useRef(null);
  const contentRef = externalRef || internalRef;

  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle,
    onBeforeGetContent,
    onAfterPrint,
    pageStyle: pageStyle || undefined,
    removeAfterPrint: false
  });

  useImperativeHandle(ref, () => ({
    print: handlePrint
  }), [handlePrint]);

  return (
    <div ref={contentRef} className={`print-wrapper ${className}`}>
      {children}
    </div>
  );
});

PrintWrapper.displayName = 'PrintWrapper';

export default PrintWrapper;
export { useReactToPrint };
