import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Building2,
  CreditCard,
  X,
  Phone,
  MapPin,
  TrendingUp,
  CheckCircle,
  Wallet,
} from 'lucide-react';
import {
  useGetBanksQuery,
  useCreateBankMutation,
  useUpdateBankMutation,
  useDeleteBankMutation,
} from '../store/services/banksApi';
import { useCheckAccountQuery, useUpdateAccountMutation } from '../store/services/chartOfAccountsApi';
import { useFuzzySearch } from '../hooks/useFuzzySearch';
import { toast } from 'sonner';
import { LoadingSpinner, LoadingButton, LoadingCard, LoadingGrid, LoadingPage, LoadingInline } from '../components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DeleteConfirmationDialog } from '../components/ConfirmationDialog';
import { useDeleteConfirmation } from '../hooks/useConfirmation';
import BaseModal from '../components/BaseModal';

const BankFormModal = ({ bank, onSave, onCancel, isSubmitting }) => {
  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    defaultValues: {
      accountName: '',
      accountNumber: '',
      bankName: '',
      branchName: '',
      branchAddress: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US'
      },
      accountType: 'checking',
      routingNumber: '',
      swiftCode: '',
      iban: '',
      openingBalance: 0,
      isActive: true,
      notes: ''
    }
  });

  // Reset form when bank prop changes (for editing)
  useEffect(() => {
    if (bank) {
      reset({
        accountName: bank.accountName || '',
        accountNumber: bank.accountNumber || '',
        bankName: bank.bankName || '',
        branchName: bank.branchName || '',
        branchAddress: bank.branchAddress || {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: 'US'
        },
        accountType: bank.accountType || 'checking',
        routingNumber: bank.routingNumber || '',
        swiftCode: bank.swiftCode || '',
        iban: bank.iban || '',
        openingBalance: bank.openingBalance || 0,
        isActive: bank.isActive !== undefined ? bank.isActive : true,
        notes: bank.notes || ''
      });
    } else {
      reset({
        accountName: '',
        accountNumber: '',
        bankName: '',
        branchName: '',
        branchAddress: {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: 'US'
        },
        accountType: 'checking',
        routingNumber: '',
        swiftCode: '',
        iban: '',
        openingBalance: 0,
        isActive: true,
        notes: ''
      });
    }
  }, [bank, reset]);

  const onSubmit = (data) => {
    onSave(data);
  };

  return (
    <BaseModal
      isOpen={true}
      onClose={onCancel}
      title={bank ? 'Edit Bank Account' : 'Add New Bank Account'}
      maxWidth="lg"
      variant="scrollable"
      contentClassName="p-6"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Bank Information */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bank Name *
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  {...register('bankName', { required: 'Bank name is required' })}
                  className="pl-10"
                  placeholder="Enter bank name"
                />
              </div>
              {errors.bankName && (
                <p className="text-red-500 text-sm mt-1">{errors.bankName.message}</p>
              )}
            </div>

            {/* Account Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Name *
                </label>
                <Input
                  {...register('accountName', { required: 'Account name is required' })}
                  placeholder="e.g., Main Operating Account"
                />
                {errors.accountName && (
                  <p className="text-red-500 text-sm mt-1">{errors.accountName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Number *
                </label>
                <Input
                  {...register('accountNumber', { required: 'Account number is required' })}
                  placeholder="Enter account number"
                />
                {errors.accountNumber && (
                  <p className="text-red-500 text-sm mt-1">{errors.accountNumber.message}</p>
                )}
              </div>
            </div>

            {/* Branch Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Branch Name
                </label>
                <Input
                  {...register('branchName')}
                  placeholder="Enter branch name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Type *
                </label>
                <select
                  {...register('accountType', { required: 'Account type is required' })}
                  className="input"
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="current">Current</option>
                  <option value="other">Other</option>
                </select>
                {errors.accountType && (
                  <p className="text-red-500 text-sm mt-1">{errors.accountType.message}</p>
                )}
              </div>
            </div>

            {/* Financial Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Opening Balance
                </label>
                <div className="relative">
                  <TrendingUp className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="number"
                    step="0.01"
                    {...register('openingBalance', {
                      valueAsNumber: true,
                      min: { value: 0, message: 'Balance must be positive' }
                    })}
                    className="pl-10"
                    placeholder="0.00"
                  />
                </div>
                {errors.openingBalance && (
                  <p className="text-red-500 text-sm mt-1">{errors.openingBalance.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Routing Number
                </label>
                <Input
                  {...register('routingNumber')}
                  placeholder="Enter routing number"
                />
              </div>
            </div>

            {/* International Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SWIFT Code
                </label>
                <Input
                  {...register('swiftCode')}
                  placeholder="Enter SWIFT code"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  IBAN
                </label>
                <Input
                  {...register('iban')}
                  placeholder="Enter IBAN"
                />
              </div>
            </div>

            {/* Branch Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Branch Address
              </label>
              <div className="space-y-3">
                <Input
                  {...register('branchAddress.street')}
                  placeholder="Street Address"
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    {...register('branchAddress.city')}
                    placeholder="City"
                  />
                  <Input
                    {...register('branchAddress.state')}
                    placeholder="State"
                  />
                  <Input
                    {...register('branchAddress.zipCode')}
                    placeholder="Zip Code"
                  />
                </div>
                <Input
                  {...register('branchAddress.country')}
                  placeholder="Country"
                />
              </div>
            </div>

            {/* Additional Information */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <Textarea
                {...register('notes')}
                rows={3}
                placeholder="Additional notes about this bank account..."
              />
            </div>

            {/* Status */}
            {bank && (
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    {...register('isActive')}
                    className="checkbox"
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Inactive bank accounts won't appear in dropdown menus for new transactions
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                onClick={onCancel}
                variant="secondary"
                size="default"
                className="w-full sm:w-auto"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <LoadingButton
                type="submit"
                isLoading={isSubmitting}
                variant="default"
                size="default"
                className="flex items-center justify-center gap-2 w-full sm:w-auto"
                disabled={isSubmitting}
              >
                <Plus className="h-4 w-4" />
                {bank ? 'Update Bank' : 'Add Bank'}
              </LoadingButton>
            </div>
          </form>
    </BaseModal>
  );
};

const Banks = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [cashOpeningInput, setCashOpeningInput] = useState('');
  const [savingCashOpening, setSavingCashOpening] = useState(false);
  const { confirmation, confirmDelete, handleConfirm, handleCancel } = useDeleteConfirmation();

  const {
    data: cashCheckResponse,
    error: cashCheckError,
    refetch: refetchCashGl,
    isFetching: cashGlFetching,
  } = useCheckAccountQuery('1000');

  const cashGl = cashCheckResponse?.data ?? null;

  useEffect(() => {
    if (cashGl && cashGl.openingBalance !== undefined && cashGl.openingBalance !== null) {
      setCashOpeningInput(String(cashGl.openingBalance));
    }
  }, [cashGl?.openingBalance]);

  const [updateCoaAccount] = useUpdateAccountMutation();

  // Fetch banks
  const { data: banksResponse, isLoading, error, refetch } = useGetBanksQuery(undefined);

  // Extract banks array from response
  const allBanks = React.useMemo(() => {
    if (!banksResponse) return [];
    if (banksResponse?.data?.data?.banks) return banksResponse.data.data.banks;
    if (banksResponse?.data?.banks) return banksResponse.data.banks;
    if (banksResponse?.banks) return banksResponse.banks;
    if (Array.isArray(banksResponse)) return banksResponse;
    return [];
  }, [banksResponse]);

  // Mutations
  const [createBank] = useCreateBankMutation();
  const [updateBank] = useUpdateBankMutation();
  const [deleteBank] = useDeleteBankMutation();

  // Handlers
  const handleSave = async (formData) => {
    const payload = editingBank
      ? formData
      : { ...formData, isActive: true };

    try {
      if (editingBank) {
        await updateBank({ id: editingBank.id || editingBank._id, ...payload }).unwrap();
        toast.success('Bank account updated successfully');
      } else {
        await createBank(payload).unwrap();
        toast.success('Bank account added successfully');
      }
      setShowModal(false);
      setEditingBank(null);
      refetch();
    } catch (error) {
      const errorMessage = error?.data?.errors?.[0]?.msg || error?.data?.message || 'Failed to save bank account';
      toast.error(errorMessage);
    }
  };

  const handleDelete = (bank) => {
    const bankName = `${bank.bankName} - ${bank.accountNumber}`;
    confirmDelete(bankName, 'Bank Account', async () => {
      try {
        await deleteBank(bank.id || bank._id).unwrap();
        toast.success('Bank account deleted successfully');
        refetch();
      } catch (error) {
        toast.error(error?.data?.message || 'Failed to delete bank account');
      }
    });
  };

  const handleAddNew = () => {
    setEditingBank(null);
    setShowModal(true);
  };

  const handleSaveCashOpening = async () => {
    if (!cashGl?.id) {
      toast.error('Cash account (1000) was not found in Chart of Accounts.');
      return;
    }
    const amount = parseFloat(String(cashOpeningInput).replace(/,/g, ''));
    if (Number.isNaN(amount)) {
      toast.error('Enter a valid opening amount.');
      return;
    }
    setSavingCashOpening(true);
    try {
      await updateCoaAccount({
        id: cashGl.id,
        openingBalance: amount,
      }).unwrap();
      toast.success('Cash opening balance saved');
      await refetchCashGl();
    } catch (err) {
      const msg =
        err?.data?.message ||
        err?.data?.errors?.[0]?.msg ||
        (typeof err?.data === 'string' ? err.data : null) ||
        'Failed to save cash opening';
      toast.error(msg);
    } finally {
      setSavingCashOpening(false);
    }
  };

  const handleEdit = (bank) => {
    setEditingBank(bank);
    setShowModal(true);
  };

  // Apply fuzzy search on client side for better UX
  // Hook must be called before any early returns
  const searchedBanks = useFuzzySearch(
    allBanks,
    searchTerm,
    ['bankName', 'accountName', 'accountNumber', 'branchName'],
    {
      threshold: 0.4,
      minScore: 0.3,
      limit: null // Show all matches
    }
  );

  // Filter to show active banks by default (isActive defaults to true if not specified)
  const filteredBanks = searchedBanks.filter(bank => {
    if (!bank) return false;
    const isActive = bank.isActive !== false;
    return isActive;
  });

  const isSubmitting = false; // Can track mutation loading states if needed

  if (isLoading) {
    return <LoadingPage message="Loading banks..." />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading banks</p>
          <Button onClick={() => refetch()} variant="default" size="default">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Bank Accounts</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Manage your bank accounts</p>
        </div>
        <Button
          onClick={handleAddNew}
          variant="default"
          size="default"
          className="flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Add Bank Account
        </Button>
      </div>

      {/* Cash opening balance (GL) — account 1000 */}
      {cashCheckError?.status === 404 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Cash account (1000) is missing from Chart of Accounts. Add it under Chart of Accounts to enable cash opening.
        </div>
      ) : cashCheckError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          Could not load cash account (1000). You need permission to view Chart of Accounts, or the server returned an
          error.
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex shrink-0 items-center justify-center bg-emerald-50 px-4 py-5 lg:w-20">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <Wallet className="h-6 w-6" aria-hidden />
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <h2 className="text-base font-semibold text-gray-900">Cash opening balance (GL)</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Starting cash on hand for account 1000. This updates Chart of Accounts and posts a double-entry journal
                (cash vs retained earnings), like bank opening. Use zero to clear the posted opening.
              </p>
              <p className="text-xs text-gray-500">
                Current GL balance (after movements):{' '}
                <span className="font-semibold text-gray-800">
                  {cashGlFetching && !cashGl
                    ? '…'
                    : `${Number(cashGl?.calculatedBalance ?? 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                </span>
                {cashGl?.accountName ? ` — ${cashGl.accountName}` : ''}
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end lg:w-auto lg:min-w-[320px]">
              <div className="flex-1 space-y-1">
                <label htmlFor="cash-opening-amount" className="text-xs font-medium text-gray-600">
                  Opening amount
                </label>
                <Input
                  id="cash-opening-amount"
                  type="text"
                  inputMode="decimal"
                  value={cashOpeningInput}
                  onChange={(e) => setCashOpeningInput(e.target.value)}
                  disabled={!cashGl?.id || cashGlFetching}
                  className="w-full"
                  placeholder="0.00"
                />
              </div>
              <div className="flex gap-2 sm:pb-0.5">
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={() => refetchCashGl()}
                  disabled={cashGlFetching}
                >
                  Refresh
                </Button>
                <LoadingButton
                  type="button"
                  variant="default"
                  size="default"
                  isLoading={savingCashOpening}
                  onClick={handleSaveCashOpening}
                  disabled={!cashGl?.id || cashGlFetching}
                  className="whitespace-nowrap"
                >
                  Save cash opening
                </LoadingButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search banks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Banks List */}
      {filteredBanks.length === 0 ? (
        <div className="card text-center py-12">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No banks found</h3>
          <p className="mt-2 text-gray-500">
            {searchTerm ? 'Try adjusting your search terms' : 'Get started by adding your first bank account'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bank Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Opening Balance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Routing Number
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBanks.map((bank) => (
                  <tr key={bank.id || bank._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {bank.isActive !== false ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Building2 className="h-4 w-4 text-blue-600 mr-2" />
                        <span className="text-sm font-medium text-gray-900">{bank.bankName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{bank.accountName}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{bank.accountNumber}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 capitalize">{bank.accountType || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{bank.branchName || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-green-600">
                        {(bank.openingBalance || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{bank.routingNumber || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(bank)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(bank)}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                          disabled={false}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showModal && (
        <BankFormModal
          bank={editingBank}
          onSave={handleSave}
          onCancel={() => {
            setShowModal(false);
            setEditingBank(null);
          }}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={confirmation.isOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        itemName={confirmation.message?.match(/"([^"]*)"/)?.[1] || ''}
        itemType="Bank Account"
        isLoading={false}
      />
    </div>
  );
};

export default Banks;

