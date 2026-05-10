import React from 'react';
import { Printer, Eye, Edit, Trash2 } from 'lucide-react';

/**
 * Reusable Print / View / Edit / Delete action cell, used by every
 * Bank/Cash Receipts/Payments table row (and other list pages).
 *
 * Replaces the duplicated ~30-line `<div className="flex space-x-2">…`
 * block. Pass only the handlers you need — buttons render only when their
 * onClick is provided.
 *
 * Usage:
 *   <RowActionButtons
 *     onPrint={() => handlePrint(receipt)}
 *     onView={() => handleView(receipt)}
 *     onEdit={() => handleEdit(receipt)}
 *     onDelete={() => handleDelete(receipt)}
 *   />
 */
export function RowActionButtons({
  onPrint,
  onView,
  onEdit,
  onDelete,
  printTitle = 'Print',
  viewTitle = 'View',
  editTitle = 'Edit',
  deleteTitle = 'Delete',
  extraButtons,
  className = 'flex space-x-2',
  iconSize = 'h-4 w-4',
  disabled = false,
}) {
  const baseBtn = 'transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className={className}>
      {onPrint && (
        <button
          type="button"
          onClick={onPrint}
          disabled={disabled}
          className={`text-green-600 hover:text-green-900 ${baseBtn}`}
          title={printTitle}
        >
          <Printer className={iconSize} />
        </button>
      )}
      {onView && (
        <button
          type="button"
          onClick={onView}
          disabled={disabled}
          className={`text-blue-600 hover:text-blue-900 ${baseBtn}`}
          title={viewTitle}
        >
          <Eye className={iconSize} />
        </button>
      )}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          className={`text-indigo-600 hover:text-indigo-900 ${baseBtn}`}
          title={editTitle}
        >
          <Edit className={iconSize} />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className={`text-red-600 hover:text-red-900 ${baseBtn}`}
          title={deleteTitle}
        >
          <Trash2 className={iconSize} />
        </button>
      )}
      {extraButtons}
    </div>
  );
}

export default RowActionButtons;
