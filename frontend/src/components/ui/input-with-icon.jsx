import React from 'react';
import { Input } from '@/components/ui/input';

/**
 * Input with a right-aligned decorative icon (typically Calendar for
 * date inputs or Search for search inputs).
 *
 * Replaces the duplicated 4-line block:
 *
 *   <div className="relative">
 *     <Input ... className="w-full pr-10" />
 *     <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
 *   </div>
 *
 * Usage:
 *   <InputWithIcon
 *     icon={Calendar}
 *     type="date"
 *     value={formData.date}
 *     onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
 *   />
 *
 * Pass `iconPosition="left"` to render the icon on the left side instead.
 */
export const InputWithIcon = React.forwardRef(function InputWithIcon(
  {
    icon: IconComponent,
    iconPosition = 'right',
    iconClassName = 'h-4 w-4 text-gray-400',
    className,
    wrapperClassName = 'relative',
    ...inputProps
  },
  ref
) {
  if (!IconComponent) {
    return <Input ref={ref} className={className} {...inputProps} />;
  }

  const padClass = iconPosition === 'left' ? 'pl-10' : 'pr-10';
  const iconPositionClass =
    iconPosition === 'left' ? 'left-3' : 'right-3';

  return (
    <div className={wrapperClassName}>
      <Input
        ref={ref}
        className={`w-full ${padClass} ${className ?? ''}`.trim()}
        {...inputProps}
      />
      <IconComponent
        className={`absolute ${iconPositionClass} top-1/2 transform -translate-y-1/2 ${iconClassName} pointer-events-none`}
      />
    </div>
  );
});

export default InputWithIcon;
