import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * BaseModal - Reusable modal overlay and container
 *
 * Props:
 *   - isOpen: boolean - Controls visibility
 *   - onClose: () => void - Called when backdrop clicked, Escape pressed, or close button clicked
 *   - title: string - Modal title (optional)
 *   - subtitle: ReactNode - Optional subtitle/description below title
 *   - children: ReactNode - Modal content
 *   - maxWidth: 'sm'|'md'|'lg'|'xl'|'full' - Max width of content area (default: 'xl')
 *   - variant: 'centered'|'scrollable' - Layout style (default: 'scrollable')
 *     - centered: flex items-center justify-center, fixed height
 *     - scrollable: overflow-y-auto, content scrolls within viewport
 *   - showCloseButton: boolean - Show X in header (default: true when title present)
 *   - closeOnBackdrop: boolean - Close when backdrop clicked (default: true)
 *   - closeOnEscape: boolean - Close on Escape key (default: true)
 *   - lockBodyScroll: boolean - Prevent body scroll when open (default: true)
 *   - className: string - Additional classes for the content container
 *   - contentClassName: string - Additional classes for scrollable content area
 *   - headerClassName: string - Additional classes for header
 *   - zIndex: number - z-index for overlay (default: 50)
 */
const BaseModal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  headerExtra,
  maxWidth = 'xl',
  variant = 'scrollable',
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  lockBodyScroll = true,
  className = '',
  contentClassName = '',
  headerClassName = '',
  zIndex = 50,
  footer
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    if (lockBodyScroll) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      if (lockBodyScroll) {
        document.body.style.overflow = '';
      }
    };
  }, [isOpen, onClose, closeOnEscape, lockBodyScroll]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && closeOnBackdrop) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-4xl',
    '2xl': 'max-w-7xl',
    full: 'max-w-[min(95vw,calc(100vw-2rem))]'
  };

  const widthClasses = maxWidth === 'full' ? 'w-full' : 'w-11/12';

  const wrapperClasses =
    variant === 'centered'
      ? 'flex items-center justify-center p-4 min-h-[100dvh]'
      : 'overflow-y-auto h-full w-full p-4';

  const modalContent = (
    <div
      className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 overflow-auto"
      style={{ zIndex }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div className={`${wrapperClasses} flex ${variant === 'centered' ? 'items-center justify-center min-h-full' : 'pt-20'} relative w-full min-w-0`}>
        <div
          className={`relative mx-auto ${widthClasses} ${maxWidthClasses[maxWidth]} shadow-lg rounded-md bg-white flex flex-col ${
            variant === 'scrollable' ? 'max-h-[90vh]' : ''
          } ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {(title || subtitle || headerExtra || showCloseButton) && (
            <div
              className={`flex items-center justify-between p-5 border-b border-gray-200 flex-shrink-0 ${headerClassName}`}
            >
              <div className="flex-1 min-w-0">
                {title && (
                  <h3 id="modal-title" className="text-lg font-medium text-gray-900">
                    {title}
                  </h3>
                )}
                {subtitle && <div className="text-sm text-gray-600 mt-1">{subtitle}</div>}
              </div>
              {headerExtra && <div className="flex items-center gap-3 mx-4">{headerExtra}</div>}
              {showCloseButton && (
                <Button
                  type="button"
                  onClick={onClose}
                  variant="ghost"
                  size="icon"
                  className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-600"
                  aria-label="Close"
                >
                  <X className="h-6 w-6" />
                </Button>
              )}
            </div>
          )}

          <div
            className={`flex-1 ${variant === 'scrollable' ? 'overflow-y-auto' : ''} ${contentClassName}`}
          >
            {children}
          </div>

          {footer && (
            <div className="flex-shrink-0 p-5 border-t border-gray-200 bg-gray-50 rounded-b-md">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default BaseModal;
