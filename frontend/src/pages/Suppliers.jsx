import React, { useEffect, useMemo, useState } from 'react';
import BaseModal from '../components/BaseModal';
import {
  Building,
  Plus,
  Search,
  Edit,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Star,
  Clock,
  TrendingUp,
  User,
  MessageSquare
} from 'lucide-react';
import { useFuzzySearch } from '../hooks/useFuzzySearch';
import { toast } from 'sonner';
import { LoadingSpinner, LoadingButton, LoadingCard, LoadingGrid, LoadingPage, LoadingInline } from '../components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import SupplierImportExport from '../components/SupplierImportExport';
import SupplierFilters from '../components/SupplierFilters';
import NotesPanel from '../components/NotesPanel';
import {
  useGetSuppliersQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useDeleteSupplierMutation,
  useLazyCheckEmailQuery,
  useLazyCheckCompanyNameQuery,
  useLazyCheckContactNameQuery,
} from '../store/services/suppliersApi';
import { useGetAccountsQuery } from '../store/services/chartOfAccountsApi';
import { useGetCitiesQuery, useGetActiveCitiesQuery } from '../store/services/citiesApi';


const supplierDefaultValues = {
  companyName: '',
  contactPerson: {
    name: '',
    title: ''
  },
  email: '',
  phone: '',
  website: '',
  businessType: 'wholesaler',
  paymentTerms: 'net30',
  creditLimit: 0,
  openingBalance: 0,
  rating: 3,
  reliability: 'average',
  minOrderAmount: 0,
  minOrderQuantity: 1,
  leadTime: 7,
  status: 'active',
  notes: '',
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

const SupplierForm = ({ supplier, onSave, onCancel, isOpen, isSubmitting }) => {
  const [formData, setFormData] = useState(() => ({ ...supplierDefaultValues }));
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [companyNameChecking, setCompanyNameChecking] = useState(false);
  const [companyNameExists, setCompanyNameExists] = useState(false);
  const [contactNameChecking, setContactNameChecking] = useState(false);
  const [contactNameExists, setContactNameExists] = useState(false);

  const [triggerCheckEmail] = useLazyCheckEmailQuery();
  const [triggerCheckCompany] = useLazyCheckCompanyNameQuery();
  const [triggerCheckContact] = useLazyCheckContactNameQuery();

  const { data: ledgerAccounts = [], isLoading: ledgerAccountsLoading } = useGetAccountsQuery({
    accountType: 'liability',
    accountCategory: 'current_liabilities',
    includePartyAccounts: 'true',
    isActive: 'true',
  });

  const { data: citiesResponse, isLoading: citiesLoading } = useGetActiveCitiesQuery();
  // Extract cities array from response (handle both direct array and object with data property)
  const citiesData = Array.isArray(citiesResponse)
    ? citiesResponse
    : (citiesResponse?.data || []);

  const ledgerOptions = useMemo(() => {
    if (!Array.isArray(ledgerAccounts)) return [];

    const prioritized = ledgerAccounts.filter((account) => {
      const name = (account.accountName || account.name || '').toLowerCase();
      const tags = Array.isArray(account.tags) ? account.tags : [];
      return (
        name.includes('payable') ||
        tags.includes('supplier') ||
        tags.includes('accounts_payable') ||
        (account.accountCode && account.accountCode.startsWith('21'))
      );
    });

    const directPosting = ledgerAccounts.filter(
      (account) => account.allowDirectPosting !== false
    );

    const source =
      prioritized.length > 0
        ? prioritized
        : directPosting.length > 0
          ? directPosting
          : ledgerAccounts;

    return [...source].sort((a, b) => {
      const codeA = (a.accountCode || '').toString();
      const codeB = (b.accountCode || '').toString();
      return codeA.localeCompare(codeB, undefined, { numeric: true });
    });
  }, [ledgerAccounts]);

  // Auto-link to Accounts Payable account
  useEffect(() => {
    if (ledgerOptions.length > 0) {
      // Explicitly look for "Accounts Payable" first (by name or code 2110)
      const accountsPayable = ledgerOptions.find((account) => {
        const name = (account.accountName || account.name || '').toLowerCase();
        return name === 'accounts payable' || account.accountCode === '2110';
      }) || ledgerOptions[0];

      if (supplier) {
        const derivedOpeningBalance =
          typeof supplier.openingBalance === 'number'
            ? supplier.openingBalance
            : supplier.pendingBalance && supplier.pendingBalance > 0
              ? supplier.pendingBalance
              : supplier.advanceBalance
                ? -supplier.advanceBalance
                : 0;

        // Normalize addresses: API returns address (object/array) or addresses (array)
        const rawAddress = supplier.address || supplier.addresses;
        let addresses = supplierDefaultValues.addresses;
        if (Array.isArray(rawAddress) && rawAddress.length > 0) {
          addresses = rawAddress.map((a) => ({
            type: a.type || 'both',
            street: a.street || '',
            city: a.city || '',
            state: a.state || '',
            zipCode: a.zipCode || '',
            country: a.country || 'US',
            isDefault: a.isDefault ?? (a === rawAddress[0])
          }));
        } else if (rawAddress && typeof rawAddress === 'object' && !Array.isArray(rawAddress)) {
          addresses = [{
            type: rawAddress.type || 'both',
            street: rawAddress.street || '',
            city: rawAddress.city || '',
            state: rawAddress.state || '',
            zipCode: rawAddress.zipCode || '',
            country: rawAddress.country || 'US',
            isDefault: true
          }];
        } else if (supplier.addresses?.length) {
          addresses = supplier.addresses;
        }

        setFormData({
          ...supplierDefaultValues,
          ...supplier,
          companyName: supplier.companyName || supplier.company_name || supplier.businessName || '',
          contactPerson: {
            name: supplier.contactPerson?.name || supplier.contact_person || '',
            title: supplier.contactPerson?.title || ''
          },
          addresses,
          openingBalance: derivedOpeningBalance,
          // Use supplier's existing ledger account or auto-link to Accounts Payable
          ledgerAccount: supplier.ledgerAccount?._id || supplier.ledgerAccount || (accountsPayable._id || accountsPayable.id) || ''
        });
      } else {
        // For new supplier, auto-link to Accounts Payable
        const accountId = accountsPayable._id || accountsPayable.id;
        if (accountId) {
          setFormData((prev) => ({
            ...prev,
            ledgerAccount: accountId
          }));
        }
      }
    }
  }, [supplier, ledgerOptions]);

  // Email validation effect
  useEffect(() => {
    // Skip validation if email is empty or invalid format
    if (!formData.email || formData.email.trim() === '') {
      setEmailExists(false);
      return;
    }

    // Basic email format validation
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    if (!emailRegex.test(formData.email)) {
      setEmailExists(false);
      return;
    }

    // Skip check if editing and email hasn't changed
    if (supplier && supplier.email && supplier.email.toLowerCase() === formData.email.toLowerCase()) {
      setEmailExists(false);
      return;
    }

    // Debounce email check
    const timeoutId = setTimeout(async () => {
      try {
        setEmailChecking(true);
        const excludeId = supplier?._id || null;
        const response = await triggerCheckEmail({ email: formData.email, excludeId }).unwrap();
        const exists = response?.data?.exists ?? response?.exists;
        setEmailExists(!!exists);
      } catch (error) {
        // Silently fail - email check is optional validation
        setEmailExists(false);
      } finally {
        setEmailChecking(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [formData.email, supplier]);

  // Company name validation effect
  useEffect(() => {
    // Skip validation if company name is empty
    if (!formData.companyName || formData.companyName.trim() === '') {
      setCompanyNameExists(false);
      return;
    }

    // Skip check if editing and company name hasn't changed
    if (supplier && supplier.companyName && supplier.companyName.trim().toLowerCase() === formData.companyName.trim().toLowerCase()) {
      setCompanyNameExists(false);
      return;
    }

    // Debounce company name check
    const timeoutId = setTimeout(async () => {
      try {
        setCompanyNameChecking(true);
        const excludeId = supplier?._id || null;
        const response = await triggerCheckCompany({ companyName: formData.companyName, excludeId }).unwrap();
        const exists = response?.data?.exists ?? response?.exists;
        setCompanyNameExists(!!exists);
      } catch (error) {
        // Silently fail - company name check is optional validation
        setCompanyNameExists(false);
      } finally {
        setCompanyNameChecking(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [formData.companyName, supplier]);

  // Contact name validation effect
  useEffect(() => {
    // Skip validation if contact name is empty
    if (!formData.contactPerson?.name || typeof formData.contactPerson.name !== 'string' || formData.contactPerson.name.trim() === '') {
      setContactNameExists(false);
      return;
    }

    // Skip check if editing and contact name hasn't changed
    if (supplier && supplier.contactPerson?.name && supplier.contactPerson.name.trim().toLowerCase() === (formData.contactPerson?.name || '').trim().toLowerCase()) {
      setContactNameExists(false);
      return;
    }

    // Debounce contact name check
    const timeoutId = setTimeout(async () => {
      try {
        setContactNameChecking(true);
        const excludeId = supplier?._id || null;
        const response = await triggerCheckContact({ contactName: formData.contactPerson.name, excludeId }).unwrap();
        const exists = response?.data?.exists ?? response?.exists;
        setContactNameExists(!!exists);
      } catch (error) {
        // Silently fail - contact name check is optional validation
        setContactNameExists(false);
      } finally {
        setContactNameChecking(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [formData.contactPerson?.name, supplier]);

  // Reset validation states when supplier changes
  useEffect(() => {
    setEmailExists(false);
    setCompanyNameExists(false);
    setContactNameExists(false);
  }, [supplier]);

  const handleSubmit = (e) => {
    e.preventDefault();

    // Client-side validation
    if (!formData.companyName?.trim()) {
      toast.error('Company name is required');
      return;
    }
    if (!formData.contactPerson?.name?.trim()) {
      toast.error('Contact name is required');
      return;
    }

    // Prevent submission if duplicates exist
    if (emailExists) {
      toast.error('Please use a different email address');
      return;
    }
    if (companyNameExists) {
      toast.error('Please use a different company name');
      return;
    }
    if (contactNameExists) {
      toast.error('Please use a different contact name');
      return;
    }

    onSave({
      ...formData,
      creditLimit: parseFloat(formData.creditLimit) || 0,
      openingBalance: parseFloat(formData.openingBalance) || 0
    });
  };

  const handleAddressChange = (index, field, value) => {
    const newAddresses = [...formData.addresses];
    newAddresses[index] = { ...newAddresses[index], [field]: value };
    setFormData({ ...formData, addresses: newAddresses });
  };

  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onCancel}
      title={supplier ? 'Edit Supplier' : 'Add New Supplier'}
      maxWidth="2xl"
      variant="scrollable"
      contentClassName="p-3 pt-4 pb-3 sm:px-5 sm:pt-5 sm:pb-4 xl:px-6 xl:pt-5 xl:pb-4"
      headerClassName="p-3 sm:p-4 xl:p-5"
    >
      <form onSubmit={handleSubmit} className="space-y-4 xl:space-y-6">
            {/* Company Name + Contact Person */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 xl:gap-4">
              <div className="min-w-0">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Company Name *
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    required
                    autoComplete="off"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className={`text-sm min-h-[2rem] xl:min-h-0 ${companyNameExists ? 'border-red-500' : ''}`}
                    placeholder="Enter company name"
                  />
                  {companyNameChecking && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <LoadingInline size="sm" />
                    </div>
                  )}
                </div>
                {companyNameExists && (
                  <p className="text-red-500 text-xs sm:text-sm mt-0.5 sm:mt-1">Company name already exists</p>
                )}
              </div>
              <div className="min-w-0">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Contact Person *
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    required
                    autoComplete="off"
                    value={formData.contactPerson?.name || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      contactPerson: { ...(formData.contactPerson || {}), name: e.target.value }
                    })}
                    className={`text-sm min-h-[2rem] xl:min-h-0 ${contactNameExists ? 'border-red-500' : ''}`}
                    placeholder="Enter full name"
                  />
                  {contactNameChecking && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <LoadingInline size="sm" />
                    </div>
                  )}
                </div>
                {contactNameExists && (
                  <p className="text-red-500 text-xs sm:text-sm mt-0.5 sm:mt-1">Contact name already exists</p>
                )}
              </div>
            </div>

            {/* Email, Phone, Business Type, Payment Terms */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 xl:gap-4">
                <div className="min-w-0">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Input
                      type="email"
                      autoComplete="off"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`text-sm min-h-[2rem] xl:min-h-0 ${emailExists ? 'border-red-500' : ''}`}
                      placeholder="email@company.com (optional)"
                    />
                    {emailChecking && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <LoadingInline size="sm" />
                      </div>
                    )}
                  </div>
                  {emailExists && (
                    <p className="text-red-500 text-xs sm:text-sm mt-0.5 sm:mt-1">Email already exists</p>
                  )}
                </div>
                <div className="min-w-0">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Phone
                  </label>
                  <Input
                    type="tel"
                    autoComplete="off"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="text-sm min-h-[2rem] xl:min-h-0"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Business Type
                  </label>
                  <select
                    value={formData.businessType}
                    onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                    className="input text-sm min-h-[2rem] xl:min-h-0"
                  >
                    <option value="manufacturer">Manufacturer</option>
                    <option value="distributor">Distributor</option>
                    <option value="wholesaler">Wholesaler</option>
                    <option value="dropshipper">Dropshipper</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Payment Terms
                  </label>
                  <select
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                    className="input text-sm min-h-[2rem] xl:min-h-0"
                  >
                    <option value="cash">Cash</option>
                    <option value="net15">Net 15</option>
                    <option value="net30">Net 30</option>
                    <option value="net45">Net 45</option>
                    <option value="net60">Net 60</option>
                    <option value="net90">Net 90</option>
                  </select>
                </div>
              </div>

            {/* Credit Limit, Opening Balance, Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 xl:gap-4">
                <div className="min-w-0">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Credit Limit
                  </label>
                  <Input
                    type="number"
                    min="0"
                    autoComplete="off"
                    value={formData.creditLimit}
                    onChange={(e) => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })}
                    className="text-sm min-h-[2rem] xl:min-h-0"
                    placeholder="0"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Opening Balance
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    autoComplete="off"
                    value={formData.openingBalance}
                    onChange={(e) => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
                    className="text-sm min-h-[2rem] xl:min-h-0"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-0.5 sm:mt-1">
                    Positive = you owe supplier. Negative = advance/credit.
                  </p>
                </div>
                <div className="min-w-0">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="input text-sm min-h-[2rem] xl:min-h-0"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                    <option value="blacklisted">Blacklisted</option>
                  </select>
                </div>
              </div>

            {/* Website, Lead Time, Min Order, Rating, Reliability */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 xl:gap-4">
                <div className="min-w-0">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Website</label>
                  <Input
                    type="url"
                    autoComplete="off"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="text-sm min-h-[2rem] xl:min-h-0"
                    placeholder="https://company.com"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Lead Time (days)</label>
                  <Input
                    type="number"
                    min="0"
                    autoComplete="off"
                    value={formData.leadTime}
                    onChange={(e) => setFormData({ ...formData, leadTime: parseInt(e.target.value) || 0 })}
                    className="text-sm min-h-[2rem] xl:min-h-0"
                    placeholder="7"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Min Order Amount</label>
                  <Input
                    type="number"
                    min="0"
                    autoComplete="off"
                    value={formData.minOrderAmount}
                    onChange={(e) => setFormData({ ...formData, minOrderAmount: parseFloat(e.target.value) || 0 })}
                    className="text-sm min-h-[2rem] xl:min-h-0"
                    placeholder="0"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Rating (1-5)</label>
                  <select
                    value={formData.rating}
                    onChange={(e) => setFormData({ ...formData, rating: parseInt(e.target.value) })}
                    className="input text-sm min-h-[2rem] xl:min-h-0"
                  >
                    <option value={1}>1 Star</option>
                    <option value={2}>2 Stars</option>
                    <option value={3}>3 Stars</option>
                    <option value={4}>4 Stars</option>
                    <option value={5}>5 Stars</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Reliability</label>
                  <select
                    value={formData.reliability}
                    onChange={(e) => setFormData({ ...formData, reliability: e.target.value })}
                    className="input text-sm min-h-[2rem] xl:min-h-0"
                  >
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="average">Average</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
              </div>

            {/* Address */}
            <div>
              <h3 className="text-sm sm:text-base font-medium text-gray-900 mb-3 xl:mb-4">Address</h3>
              <div className="space-y-4">
                {formData.addresses.map((address, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 xl:gap-4">
                      <div className="min-w-0">
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Street Address</label>
                        <Input
                          type="text"
                          autoComplete="off"
                          value={address.street}
                          onChange={(e) => handleAddressChange(index, 'street', e.target.value)}
                          className="text-sm min-h-[2rem] xl:min-h-0"
                          placeholder="123 Main St"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">City *</label>
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
                          <p className="text-xs text-gray-500 mt-1">Loading cities...</p>
                        )}
                        {!citiesLoading && citiesData.length === 0 && (
                          <p className="text-xs text-amber-600 mt-1">
                            No cities available. Please add cities first.
                          </p>
                        )}
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">State</label>
                        <Input
                          type="text"
                          autoComplete="off"
                          value={address.state}
                          onChange={(e) => handleAddressChange(index, 'state', e.target.value)}
                          className="text-sm min-h-[2rem] xl:min-h-0"
                          placeholder="State"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">ZIP Code</label>
                        <Input
                          type="text"
                          autoComplete="off"
                          value={address.zipCode}
                          onChange={(e) => handleAddressChange(index, 'zipCode', e.target.value)}
                          className="text-sm min-h-[2rem] xl:min-h-0"
                          placeholder="12345"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Notes</label>
              <Textarea
                value={formData.notes}
                autoComplete="off"
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="text-sm min-h-[2rem] xl:min-h-0"
                placeholder="Additional notes about this supplier..."
              />
            </div>

            {/* Form Actions */}
            <div className="flex flex-wrap justify-end gap-2 xl:gap-3 pt-4 xl:pt-6 border-t border-gray-200">
              <Button
                type="button"
                onClick={onCancel}
                variant="secondary"
                className="flex-shrink-0"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                className="flex-shrink-0"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : (supplier ? 'Update Supplier' : 'Add Supplier')}
              </Button>
            </div>
      </form>
    </BaseModal>
  );
};

const LIMIT_OPTIONS = [50, 500, 1000, 5000];
const DEFAULT_LIMIT = 50;

export const Suppliers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_LIMIT);
  const [filters, setFilters] = useState({});
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notesEntity, setNotesEntity] = useState(null);

  const queryParams = {
    search: searchTerm || undefined,
    page: currentPage,
    limit: itemsPerPage,
    ...filters
  };

  const { data: suppliers, isLoading, error, refetch } = useGetSuppliersQuery(queryParams, {
    refetchOnMountOrArgChange: true,
  });

  const [createSupplier, { isLoading: creating }] = useCreateSupplierMutation();
  const [updateSupplier, { isLoading: updating }] = useUpdateSupplierMutation();
  const [deleteSupplier, { isLoading: deleting }] = useDeleteSupplierMutation();

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleClearFilters = () => {
    setFilters({});
    setSearchTerm('');
  };

  const handleLimitChange = (e) => {
    const val = Number(e.target.value);
    setItemsPerPage(val);
    setCurrentPage(1);
  };

  const allSuppliers = suppliers?.data?.suppliers || suppliers?.suppliers || [];
  const pagination = suppliers?.data?.pagination || suppliers?.pagination || {};
  const filteredSuppliers = useFuzzySearch(
    allSuppliers,
    searchTerm,
    ['companyName', 'contactPerson.name', 'email', 'phone'],
    {
      threshold: 0.4,
      minScore: 0.3,
      limit: null
    }
  );

  const handleSave = (formData) => {
    // Clean and validate form data before sending
    const cleanData = {
      companyName: formData.companyName?.trim(),
      contactPerson: {
        name: formData.contactPerson?.name?.trim(),
        title: formData.contactPerson?.title?.trim()
      },
      email: formData.email?.trim() || undefined,
      phone: formData.phone?.trim() || undefined,
      website: formData.website?.trim() || undefined,
      businessType: formData.businessType,
      paymentTerms: formData.paymentTerms,
      creditLimit: Number(formData.creditLimit) || 0,
      openingBalance: Number(formData.openingBalance) || 0,
      rating: Number(formData.rating) || 3,
      reliability: formData.reliability,
      minOrderAmount: Number(formData.minOrderAmount) || 0,
      minOrderQuantity: Number(formData.minOrderQuantity) || 1,
      leadTime: Number(formData.leadTime) || 7,
      status: formData.status,
      notes: formData.notes?.trim() || undefined,
      addresses: formData.addresses?.map(addr => ({
        type: addr.type,
        street: addr.street?.trim(),
        city: addr.city?.trim(),
        state: addr.state?.trim(),
        zipCode: addr.zipCode?.trim(),
        country: addr.country || 'US',
        isDefault: addr.isDefault || false
      })) || []
    };

    if (selectedSupplier) {
      updateSupplier({ id: selectedSupplier._id, data: cleanData })
        .unwrap()
        .then(() => {
          toast.success('Supplier updated successfully!');
          setIsFormOpen(false);
          setSelectedSupplier(null);
          refetch();
        })
        .catch((error) => {
          toast.error(error?.data?.message || 'Failed to update supplier');
        });
    } else {
      createSupplier(cleanData)
        .unwrap()
        .then(() => {
          toast.success('Supplier created successfully!');
          setIsFormOpen(false);
          setSelectedSupplier(null);
          refetch();
        })
        .catch((error) => {
          const message = error?.data?.message || 'Failed to create supplier';
          const errors = error?.data?.errors;
          if (errors && Array.isArray(errors)) {
            toast.error(`${message}: ${errors.join(', ')}`);
          } else {
            toast.error(message);
          }
        });
    }
  };

  const handleEdit = (supplier) => {
    setSelectedSupplier(supplier);
    setIsFormOpen(true);
  };

  const handleDelete = (supplier) => {
    if (window.confirm(`Are you sure you want to delete ${supplier.companyName}?`)) {
      deleteSupplier(supplier._id)
        .unwrap()
        .then(() => {
          toast.success('Supplier deleted successfully!');
          refetch();
        })
        .catch((error) => {
          toast.error(error?.data?.message || 'Failed to delete supplier');
        });
    }
  };

  const handleAddNew = () => {
    setSelectedSupplier(null);
    setIsFormOpen(true);
  };


  return (
    <div className="space-y-4 xl:space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Manage your supplier relationships and information</p>
        </div>
        <div className="flex-shrink-0 w-full sm:w-auto">
          <Button
            onClick={handleAddNew}
            variant="default"
            size="default"
            className="flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Add Supplier
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 relative min-w-0">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search suppliers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <label htmlFor="suppliers-limit" className="text-sm text-gray-600 whitespace-nowrap">Show:</label>
          <select
            id="suppliers-limit"
            value={itemsPerPage}
            onChange={handleLimitChange}
            className="input text-sm py-2 pr-8 pl-3 min-w-[80px]"
          >
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Import/Export Section */}
      <SupplierImportExport
        onImportComplete={() => queryClient.invalidateQueries('suppliers')}
        filters={{ ...queryParams, limit: 999999, page: 1 }}
      />

      {/* Advanced Filters */}
      <SupplierFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
      />

      {/* Suppliers Grid */}
      {isLoading ? (
        <LoadingGrid count={6} />
      ) : error ? (
        <div className="card">
          <div className="card-content text-center py-12">
            <Building className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">Error loading suppliers</h3>
            <p className="mt-2 text-gray-600">{error.message}</p>
          </div>
        </div>
      ) : filteredSuppliers.length > 0 ? (
        <div className="card w-full min-w-0 overflow-hidden">
          <div className="card-content p-0 w-full min-w-0 overflow-x-auto">
            {/* Table Header - Hidden on mobile/tablet */}
            <div className="hidden lg:block bg-gray-50 px-4 xl:px-8 py-3 xl:py-4 border-b border-gray-200 min-w-[880px]">
              <div className="grid grid-cols-12 gap-3 xl:gap-6 items-center">
                <div className="col-span-4">
                  <h3 className="text-sm lg:text-base font-medium text-gray-700">Company Name</h3>
                  <p className="text-xs lg:text-sm text-gray-500">Contact Person</p>
                </div>
                <div className="col-span-2">
                  <h3 className="text-sm lg:text-base font-medium text-gray-700">Email</h3>
                </div>
                <div className="col-span-1">
                  <h3 className="text-sm lg:text-base font-medium text-gray-700">Phone</h3>
                </div>
                <div className="col-span-1">
                  <h3 className="text-sm lg:text-base font-medium text-gray-700">Status</h3>
                </div>
                <div className="col-span-1">
                  <h3 className="text-sm lg:text-base font-medium text-gray-700">Type</h3>
                </div>
                <div className="col-span-1">
                  <h3 className="text-sm lg:text-base font-medium text-gray-700">Rating</h3>
                </div>
                <div className="col-span-1">
                  <h3 className="text-sm lg:text-base font-medium text-gray-700">Credit</h3>
                </div>
                <div className="col-span-1">
                  <h3 className="text-sm lg:text-base font-medium text-gray-700">Actions</h3>
                </div>
              </div>
            </div>

            {/* Supplier Rows */}
            <div className="divide-y divide-gray-200">
              {filteredSuppliers.map((supplier) => (
                <div key={supplier._id} className="px-4 py-4 lg:px-8 lg:py-6 hover:bg-gray-50">
                  {/* Mobile Card Layout */}
                  <div className="md:hidden space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <Building className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-medium text-gray-900 truncate">
                            {supplier.companyName || supplier.company_name || supplier.businessName || '-'}
                          </h3>
                          <p className="text-xs text-gray-500 truncate">
                            {supplier.contactPerson?.name || supplier.contact_person || '-'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-2">
                        <button
                          onClick={() => {
                            setNotesEntity({ type: 'Supplier', id: supplier._id, name: supplier.companyName || supplier.company_name || supplier.businessName || 'Supplier' });
                            setShowNotes(true);
                          }}
                          className="text-green-600 hover:text-green-800 p-1"
                          title="Notes"
                        >
                          <MessageSquare className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleEdit(supplier)}
                          className="text-primary-600 hover:text-primary-800 p-1"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(supplier)}
                          className="text-danger-600 hover:text-danger-800 p-1"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-gray-500 mb-1">Email</p>
                        <p className="text-gray-700 truncate">{supplier.email || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Phone</p>
                        <p className="text-gray-700">{supplier.phone || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Status</p>
                        <span className={`badge ${supplier.status === 'active' ? 'badge-success' :
                          supplier.status === 'inactive' ? 'badge-gray' :
                            supplier.status === 'suspended' ? 'badge-danger' : 'badge-gray'
                          }`}>
                          {supplier.status}
                        </span>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Type</p>
                        <span className={`badge ${supplier.businessType === 'wholesaler' ? 'badge-info' : 'badge-gray'
                          }`}>
                          {supplier.businessType || supplier.supplier_type || 'other'}
                        </span>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Rating</p>
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${i < supplier.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                                }`}
                            />
                          ))}
                          <span className="ml-1 text-xs text-gray-600">({supplier.rating ?? 3})</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Credit</p>
                        <p className="text-gray-700">{Math.round(supplier.creditLimit || 0)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Desktop Table Layout */}
                  <div className="hidden lg:grid grid-cols-12 gap-3 xl:gap-6 items-center min-w-[880px]">
                    {/* Company Name & Contact Person */}
                    <div className="col-span-4">
                      <div className="flex items-center space-x-3 lg:space-x-4">
                        <Building className="h-5 w-5 lg:h-6 lg:w-6 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <h3 className="text-sm lg:text-base font-medium text-gray-900 truncate">
                            {supplier.companyName || supplier.company_name || supplier.businessName || '-'}
                          </h3>
                          <p className="text-xs lg:text-sm text-gray-500 truncate">
                            {supplier.contactPerson?.name || supplier.contact_person || '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Email */}
                    <div className="col-span-2">
                      <p className="text-xs lg:text-sm text-gray-600 truncate">{supplier.email || '-'}</p>
                    </div>

                    {/* Phone */}
                    <div className="col-span-1">
                      <p className="text-xs lg:text-sm text-gray-600">{supplier.phone || '-'}</p>
                    </div>

                    {/* Status */}
                    <div className="col-span-1">
                      <span className={`badge ${supplier.status === 'active' ? 'badge-success' :
                        supplier.status === 'inactive' ? 'badge-gray' :
                          supplier.status === 'suspended' ? 'badge-danger' : 'badge-gray'
                        }`}>
                        {supplier.status}
                      </span>
                    </div>

                    {/* Type */}
                    <div className="col-span-1">
                      <span className={`badge ${(supplier.businessType || supplier.supplier_type) === 'wholesaler' ? 'badge-info' : 'badge-gray'
                        }`}>
                        {supplier.businessType || supplier.supplier_type || 'other'}
                      </span>
                    </div>

                    {/* Rating */}
                    <div className="col-span-1">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${i < supplier.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                              }`}
                          />
                        ))}
                        <span className="ml-1 text-xs text-gray-600">({supplier.rating})</span>
                      </div>
                    </div>

                    {/* Credit */}
                    <div className="col-span-1">
                      <p className="text-xs lg:text-sm text-gray-600">{Math.round(supplier.creditLimit || 0)}</p>
                    </div>

                    {/* Actions */}
                    <div className="col-span-1">
                      <div className="flex items-center space-x-2 lg:space-x-3">
                        <button
                          onClick={() => {
                            setNotesEntity({ type: 'Supplier', id: supplier._id, name: supplier.companyName || supplier.company_name || supplier.businessName || 'Supplier' });
                            setShowNotes(true);
                          }}
                          className="text-green-600 hover:text-green-800 p-1"
                          title="Notes"
                        >
                          <MessageSquare className="h-4 w-4 lg:h-5 lg:w-5" />
                        </button>
                        <button
                          onClick={() => handleEdit(supplier)}
                          className="text-primary-600 hover:text-primary-800 p-1"
                        >
                          <Edit className="h-4 w-4 lg:h-5 lg:w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(supplier)}
                          className="text-danger-600 hover:text-danger-800 p-1"
                        >
                          <Trash2 className="h-4 w-4 lg:h-5 lg:w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Pagination */}
      {!isLoading && !error && pagination?.pages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Showing{' '}
            <span className="font-medium">
              {((pagination.current || 1) - 1) * (pagination.limit || itemsPerPage) + 1}
            </span>
            {' - '}
            <span className="font-medium">
              {Math.min((pagination.current || 1) * (pagination.limit || itemsPerPage), pagination.total || 0)}
            </span>
            {' of '}
            <span className="font-medium">{pagination.total || 0}</span>
            {' suppliers'}
          </p>
          <nav className="flex items-center gap-2">
            <Button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={!(pagination.hasPrev)}
              variant="outline"
              size="sm"
              className="disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600 px-2">
              Page {pagination.current || 1} of {pagination.pages || 1}
            </span>
            <Button
              onClick={() => setCurrentPage((p) => Math.min(pagination.pages || 1, p + 1))}
              disabled={!(pagination.hasNext)}
              variant="outline"
              size="sm"
              className="disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </Button>
          </nav>
        </div>
      )}

      {!isLoading && !error && filteredSuppliers.length === 0 && (
        <div className="card">
          <div className="card-content text-center py-12">
            <Building className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No suppliers found</h3>
            <p className="mt-2 text-gray-600">
              {searchTerm
                ? 'Try adjusting your search terms.'
                : 'Get started by adding your first supplier'
              }
            </p>
            {!searchTerm && (
              <Button
                onClick={handleAddNew}
                variant="default"
                className="mt-4"
              >
                Add Your First Supplier
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Supplier Form Modal */}
      <SupplierForm
        supplier={selectedSupplier}
        onSave={handleSave}
        onCancel={() => {
          setIsFormOpen(false);
          setSelectedSupplier(null);
        }}
        isOpen={isFormOpen}
        isSubmitting={creating || updating}
      />

      {/* Notes Panel */}
      {showNotes && notesEntity && (
        <NotesPanel
          entityType={notesEntity.type}
          entityId={notesEntity.id}
          entityName={notesEntity.name}
          onClose={() => {
            setShowNotes(false);
            setNotesEntity(null);
          }}
        />
      )}
    </div>
  );
};
