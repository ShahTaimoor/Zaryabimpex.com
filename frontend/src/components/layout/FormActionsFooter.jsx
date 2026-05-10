import React from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Reusable Reset / Save (or Cancel / Submit) action footer for cards
 * containing a form. Replaces the duplicated 22-line block:
 *
 *   <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
 *     <Button onClick={resetForm} variant="outline" ...>
 *       <RotateCcw className="h-4 w-4" /><span>Reset</span>
 *     </Button>
 *     <Button onClick={handleCreate} disabled={creating} variant="default" ...>
 *       <Save className="h-4 w-4" /><span>{creating ? 'Saving...' : 'Save Receipt'}</span>
 *     </Button>
 *   </div>
 *
 * Pass any combination of `onReset` / `onSubmit`, or render fully custom
 * buttons with `extraButtons`.
 */
export function FormActionsFooter({
  onReset,
  resetLabel = 'Reset',
  resetIcon: ResetIcon = RotateCcw,
  resetVariant = 'outline',
  onSubmit,
  submitLabel = 'Save',
  submittingLabel,
  submitIcon: SubmitIcon = Save,
  submitVariant = 'default',
  isSubmitting = false,
  submitDisabled = false,
  extraButtons,
  className = 'flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6 pt-4 border-t border-gray-200',
  buttonClassName = 'flex items-center justify-center gap-2 w-full sm:w-auto',
}) {
  const finalSubmittingLabel = submittingLabel ?? `${submitLabel}...`;

  return (
    <div className={className}>
      {onReset && (
        <Button
          type="button"
          onClick={onReset}
          variant={resetVariant}
          size="default"
          className={buttonClassName}
          disabled={isSubmitting}
        >
          {ResetIcon && <ResetIcon className="h-4 w-4" />}
          <span>{resetLabel}</span>
        </Button>
      )}
      {extraButtons}
      {onSubmit && (
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || submitDisabled}
          variant={submitVariant}
          size="default"
          className={buttonClassName}
        >
          {SubmitIcon && <SubmitIcon className="h-4 w-4" />}
          <span>{isSubmitting ? finalSubmittingLabel : submitLabel}</span>
        </Button>
      )}
    </div>
  );
}

export default FormActionsFooter;
