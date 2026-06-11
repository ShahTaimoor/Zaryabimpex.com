import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Save,
  RotateCcw,
  Printer,
  RefreshCw,
  Search,
  Banknote,
  Users,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { showSuccessToast, showErrorToast, handleApiError } from '../utils/errorHandler';
import { formatCurrency } from '../utils/formatters';
import { 
  useCitiesQuery, 
  useLazyGetCustomersByCitiesQuery 
} from '../store/services/customersApi';
import { useCreateBatchCashReceiptsMutation } from '../store/services/cashReceiptsApi';
import { useGetBanksQuery } from '../store/services/banksApi';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import PrintModal from '../components/PrintModal';
import PrintReportModal from '../components/PrintReportModal';
import PageShell from '../components/PageShell';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingSpinner, LoadingButton, LoadingInline } from '../components/LoadingSpinner';
import { getLocalDateString } from '../utils/dateUtils';
import DateFilter from '../components/DateFilter';
import { getCustomerDisplayName } from '../utils/partyDisplay';
import { toTitleCase } from '../utils/titleCase';

function formatCashReceiptCustomerLabel(customer) {
  if (customer.accountName) return toTitleCase(customer.accountName);
  return getCustomerDisplayName(customer, '—');
}

const crInputClass =
  'h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm shadow-sm transition-colors focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-200';
const crLabelClass =
  'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500';
const crPanelClass = 'rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5 space-y-4';
const crCheckboxBoxClass =
  'h-[18px] w-[18px] shrink-0 rounded-[4px] border-2 border-neutral-400 bg-white shadow-none data-[state=checked]:border-neutral-900 data-[state=checked]:bg-neutral-900 data-[state=checked]:text-white';
const crBtnPrimary =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-neutral-900 bg-neutral-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50';
const crBtnSecondary =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50';

/** Full-row checkbox: click text or box to toggle (black & white). */
function CrCheckboxOption({ label, checked, onCheckedChange, compact = false, whiteBg = false }) {
  const toggle = () => onCheckedChange(!checked);

  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      }}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm transition-colors select-none outline-none focus-visible:ring-2 focus-visible:ring-neutral-400',
        compact ? 'py-2' : 'py-2.5',
        checked
          ? whiteBg
            ? 'border-neutral-900 bg-white text-neutral-900'
            : compact
              ? 'border-neutral-300 bg-neutral-100 text-neutral-900'
              : 'border-neutral-900 bg-neutral-900 text-white'
          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className={crCheckboxBoxClass}
      />
      <span className="pointer-events-none flex-1 leading-snug">{label}</span>
    </div>
  );
}

const CashReceiving = () => {
  const today = getLocalDateString();
  const { companyInfo } = useCompanyInfo();

  // Voucher form state
  const [voucherData, setVoucherData] = useState({
    voucherDate: today,
    voucherNo: '',
  });
  /** Same pattern as Sales: cash | bank (bank:<uuid> in UI) | credit_card | … */
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [selectedBankAccount, setSelectedBankAccount] = useState('');

  // City selection state
  const [cities, setCities] = useState([]);
  const [selectedCities, setSelectedCities] = useState([]);
  const [balanceFilters, setBalanceFilters] = useState({
    positive: true,  // Show positive balances by default
    negative: true,  // Show negative balances by default
    zero: true       // Show zero balances by default
  });
  const [citySearchTerm, setCitySearchTerm] = useState('');

  // Customer grid state
  const [customers, setCustomers] = useState([]);
  const [customerEntries, setCustomerEntries] = useState([]);
  const [fetchCustomersByCities, { data: customersResponse, isFetching: customersLoading }] =
    useLazyGetCustomersByCitiesQuery();

  // Print modal state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printData, setPrintData] = useState(null);
  const [showCustomerListPrint, setShowCustomerListPrint] = useState(false);
  const [customerListPrintData, setCustomerListPrintData] = useState(null);

  // Fetch cities
  const { data: citiesData, isLoading: citiesLoading, error: citiesError } = useCitiesQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  const { data: banksPayload, isLoading: banksLoading } = useGetBanksQuery(
    { isActive: true, all: 'true' },
    { refetchOnMountOrArgChange: true }
  );
  const banksList = useMemo(() => {
    const raw = banksPayload?.data?.banks ?? banksPayload?.banks ?? banksPayload?.data ?? banksPayload;
    return Array.isArray(raw) ? raw : [];
  }, [banksPayload]);

  const activeBanks = useMemo(
    () => banksList.filter((bank) => bank.isActive !== false),
    [banksList]
  );

  useEffect(() => {
    if (paymentMethod !== 'bank' || selectedBankAccount) return;
    const first = activeBanks[0];
    const id = first?._id || first?.id;
    if (id) setSelectedBankAccount(id);
  }, [paymentMethod, selectedBankAccount, activeBanks]);

  // Update cities when data is fetched
  useEffect(() => {
    if (citiesData) {
      const list = citiesData?.data || citiesData || [];
      setCities(list);
    }
  }, [citiesData]);

  // Generate voucher number with date-based format
  // Note: Backend will auto-generate voucherCode, but this provides a preview
  useEffect(() => {
    if (!voucherData.voucherNo) {
      const date = new Date(voucherData.voucherDate || new Date());
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      // Generate a timestamp-based number for uniqueness (last 4 digits of timestamp)
      const timestamp = Date.now();
      const uniqueSuffix = String(timestamp).slice(-4);
      
      setVoucherData(prev => ({
        ...prev,
        voucherNo: `CR-${year}${month}${day}-${uniqueSuffix}`
      }));
    }
  }, [voucherData.voucherNo, voucherData.voucherDate]);

  // Load customers by selected cities
  const loadCustomers = async () => {
    if (selectedCities.length === 0) {
      showErrorToast('Please select at least one city');
      return;
    }

    const citiesParam = selectedCities.join(',');
    // Increase limit to 1000 to ensure all customers are loaded
    fetchCustomersByCities({ cities: citiesParam, showZeroBalance: true, limit: 1000 })
      .unwrap()
      .then((response) => {
        const loadedCustomers = response?.data?.customers || response?.customers || response?.data || response || [];
        setCustomers(loadedCustomers);

        const entries = loadedCustomers.map((customer) => {
          // Calculate net balance (currentBalance) to match account ledger
          // currentBalance = pendingBalance - advanceBalance
          // This matches the account ledger's closingBalance calculation
          const netBalance = customer.currentBalance !== undefined 
            ? customer.currentBalance 
            : (customer.pendingBalance || 0) - (customer.advanceBalance || 0);
          
          // Extract city from customer data - check multiple possible locations
          let customerCity = customer.city || '';
          if (!customerCity) {
            // Check address field which can be a string or object in Postgres
            const rawAddr = customer.address || customer.addresses;
            let addr = rawAddr;
            if (typeof rawAddr === 'string') {
              try {
                addr = JSON.parse(rawAddr);
              } catch (e) {
                addr = null;
              }
            }
            
            if (Array.isArray(addr) && addr.length > 0) {
              const defaultAddr = addr.find(a => a.isDefault) || addr[0];
              customerCity = defaultAddr?.city || '';
            } else if (addr && typeof addr === 'object') {
              customerCity = addr.city || '';
            }
          }
          
          return {
            customerId: customer.id || customer._id,
            accountName: formatCashReceiptCustomerLabel(customer),
            balance: netBalance, // Use net balance to match account ledger
            particular: '',
            amount: '',
            city: customerCity ? toTitleCase(customerCity) : '',
            phone: customer.phone || '',
            name: getCustomerDisplayName(customer, ''),
          };
        });

        setCustomerEntries(entries);
      })
      .catch((error) => {
        handleApiError(error, 'Load customers');
      });
  };

  // Handle city selection toggle
  const handleCityToggle = (city) => {
    setSelectedCities(prev => {
      if (prev.includes(city)) {
        return prev.filter(c => c !== city);
      } else {
        return [...prev, city];
      }
    });
  };

  // Handle unselect all cities
  const handleUnselectAll = () => {
    setSelectedCities([]);
    setCustomers([]);
    setCustomerEntries([]);
  };

  // Handle customer entry change
  const handleEntryChange = (index, field, value) => {
    setCustomerEntries(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return updated;
    });
  };

  // Calculate total
  const total = customerEntries.reduce((sum, entry) => {
    const amount = parseFloat(entry.amount) || 0;
    return sum + amount;
  }, 0);

  const [createBatchCashReceipts, { isLoading: creating }] = useCreateBatchCashReceiptsMutation();

  // Handle save
  const resolveBatchPayment = () => {
    if (paymentMethod === 'bank') {
      if (!selectedBankAccount) {
        return { error: 'Select a bank account for this payment.' };
      }
      return { paymentType: 'BANK_TRANSFER', bankId: selectedBankAccount };
    }
    const upper = {
      cash: 'CASH',
      credit_card: 'CREDIT_CARD',
      debit_card: 'DEBIT_CARD',
      check: 'CHECK',
      account: 'ACCOUNT',
      split: 'SPLIT',
    }[paymentMethod];
    return {
      paymentType: upper || String(paymentMethod || 'cash').toUpperCase(),
      bankId: undefined,
    };
  };

  const handleSave = () => {
    const resolved = resolveBatchPayment();
    if (resolved.error) {
      showErrorToast(resolved.error);
      return;
    }

    // Filter entries with amounts
    const entriesWithAmounts = customerEntries.filter(entry => {
      const amount = parseFloat(entry.amount);
      return amount > 0;
    });

    if (entriesWithAmounts.length === 0) {
      showErrorToast('Please enter at least one amount');
      return;
    }

    // Prepare receipts data
    const receipts = entriesWithAmounts.map(entry => ({
      customer: entry.customerId,
      amount: parseFloat(entry.amount),
      particular: entry.particular || 'Cash Receipt'
    }));

    const batchData = {
      voucherDate: voucherData.voucherDate,
      paymentType: resolved.paymentType,
      voucherNo: voucherData.voucherNo,
      ...(resolved.bankId ? { bankId: resolved.bankId } : {}),
      receipts
    };

    createBatchCashReceipts(batchData)
      .unwrap()
      .then((response) => {
        showSuccessToast(response?.message || `Successfully created ${response?.data?.count || entriesWithAmounts.length} cash receipt(s)`);

        setCustomerEntries(prev => prev.map(entry => ({
          ...entry,
          particular: '',
          amount: ''
        })));

        // Reset voucher number for next entry (will be auto-generated)
        const date = new Date(voucherData.voucherDate || new Date());
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const timestamp = Date.now();
        const uniqueSuffix = String(timestamp).slice(-4);
        setVoucherData(prev => ({
          ...prev,
          voucherNo: `CR-${year}${month}${day}-${uniqueSuffix}`
        }));
      })
      .catch((error) => {
        showErrorToast(handleApiError(error));
      });
  };

  // Handle reset
  const handleReset = () => {
    setPaymentMethod('cash');
    setSelectedBankAccount('');
    setCustomerEntries(prev => prev.map(entry => ({
      ...entry,
      particular: '',
      amount: ''
    })));
  };

  // Handle print voucher
  const handlePrint = () => {
    // Calculate total amount
    const totalAmount = customerEntries.reduce((sum, entry) => {
      return sum + (parseFloat(entry.amount) || 0);
    }, 0);

    // Format voucher data for PrintModal
    const formattedData = {
      invoiceNumber: voucherData.voucherNo || 'N/A',
      orderNumber: voucherData.voucherNo || 'N/A',
      createdAt: voucherData.voucherDate,
      invoiceDate: voucherData.voucherDate,
      customer: null,
      customerInfo: null,
      pricing: {
        subtotal: totalAmount,
        total: totalAmount,
        discountAmount: 0,
        taxAmount: 0
      },
      total: totalAmount,
      items: customerEntries
        .filter(entry => parseFloat(entry.amount) > 0)
        .map((entry, index) => ({
          _id: entry.customerId,
          product: {
            name: entry.accountName || entry.name || 'N/A',
          },
          quantity: 1,
          unitPrice: parseFloat(entry.amount) || 0,
          total: parseFloat(entry.amount) || 0,
          particular: entry.particular || ''
        })),
      notes: (() => {
        const bank =
          paymentMethod === 'bank' && selectedBankAccount
            ? banksList.find((b) => String(b.id || b._id) === String(selectedBankAccount))
            : null;
        const bankPart = bank
          ? ` | Bank: ${toTitleCase(bank.bankName || bank.bank_name || 'Bank')}${bank.accountNumber || bank.account_number ? ` (${bank.accountNumber || bank.account_number})` : ''}`
          : '';
        const methodLabel =
          paymentMethod === 'bank'
            ? 'Bank transfer'
            : paymentMethod.replace(/_/g, ' ');
        return `Payment: ${methodLabel}${bankPart}`;
      })(),
      voucherNo: voucherData.voucherNo,
      paymentType:
        paymentMethod === 'bank' && selectedBankAccount
          ? 'BANK_TRANSFER'
          : {
              cash: 'CASH',
              credit_card: 'CREDIT_CARD',
              debit_card: 'DEBIT_CARD',
              check: 'CHECK',
              account: 'ACCOUNT',
              split: 'SPLIT',
            }[paymentMethod] || String(paymentMethod || 'cash').toUpperCase()
    };

    setPrintData(formattedData);
    setShowPrintModal(true);
  };

  // Handle print customer list
  const handlePrintCustomerList = () => {
    if (customerEntries.length === 0) {
      showErrorToast('No customers loaded. Please select a city and click Load first.');
      return;
    }

    if (!balanceFilters.positive && !balanceFilters.negative && !balanceFilters.zero) {
      showErrorToast('Please select at least one balance filter to print.');
      return;
    }

    const threshold = 0.01;
    let filteredEntries = customerEntries.filter(entry => {
      const balance = entry.balance || 0;
      const isZero = Math.abs(balance) <= threshold;
      const isPositive = balance > threshold;
      const isNegative = balance < -threshold;
      if (isZero && balanceFilters.zero) return true;
      if (isPositive && balanceFilters.positive) return true;
      if (isNegative && balanceFilters.negative) return true;
      return false;
    });
    
    filteredEntries = [...filteredEntries].sort((a, b) => {
      const balanceA = a.balance || 0;
      const balanceB = b.balance || 0;
      const getCategory = (balance) => {
        if (Math.abs(balance) <= threshold) return 2;
        if (balance > 0) return 0;
        return 1;
      };
      const categoryA = getCategory(balanceA);
      const categoryB = getCategory(balanceB);
      if (categoryA !== categoryB) return categoryA - categoryB;
      return Math.abs(balanceB) - Math.abs(balanceA);
    });

    const activeFilters = [];
    if (balanceFilters.positive) activeFilters.push('Positive');
    if (balanceFilters.negative) activeFilters.push('Negative');
    if (balanceFilters.zero) activeFilters.push('Zero');
    const filterDescription = activeFilters.length > 0 
      ? activeFilters.join(', ') 
      : 'None selected';

    const customerListData = filteredEntries.map((entry) => {
      const customer = customers.find(c => c._id === entry.customerId);
      let customerCity = entry.city || '';
      if (!customerCity && customer) {
        customerCity = customer.city || '';
        if (!customerCity && customer.addresses && customer.addresses.length > 0) {
          const defaultAddress = customer.addresses.find(addr => addr.isDefault) || customer.addresses[0];
          customerCity = defaultAddress?.city || '';
        }
      }
      if (!customerCity && selectedCities.length > 0 && customer) {
        if (customer.addresses && customer.addresses.length > 0) {
          const matchingAddress = customer.addresses.find(addr => 
            addr.city && selectedCities.includes(addr.city)
          );
          customerCity = matchingAddress?.city || '';
        }
      }
      return {
        name: entry.name || entry.accountName || 'N/A',
        phone: entry.phone || customer?.phone || 'N/A',
        city: customerCity ? toTitleCase(customerCity) : 'N/A',
        balance: entry.balance || 0
      };
    });

    const totalBalance = customerListData.reduce((sum, c) => sum + (c.balance || 0), 0);
    const selectedCitiesText = selectedCities.length > 0
      ? selectedCities.map((c) => toTitleCase(c)).join(', ')
      : 'All Cities';

    setCustomerListPrintData({
      data: customerListData,
      columns: [
        { header: '#', key: '_index', render: (row, idx) => idx + 1 },
        { header: 'Customer Name', key: 'name' },
        { header: 'Contact', key: 'phone' },
        { header: 'City', key: 'city' },
        { header: 'Balance', key: 'balance', align: 'right', bold: true, render: (row) => {
          const b = row.balance || 0;
          return b >= 0
            ? `Rs. ${Math.abs(b).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : `(Rs. ${Math.abs(b).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
        }}
      ],
      filters: { dateFrom: selectedCitiesText, dateTo: filterDescription, city: '' },
      summaryData: {
        'Total Customers': customerListData.length,
        'Total Balance': totalBalance
      },
      title: `Customer Balance List - ${selectedCitiesText}`
    });
    setShowCustomerListPrint(true);
  };

  return (
    <PageShell className="bg-neutral-50" contentClassName="space-y-4 sm:space-y-6 p-3 sm:p-6">
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 border-l-4 border-l-neutral-900 bg-white px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <PageHeader
              title="Cash Receipt Voucher"
              subtitle="Record bulk cash receipts by city and customer balance"
              icon={Banknote}
              titleClassName="text-lg font-semibold tracking-tight text-neutral-900 sm:text-xl"
              subtitleClassName="mt-0.5 text-sm text-neutral-500 leading-snug"
            />
            <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-md border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-800">
              Bulk Receipt
            </span>
          </div>
        </div>

        <div className="p-5 sm:p-6 lg:p-7">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3 xl:gap-6">
          <section className={crPanelClass}>
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-neutral-200">
                <Banknote className="h-4 w-4 text-neutral-900" aria-hidden />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">Payment</h2>
                <p className="mt-0.5 text-xs text-neutral-500">Method and receipt total</p>
              </div>
            </div>
            <div>
              <label className={crLabelClass}>Payment Method</label>
              <select
                value={
                  paymentMethod === 'bank' && selectedBankAccount
                    ? `bank:${selectedBankAccount}`
                    : paymentMethod
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.startsWith('bank:')) {
                    setPaymentMethod('bank');
                    setSelectedBankAccount(v.slice(5));
                  } else {
                    setPaymentMethod(v);
                    setSelectedBankAccount('');
                  }
                }}
                className={crInputClass}
              >
                <option value="cash">Cash</option>
                {activeBanks.map((bank) => {
                  const bid = bank._id || bank.id;
                  if (!bid) return null;
                  const label = [
                    toTitleCase(bank.bankName || bank.bank_name || ''),
                    bank.accountNumber || bank.account_number,
                  ]
                    .filter(Boolean)
                    .join(' — ');
                  const acc = bank.accountName ? ` (${toTitleCase(bank.accountName)})` : '';
                  return (
                    <option key={bid} value={`bank:${bid}`}>
                      Bank · {label}
                      {acc}
                    </option>
                  );
                })}
                {banksLoading && (
                  <option value="" disabled>
                    Loading banks…
                  </option>
                )}
                {!banksLoading && activeBanks.length === 0 && (
                  <option value="" disabled>
                    No bank accounts (add in Banks)
                  </option>
                )}
                <option value="credit_card">Credit Card</option>
                <option value="debit_card">Debit Card</option>
                <option value="check">Check</option>
                <option value="account">Account</option>
                <option value="split">Split Payment</option>
              </select>
              {activeBanks.length === 0 && !banksLoading && (
                <p className="mt-1.5 text-xs text-neutral-600">
                  No banks found. Add banks under Settings → Banks.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-neutral-300 bg-white px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Receipt Total
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-neutral-900 sm:text-3xl">
                {formatCurrency(total)}
              </div>
            </div>
          </section>

          <section className={crPanelClass}>
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-neutral-200">
                <Users className="h-4 w-4 text-neutral-900" aria-hidden />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">Voucher &amp; Customers</h2>
                <p className="mt-0.5 text-xs text-neutral-500">Date, number, balance filters, and load</p>
              </div>
            </div>
            <DateFilter mode="single"
              label="Voucher Date"
              value={voucherData.voucherDate}
              onChange={(date) => setVoucherData(prev => ({ ...prev, voucherDate: date }))}
              size="sm"
            />

            <div>
              <label className={crLabelClass}>Voucher No</label>
              <input
                type="text"
                value={voucherData.voucherNo}
                readOnly
                className={cn(crInputClass, 'bg-neutral-50 text-neutral-700')}
              />
            </div>

            <div className="space-y-2">
              <label className={crLabelClass}>Filter by Balance</label>
              <div className="grid grid-cols-1 gap-2">
                <CrCheckboxOption
                  label="Positive Balance (> 0)"
                  checked={balanceFilters.positive}
                  whiteBg
                  onCheckedChange={(checked) =>
                    setBalanceFilters((prev) => ({ ...prev, positive: checked }))
                  }
                />
                <CrCheckboxOption
                  label="Negative Balance (< 0)"
                  checked={balanceFilters.negative}
                  whiteBg
                  onCheckedChange={(checked) =>
                    setBalanceFilters((prev) => ({ ...prev, negative: checked }))
                  }
                />
                <CrCheckboxOption
                  label="Zero Balance (= 0)"
                  checked={balanceFilters.zero}
                  whiteBg
                  onCheckedChange={(checked) =>
                    setBalanceFilters((prev) => ({ ...prev, zero: checked }))
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={handlePrintCustomerList}
                disabled={customers.length === 0}
                className={crBtnSecondary}
                title="Print customer balance list"
              >
                <Printer className="h-4 w-4" aria-hidden />
                <span>Print List</span>
              </button>
              <button type="button" onClick={handleUnselectAll} className={crBtnSecondary}>
                UnSelect All
              </button>
              <button
                type="button"
                onClick={loadCustomers}
                disabled={customersLoading || selectedCities.length === 0}
                className={crBtnPrimary}
              >
                {customersLoading ? (
                  <LoadingSpinner size="sm" inline aria-hidden />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden />
                )}
                <span>Load</span>
              </button>
            </div>
          </section>

          <section className={crPanelClass}>
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-neutral-200">
                <MapPin className="h-4 w-4 text-neutral-900" aria-hidden />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">Select Cities</h2>
                <p className="mt-0.5 text-xs text-neutral-500">Choose cities to load customer balances</p>
              </div>
            </div>
            <div className="relative">
              <input
                type="text"
                value={citySearchTerm}
                onChange={(e) => setCitySearchTerm(e.target.value)}
                placeholder="Search cities..."
                className={cn(crInputClass, 'pl-10')}
              />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
            </div>
            <div className="h-48 overflow-y-auto rounded-lg border border-neutral-200 bg-white sm:h-64">
              {citiesLoading ? (
                <div className="p-4 text-center text-neutral-500">
                  <LoadingInline message="Loading cities..." />
                </div>
              ) : cities.length === 0 ? (
                <div className="p-4 text-center text-neutral-500">No cities available</div>
              ) : (() => {
                const filteredCities = cities.filter(city =>
                  city.toLowerCase().includes(citySearchTerm.toLowerCase())
                );

                return filteredCities.length === 0 ? (
                  <div className="p-4 text-center text-neutral-500">
                    No cities found matching &quot;{citySearchTerm}&quot;
                  </div>
                ) : (
                  <div className="space-y-1 p-1.5">
                    {filteredCities.map((city) => {
                      const isSelected = selectedCities.includes(city);
                      return (
                        <CrCheckboxOption
                          key={city}
                          label={toTitleCase(city)}
                          checked={isSelected}
                          compact
                          onCheckedChange={(checked) => {
                            if (checked !== isSelected) handleCityToggle(city);
                          }}
                        />
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </section>
        </div>
        </div>
      </div>

      {/* Customer Grid */}
      {customerEntries.length > 0 && (() => {
        // Filter and sort customer entries based on balance filter checkboxes
        const threshold = 0.01; // Threshold for zero balance detection
        
        // Filter customers based on selected balance types
        let filteredEntries = customerEntries.filter(entry => {
          const balance = entry.balance || 0;
          const isZero = Math.abs(balance) <= threshold;
          const isPositive = balance > threshold;
          const isNegative = balance < -threshold;
          
          // Show customer if their balance type is selected
          if (isZero && balanceFilters.zero) return true;
          if (isPositive && balanceFilters.positive) return true;
          if (isNegative && balanceFilters.negative) return true;
          return false;
        });
        
        // Sort filtered entries: positive first, then negative, then zero
        filteredEntries = [...filteredEntries].sort((a, b) => {
          const balanceA = a.balance || 0;
          const balanceB = b.balance || 0;
          
          // Determine category for each balance
          const getCategory = (balance) => {
            if (Math.abs(balance) <= threshold) return 2; // Zero balance
            if (balance > 0) return 0; // Positive balance
            return 1; // Negative balance
          };
          
          const categoryA = getCategory(balanceA);
          const categoryB = getCategory(balanceB);
          
          // Sort by category first (0 = positive, 1 = negative, 2 = zero)
          if (categoryA !== categoryB) {
            return categoryA - categoryB;
          }
          
          // Within same category, sort by absolute balance (descending)
          return Math.abs(balanceB) - Math.abs(balanceA);
        });

        // Build filter description
        const activeFilters = [];
        if (balanceFilters.positive) activeFilters.push('Positive');
        if (balanceFilters.negative) activeFilters.push('Negative');
        if (balanceFilters.zero) activeFilters.push('Zero');
        const filterDescription = activeFilters.length > 0 
          ? activeFilters.join(', ') 
          : 'None selected';

        if (filteredEntries.length === 0) {
          return (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center shadow-sm sm:p-8">
              <p className="text-sm text-neutral-500 sm:text-base">
                {activeFilters.length === 0
                  ? 'Please select at least one balance filter to display customers.'
                  : `No customers found matching the selected filters (${filterDescription}).`}
              </p>
            </div>
          );
        }

        return (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="border-b border-neutral-200 px-4 py-3 sm:px-5 sm:py-4">
              <h2 className="text-base font-semibold text-neutral-900 sm:text-lg">
                Customer Receipts
                <span className="mt-1 block text-xs font-normal text-neutral-500 sm:ml-2 sm:mt-0 sm:inline">
                  Showing {filteredEntries.length} of {customerEntries.length} — Filters: {filterDescription}
                </span>
              </h2>
            </div>
            <div className="table-scroll">
              <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 sm:px-6">
                      Account Name
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 sm:px-6">
                      Balance
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 sm:px-6">
                      Particular
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 sm:px-6">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 bg-white">
                  {filteredEntries.map((entry) => {
                    const originalIndex = customerEntries.findIndex(e => e.customerId === entry.customerId);
                    const hasAmount = parseFloat(entry.amount) > 0;
                    return (
                      <tr
                        key={entry.customerId}
                        className={hasAmount ? 'border-l-2 border-l-neutral-900 bg-neutral-50' : ''}
                      >
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-neutral-900 sm:px-6 sm:text-sm">
                          {entry.accountName}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-neutral-900 sm:px-6 sm:text-sm">
                          {formatCurrency(entry.balance)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 sm:px-6">
                          <input
                            type="text"
                            value={entry.particular}
                            onChange={(e) => handleEntryChange(originalIndex, 'particular', e.target.value)}
                            placeholder="Enter description"
                            className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-200 sm:px-3 sm:text-sm"
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 sm:px-6">
                          <input
                            type="number"
                            value={entry.amount}
                            onChange={(e) => handleEntryChange(originalIndex, 'amount', e.target.value)}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs tabular-nums shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-200 sm:px-3 sm:text-sm"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      <div className="flex flex-col-reverse gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
        <button
          type="button"
          onClick={handleReset}
          className={cn(crBtnSecondary, 'w-full sm:w-auto sm:min-w-[8.5rem]')}
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          <span>Reset</span>
        </button>
        <button
          type="button"
          onClick={handlePrint}
          disabled={customerEntries.filter(e => parseFloat(e.amount) > 0).length === 0}
          className={cn(crBtnSecondary, 'w-full sm:w-auto sm:min-w-[8.5rem]')}
        >
          <Printer className="h-4 w-4" aria-hidden />
          <span>Print</span>
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={creating || total === 0}
          className={cn(crBtnPrimary, 'w-full sm:w-auto sm:min-w-[10rem]')}
        >
          {creating ? (
            <LoadingSpinner size="sm" inline aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          <span>{creating ? 'Saving...' : 'Save'}</span>
        </button>
      </div>

      {/* Print Modal */}
      <PrintModal
        isOpen={showPrintModal}
        onClose={() => {
          setShowPrintModal(false);
          setPrintData(null);
        }}
        orderData={printData}
        documentTitle="Cash Receipt Voucher"
        partyLabel="Customer"
      />

      {/* Customer Balance List Print Modal */}
      {showCustomerListPrint && customerListPrintData && (
        <PrintReportModal
          isOpen={showCustomerListPrint}
          onClose={() => {
            setShowCustomerListPrint(false);
            setCustomerListPrintData(null);
          }}
          reportTitle={customerListPrintData.title}
          data={customerListPrintData.data}
          columns={customerListPrintData.columns}
          filters={customerListPrintData.filters}
          summaryData={customerListPrintData.summaryData}
        />
      )}
    </PageShell>
  );
};

export default CashReceiving;

