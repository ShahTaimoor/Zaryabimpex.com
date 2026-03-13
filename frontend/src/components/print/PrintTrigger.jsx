import React from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * PrintTrigger - Button/trigger that invokes the print callback.
 */
const PrintTrigger = ({
  onPrint,
  disabled = false,
  loading = false,
  children,
  className = 'flex items-center gap-2',
  variant = 'outline',
  size = 'default',
  title = 'Print',
  showIcon = true
}) => (
  <Button
    type="button"
    onClick={onPrint}
    disabled={disabled || loading}
    title={title}
    variant={variant}
    size={size}
    className={className}
  >
    {showIcon && <Printer className="h-4 w-4" />}
    {children ?? (loading ? 'Printing...' : 'Print')}
  </Button>
);

export default PrintTrigger;
