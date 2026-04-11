import React, { useState, useEffect, useMemo } from 'react';
import BaseModal from './BaseModal';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { Building, Mail, Phone } from 'lucide-react';
import {
  useLazyCheckEmailQuery,
  useLazyCheckBusinessNameQuery,
} from '../store/services/customersApi';
import { useGetAccountsQuery } from '../store/services/chartOfAccountsApi';
import { useGetActiveCitiesQuery, useCreateCityMutation } from '../store/services/citiesApi';
import { LoadingInline } from './LoadingSpinner';
import toast from 'react-hot-toast';

const defaultCustomerValues = {
  name: '',
  email: '',
  phone: '',
  businessName: '',
  businessType: 'wholesale',
  customerTier: 'bronze',
  creditLimit: 0,
  openingBalance: 0,
  status: 'active',
  ledgerAccount: '',
  addresses: [{
    type: 'both',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
    isDefault: true
  }]
};

export const CustomerFormModal = ({ customer, onSave, onCancel, isSubmitting }) => {
  const { register, handleSubmit, formState: { errors }, reset, setValue, watch, setError, clearErrors } = useForm({
    defaultValues: defaultCustomerValues
  });

  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [cityFormData, setCityFormData] = useState({
    name: '',
    state: '',
    country: 'US',
    description: '',
    isActive: true
  });
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [businessNameChecking, setBusinessNameChecking] = useState(false);
  const [businessNameExists, setBusinessNameExists] = useState(false);
  const [triggerCheckEmail] = useLazyCheckEmailQuery();
  const [triggerCheckBusiness] = useLazyCheckBusinessNameQuery();
  const [createCity, { isLoading: creatingCity }] = useCreateCityMutation();

  const addresses = watch('addresses') || defaultCustomerValues.addresses;
  const emailValue = watch('email');
  const businessNameValue = watch('businessName');

  useEffect(() => {
    if (!emailValue || emailValue.trim() === '') {
      setEmailExists(false);
      clearErrors('email');
      return;
    }

    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    if (!emailRegex.test(emailValue)) {
      setEmailExists(false);
      return;
    }

    if (customer && customer.email && customer.email.toLowerCase() === emailValue.toLowerCase()) {
      setEmailExists(false);
      clearErrors('email');
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setEmailChecking(true);
        const excludeId = customer?._id || null;
        const response = await triggerCheckEmail({ email: emailValue, excludeId }).unwrap();
        const exists = response?.data?.exists ?? response?.exists;
        if (exists) {
          setEmailExists(true);
          setError('email', {
            type: 'manual',
            message: 'Email already exists'
          });
        } else {
          setEmailExists(false);
          clearErrors('email');
        }
      } catch (error) {
        setEmailExists(false);
      } finally {
        setEmailChecking(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [emailValue, customer, setError, clearErrors, triggerCheckEmail]);

  useEffect(() => {
    if (!businessNameValue || businessNameValue.trim() === '') {
      setBusinessNameExists(false);
      clearErrors('businessName');
      return;
    }

    if (customer && customer.businessName && customer.businessName.trim().toLowerCase() === businessNameValue.trim().toLowerCase()) {
      setBusinessNameExists(false);
      clearErrors('businessName');
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setBusinessNameChecking(true);
        const excludeId = customer?._id || null;
        const response = await triggerCheckBusiness({ businessName: businessNameValue, excludeId }).unwrap();
        const exists = response?.data?.exists ?? response?.exists;
        if (exists) {
          setBusinessNameExists(true);
          setError('businessName', {
            type: 'manual',
            message: 'Business name already exists'
          });
        } else {
          setBusinessNameExists(false);
          clearErrors('businessName');
        }
      } catch (error) {
        setBusinessNameExists(false);
      } finally {
        setBusinessNameChecking(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [businessNameValue, customer, setError, clearErrors, triggerCheckBusiness]);

  useEffect(() => {
    if (customer) {
      // Parse address if it's a string (Postgres JSONB)
      let parsedAddress = customer.address;
      if (typeof parsedAddress === 'string') {
        try {
          parsedAddress = JSON.parse(parsedAddress);
        } catch (e) {
          parsedAddress = null;
        }
      }

      // Convert to array format for the form
      const formAddresses = Array.isArray(parsedAddress)
        ? parsedAddress
        : (parsedAddress ? [parsedAddress] : (customer.addresses || defaultCustomerValues.addresses));

      reset({
        ...defaultCustomerValues,
        ...customer,
        businessName: customer.businessName || customer.business_name || '',
        businessType: customer.businessType || customer.business_type || 'wholesale',
        customerTier: customer.customerTier || customer.customer_tier || 'bronze',
        openingBalance: typeof customer.openingBalance === 'number'
          ? customer.openingBalance
          : (customer.opening_balance || customer.pendingBalance || 0),
        creditLimit: customer.creditLimit ?? customer.credit_limit ?? 0,
        ledgerAccount: customer.ledgerAccount?._id || customer.ledgerAccount || customer.ledger_account_id || '',
        addresses: formAddresses,
        isActive: customer.isActive !== undefined ? customer.isActive : (customer.is_active !== undefined ? customer.is_active : true)
      });
      setEmailExists(false);
      setBusinessNameExists(false);
      clearErrors('email');
      clearErrors('businessName');
    } else {
      reset(defaultCustomerValues);
      setEmailExists(false);
      setBusinessNameExists(false);
      clearErrors('email');
      clearErrors('businessName');
    }
  }, [customer, reset, clearErrors]);

  const handleAddressChange = (index, field, value) => {
    const newAddresses = [...addresses];
    newAddresses[index] = { ...newAddresses[index], [field]: value };
    setValue('addresses', newAddresses, { shouldValidate: false });
  };

  const { data: ledgerAccounts = [], isLoading: ledgerAccountsLoading } = useGetAccountsQuery({
    accountType: 'asset',
    accountCategory: 'current_assets',
    includePartyAccounts: 'true',
    isActive: 'true',
  });

  const { data: citiesResponse, isLoading: citiesLoading, refetch: refetchCities } = useGetActiveCitiesQuery(undefined, {
    refetchOnMountOrArgChange: true, // Refetch when modal opens
  });
  // Extract cities array from response (handle both direct array and object with data property)
  const citiesData = Array.isArray(citiesResponse)
    ? citiesResponse
    : (citiesResponse?.data || []);

  const handleCitySubmit = (e) => {
    e.preventDefault();
    if (!cityFormData.name.trim()) {
      toast.error('City name is required');
      return;
    }
    const newCityName = cityFormData.name.trim();
    createCity(cityFormData)
      .unwrap()
      .then(() => {
        toast.success('City created successfully');
        setIsCityModalOpen(false);
        setCityFormData({
          name: '',
          state: '',
          country: 'US',
          description: '',
          isActive: true
        });
        // Manually refetch cities to ensure the new city appears immediately
        refetchCities().then(() => {
          // After refetch, set the city value if addresses exist
          if (addresses.length > 0) {
            handleAddressChange(0, 'city', newCityName);
          }
        });
      })
      .catch((error) => {
        toast.error(error?.data?.message || 'Failed to create city');
      });
  };

  const ledgerOptions = useMemo(() => {
    if (!Array.isArray(ledgerAccounts)) return [];

    const exactMatch = ledgerAccounts.find((account) => {
      const name = (account.accountName || account.name || '').toLowerCase();
      return name === 'accounts receivable';
    });

    const prioritized = ledgerAccounts.filter((account) => {
      const name = (account.accountName || account.name || '').toLowerCase();
      const tags = Array.isArray(account.tags) ? account.tags : [];
      return (
        name.includes('receivable') ||
        tags.includes('customer') ||
        tags.includes('accounts_receivable') ||
        (account.accountCode && account.accountCode.startsWith('11'))
      );
    });

    const directPosting = ledgerAccounts.filter(
      (account) => account.allowDirectPosting !== false
    );

    let source = [];
    if (exactMatch) {
      source = [exactMatch, ...prioritized.filter(a => a._id !== exactMatch._id && a.id !== exactMatch.id)];
    } else if (prioritized.length > 0) {
      source = prioritized;
    } else if (directPosting.length > 0) {
      source = directPosting;
    } else {
      source = ledgerAccounts;
    }

    return [...source].sort((a, b) => {
      if (exactMatch) {
        if (a._id === exactMatch._id || a.id === exactMatch.id) return -1;
        if (b._id === exactMatch._id || b.id === exactMatch.id) return 1;
      }
      const codeA = (a.accountCode || '').toString();
      const codeB = (b.accountCode || '').toString();
      return codeA.localeCompare(codeB, undefined, { numeric: true });
    });
  }, [ledgerAccounts]);

  useEffect(() => {
    if (ledgerOptions.length > 0) {
      const accountsReceivable = ledgerOptions.find((account) => {
        const name = (account.accountName || account.name || '').toLowerCase();
        return name === 'accounts receivable' || account.accountCode === '1130';
      }) || ledgerOptions[0];

      if (accountsReceivable && (!customer || !customer.ledgerAccount)) {
        const accountId = accountsReceivable._id || accountsReceivable.id;
        if (accountId) {
          setValue('ledgerAccount', accountId, { shouldValidate: false });
        }
      }
    }
  }, [customer, ledgerOptions, setValue]);

  const onSubmit = (data) => {
    if (emailExists) {
      toast.error('Please use a different email address');
      return;
    }
    if (businessNameExists) {
      toast.error('Please use a different business name');
      return;
    }
    onSave(data);
    reset(defaultCustomerValues);
    setEmailExists(false);
    setBusinessNameExists(false);
  };

  return (
    <BaseModal
      isOpen={true}
      onClose={onCancel}
      title={customer ? 'Edit Customer' : 'Add New Customer'}
      maxWidth="2xl"
      variant="scrollable"
      contentClassName="p-3 pt-4 pb-3 sm:px-5 sm:pt-5 sm:pb-4 xl:px-6 xl:pt-5 xl:pb-4"
      headerClassName="p-3 sm:p-4 xl:p-5"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 xl:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 xl:gap-4">
          <div className="min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
              Business Name *
            </label>
            <div className="relative">
              <Building className="absolute left-2 xl:left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 xl:h-4 xl:w-4 text-gray-400" />
              <input
                {...register('businessName', { required: 'Business name is required' })}
                autoComplete="off"
                className={`input pl-10 w-full ${businessNameExists ? 'border-red-500' : ''}`}
                placeholder="Enter business name"
              />
              {businessNameChecking && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <LoadingInline size="sm" />
                </div>
              )}
            </div>
            {errors.businessName && (
              <p className="text-red-500 text-xs sm:text-sm mt-0.5 sm:mt-1">{errors.businessName.message}</p>
            )}
            {businessNameExists && !errors.businessName && (
              <p className="text-red-500 text-xs sm:text-sm mt-0.5 sm:mt-1">Business name already exists</p>
            )}
          </div>
          <div className="min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Person *
            </label>
            <input
              {...register('name', { required: 'Contact person is required' })}
              autoComplete="off"
              className="input w-full"
              placeholder="Enter contact person name"
            />
            {errors.name && (
              <p className="text-red-500 text-xs sm:text-sm mt-0.5 sm:mt-1">{errors.name.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 xl:gap-4">
          <div className="min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-2 xl:left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 xl:h-4 xl:w-4 text-gray-400" />
              <input
                {...register('email', {
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address'
                  }
                })}
                type="text"
                autoComplete="off"
                className={`input pl-8 xl:pl-10 text-sm min-h-[2rem] xl:min-h-0 ${emailExists ? 'border-red-500' : ''}`}
                placeholder="Enter email address (optional)"
              />
              {emailChecking && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <LoadingInline size="sm" />
                </div>
              )}
            </div>
            {errors.email && (
              <p className="text-red-500 text-xs sm:text-sm mt-0.5 sm:mt-1">{errors.email.message}</p>
            )}
            {emailExists && !errors.email && (
              <p className="text-red-500 text-xs sm:text-sm mt-0.5 sm:mt-1">Email already exists</p>
            )}
          </div>
          <div className="min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
              Phone
            </label>
            <div className="relative">
              <Phone className="absolute left-2 xl:left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 xl:h-4 xl:w-4 text-gray-400" />
              <input
                {...register('phone')}
                type="tel"
                autoComplete="off"
                className="input pl-8 xl:pl-10 text-sm min-h-[2rem] xl:min-h-0"
                placeholder="Enter phone number"
              />
            </div>
          </div>
          <div className="min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
              Business Type
            </label>
            <select {...register('businessType')} className="input text-sm min-h-[2rem] xl:min-h-0">
              <option value="individual">Individual</option>
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
              <option value="distributor">Distributor</option>
            </select>
          </div>
          <div className="min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
              Customer Tier
            </label>
            <select {...register('customerTier')} className="input text-sm min-h-[2rem] xl:min-h-0">
              <option value="bronze">Bronze</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="platinum">Platinum</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 xl:gap-4">
          <div className="min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
              Credit Limit
            </label>
            <input
              {...register('creditLimit', {
                valueAsNumber: true,
                min: { value: 0, message: 'Credit limit must be positive' }
              })}
              type="number"
              step="0.01"
              autoComplete="off"
              className="input text-sm min-h-[2rem] xl:min-h-0"
              placeholder="0.00"
            />
            {errors.creditLimit && (
              <p className="text-red-500 text-xs sm:text-sm mt-0.5 sm:mt-1">{errors.creditLimit.message}</p>
            )}
          </div>

          <div className="min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
              Opening Balance
            </label>
            <input
              {...register('openingBalance', { valueAsNumber: true })}
              type="number"
              step="0.01"
              autoComplete="off"
              className="input text-sm min-h-[2rem] xl:min-h-0"
              placeholder="0.00"
            />
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 break-words">
              Positive = customer owes you. Negative = you owe them.
            </p>
          </div>
          <div className="min-w-0">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
              Status
            </label>
            <select {...register('status')} className="input text-sm min-h-[2rem] xl:min-h-0">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        <div>
          <h3 className="text-base xl:text-lg font-medium text-gray-900 mb-3 xl:mb-4">Address</h3>
          <div className="space-y-3 xl:space-y-4">
            {addresses.map((address, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3 xl:p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 xl:gap-4">
                  <div className="min-w-0">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Street Address
                    </label>
                    <input
                      type="text"
                      autoComplete="off"
                      value={address.street || ''}
                      onChange={(e) => handleAddressChange(index, 'street', e.target.value)}
                      className="input text-sm min-h-[2rem] xl:min-h-0"
                      placeholder="123 Main St"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      City *
                    </label>
                    <select
                      value={address.city || ''}
                      onChange={(e) => handleAddressChange(index, 'city', e.target.value)}
                      className="input text-sm min-h-[2rem] xl:min-h-0"
                      required
                      disabled={citiesLoading}
                    >
                      <option value="">Select a city</option>
                      {Array.isArray(citiesData) && citiesData.map((city) => (
                        <option key={city._id || city.name} value={city.name}>
                          {city.name}{city.state ? `, ${city.state}` : ''}
                        </option>
                      ))}
                    </select>
                    {citiesLoading && (
                      <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">Loading cities...</p>
                    )}
                    {!citiesLoading && Array.isArray(citiesData) && citiesData.length === 0 && (
                      <p className="text-[10px] sm:text-xs text-amber-600 mt-0.5 sm:mt-1">
                        No cities available. Please add cities first.
                      </p>
                    )}
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      value={address.state || ''}
                      autoComplete="off"
                      onChange={(e) => handleAddressChange(index, 'state', e.target.value)}
                      className="input text-sm min-h-[2rem] xl:min-h-0"
                      placeholder="State"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      value={address.zipCode || ''}
                      autoComplete="off"
                      onChange={(e) => handleAddressChange(index, 'zipCode', e.target.value)}
                      className="input text-sm min-h-[2rem] xl:min-h-0"
                      placeholder="12345"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <input type="hidden" {...register('ledgerAccount')} />
        <div className="flex flex-wrap justify-end gap-2 xl:gap-3 pt-4 xl:pt-6 border-t border-gray-200">
          <Button
            type="button"
            onClick={onCancel}
            variant="secondary"
            size="default"
            disabled={isSubmitting}
            className="flex-shrink-0"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="default"
            size="default"
            disabled={isSubmitting}
            className="flex-shrink-0"
          >
            {isSubmitting ? 'Saving...' : (customer ? 'Update Customer' : 'Add Customer')}
          </Button>
        </div>
      </form>

      {isCityModalOpen && (
        <BaseModal
          isOpen={true}
          onClose={() => {
            setIsCityModalOpen(false);
            setCityFormData({
              name: '',
              state: '',
              country: 'US',
              description: '',
              isActive: true
            });
          }}
          title="Add New City"
          maxWidth="md"
          variant="centered"
          zIndex={60}
          contentClassName="p-6"
        >
          <form onSubmit={handleCitySubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City Name *
              </label>
              <input
                type="text"
                value={cityFormData.name}
                autoComplete="off"
                onChange={(e) => setCityFormData({ ...cityFormData, name: e.target.value })}
                className="input"
                placeholder="Enter city name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State
              </label>
              <input
                type="text"
                value={cityFormData.state}
                autoComplete="off"
                onChange={(e) => setCityFormData({ ...cityFormData, state: e.target.value })}
                className="input"
                placeholder="Enter state"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Country
              </label>
              <input
                type="text"
                value={cityFormData.country}
                autoComplete="off"
                onChange={(e) => setCityFormData({ ...cityFormData, country: e.target.value })}
                className="input"
                placeholder="Enter country"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="cityIsActive"
                checked={cityFormData.isActive}
                onChange={(e) => setCityFormData({ ...cityFormData, isActive: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="cityIsActive" className="ml-2 block text-sm text-gray-700">
                Active
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setIsCityModalOpen(false);
                  setCityFormData({
                    name: '',
                    state: '',
                    country: 'US',
                    description: '',
                    isActive: true
                  });
                }}
                className="btn btn-secondary"
                disabled={creatingCity}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={creatingCity}
              >
                {creatingCity ? 'Adding...' : 'Add City'}
              </button>
            </div>
          </form>
        </BaseModal>
      )}
    </BaseModal>
  );
};

