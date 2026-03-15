import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Building,
  User,
  Search,
  Save,
  Trash2,
  TrendingUp,
  Package,
  RefreshCw,
  ArrowRight,
  Phone
} from 'lucide-react';
import { useCreateTransactionMutation } from '../store/services/dropShippingApi';
import { useLazySearchSuppliersQuery, useGetActiveSuppliersQuery } from '../store/services/suppliersApi';
import { useGetCustomersQuery } from '../store/services/customersApi';
import { useGetProductsQuery } from '../store/services/productsApi';
import { SearchableDropdown } from '../components/SearchableDropdown';
import { LoadingButton } from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const DropShipping = () => {
  // Supplier Section
  const [supplier, setSupplier] = useState(null);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [supplierBalance, setSupplierBalance] = useState(0);
  const [billNumber, setBillNumber] = useState('');
  const [supplierDescription, setSupplierDescription] = useState('');
  const [supplierInvoiceAmount, setSupplierInvoiceAmount] = useState(0);
  const [supplierPaidAmount, setSupplierPaidAmount] = useState(0);

  // Customer Section
  const [customer, setCustomer] = useState(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerBalance, setCustomerBalance] = useState(0);
  const [rateType, setRateType] = useState('wholesale');
  const [customerDescription, setCustomerDescription] = useState('');
  const [customerInvoiceAmount, setCustomerInvoiceAmount] = useState(0);
  const [customerReceivedAmount, setCustomerReceivedAmount] = useState(0);
  const [customerAmount, setCustomerAmount] = useState(0);

  // Product Section
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [supplierRate, setSupplierRate] = useState('');
  const [customerRate, setCustomerRate] = useState('');

  // Cart Items
  const [cartItems, setCartItems] = useState([]);

  // Date
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);

  // Queries - Always enabled so users can see options when typing
  const [searchSuppliers] = useLazySearchSuppliersQuery();
  const { data: activeSuppliersData } = useGetActiveSuppliersQuery(undefined, { skip: supplierSearchTerm.length > 0 });

  const [suppliersData, setSuppliersData] = React.useState(null);

  React.useEffect(() => {
    if (supplierSearchTerm.length > 0) {
      searchSuppliers(supplierSearchTerm).then(({ data }) => {
        setSuppliersData(data);
      });
    } else {
      setSuppliersData(activeSuppliersData);
    }
  }, [supplierSearchTerm, activeSuppliersData, searchSuppliers]);

  const { data: customersData } = useGetCustomersQuery(
    { search: customerSearchTerm, limit: 100 },
    { keepPreviousData: true }
  );
  const customers = React.useMemo(() => {
    return customersData?.data?.customers || customersData?.customers || [];
  }, [customersData]);

  const { data: productsData } = useGetProductsQuery(
    { search: productSearchTerm, limit: 50 },
    {
      skip: productSearchTerm.length === 0,
      keepPreviousData: true,
    }
  );
  const products = React.useMemo(() => {
    return productsData?.data?.products || productsData?.products || [];
  }, [productsData]);

  // Mutations
  const [createTransaction, { isLoading: creating }] = useCreateTransactionMutation();

  const handleCreateTransaction = async (data) => {
    try {
      await createTransaction(data).unwrap();
      toast.success('Drop shipping transaction created successfully');
      handleReset();
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to create transaction');
    }
  };

  // Handlers
  const handleSupplierSelect = (selectedSupplier) => {
    setSupplier(selectedSupplier);
    // Use pendingBalance like in Purchase page
    setSupplierBalance(selectedSupplier.pendingBalance || 0);
  };

  const handleCustomerSelect = (selectedCustomer) => {
    setCustomer(selectedCustomer);
    // Calculate net balance like in Sales page: receivables - advance
    const receivables = selectedCustomer.pendingBalance || 0;
    const advance = selectedCustomer.advanceBalance || 0;
    const netBalance = receivables - advance;
    setCustomerBalance(netBalance);
  };

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setProductSearchTerm(product.name);
    setSupplierRate(product.pricing?.cost || 0);

    // Set customer rate based on rate type
    if (rateType === 'retail') {
      setCustomerRate(product.pricing?.retail || 0);
    } else if (rateType === 'wholesale') {
      setCustomerRate(product.pricing?.wholesale || 0);
    } else {
      // Custom - keep current rate or default to wholesale
      setCustomerRate(product.pricing?.wholesale || 0);
    }
  };

  // Update customer rate when rate type changes
  useEffect(() => {
    if (selectedProduct) {
      if (rateType === 'retail') {
        setCustomerRate(selectedProduct.pricing?.retail || 0);
      } else if (rateType === 'wholesale') {
        setCustomerRate(selectedProduct.pricing?.wholesale || 0);
      }
      // Custom rate type doesn't auto-update - user can manually enter
    }
  }, [rateType, selectedProduct]);

  const handleAddToCart = () => {
    if (!selectedProduct) {
      toast.error('Please select a product');
      return;
    }

    const supplierAmt = quantity * (supplierRate || 0);
    const customerAmt = quantity * (customerRate || 0);
    const profitAmt = customerAmt - supplierAmt;

    const newItem = {
      product: selectedProduct,
      quantity,
      supplierRate: supplierRate || 0,
      supplierAmount: supplierAmt,
      customerRate: customerRate || 0,
      customerAmount: customerAmt,
      profitAmount: profitAmt,
      profitMargin: customerAmt > 0 ? (profitAmt / customerAmt) * 100 : 0
    };

    setCartItems([...cartItems, newItem]);

    // Update totals
    const newSupplierTotal = [...cartItems, newItem].reduce((sum, item) => sum + item.supplierAmount, 0);
    const newCustomerTotal = [...cartItems, newItem].reduce((sum, item) => sum + item.customerAmount, 0);

    setSupplierInvoiceAmount(newSupplierTotal);
    setCustomerInvoiceAmount(newCustomerTotal);

    // Reset product selection
    setSelectedProduct(null);
    setProductSearchTerm('');
    setQuantity(1);
    setSupplierRate('');
    setCustomerRate('');
  };

  const handleRemoveItem = (index) => {
    const updatedItems = cartItems.filter((_, i) => i !== index);
    setCartItems(updatedItems);

    // Update totals
    const newSupplierTotal = updatedItems.reduce((sum, item) => sum + item.supplierAmount, 0);
    const newCustomerTotal = updatedItems.reduce((sum, item) => sum + item.customerAmount, 0);

    setSupplierInvoiceAmount(newSupplierTotal);
    setCustomerInvoiceAmount(newCustomerTotal);
  };

  const handleUpdateCartItem = (index, field, value) => {
    const updatedItems = cartItems.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value };

        // Recalculate amounts based on the changed field
        if (field === 'quantity' || field === 'supplierRate') {
          updatedItem.supplierAmount = updatedItem.quantity * updatedItem.supplierRate;
        }
        if (field === 'quantity' || field === 'customerRate') {
          updatedItem.customerAmount = updatedItem.quantity * updatedItem.customerRate;
        }

        // Recalculate profit
        updatedItem.profitAmount = updatedItem.customerAmount - updatedItem.supplierAmount;
        updatedItem.profitMargin = updatedItem.customerAmount > 0
          ? (updatedItem.profitAmount / updatedItem.customerAmount) * 100
          : 0;

        return updatedItem;
      }
      return item;
    });

    setCartItems(updatedItems);

    // Update totals
    const newSupplierTotal = updatedItems.reduce((sum, item) => sum + item.supplierAmount, 0);
    const newCustomerTotal = updatedItems.reduce((sum, item) => sum + item.customerAmount, 0);

    setSupplierInvoiceAmount(newSupplierTotal);
    setCustomerInvoiceAmount(newCustomerTotal);
  };

  const handleSave = () => {
    if (!supplier) {
      toast.error('Please select a supplier');
      return;
    }

    if (!customer) {
      toast.error('Please select a customer');
      return;
    }

    if (cartItems.length === 0) {
      toast.error('Please add at least one product');
      return;
    }

    const transactionData = {
      supplier: supplier._id,
      customer: customer._id,
      supplierInfo: {
        companyName: supplier.companyName,
        contactPerson: supplier.contactPerson?.name || '',
        email: supplier.email || '',
        phone: supplier.phone || ''
      },
      customerInfo: {
        displayName: customer.displayName || customer.name,
        businessName: customer.businessName || '',
        email: customer.email || '',
        phone: customer.phone || '',
        businessType: customer.businessType || ''
      },
      billNumber,
      supplierDescription,
      customerDescription,
      rateType,
      items: cartItems.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        supplierRate: item.supplierRate,
        customerRate: item.customerRate
      })),
      transactionDate,
      supplierPayment: {
        amount: supplierPaidAmount,
        method: supplierPaidAmount === supplierInvoiceAmount ? 'account' : 'cash'
      },
      customerPayment: {
        amount: customerReceivedAmount,
        method: customerReceivedAmount === customerInvoiceAmount ? 'account' : 'cash'
      }
    };

    handleCreateTransaction(transactionData);
  };

  const handleReset = () => {
    setSupplier(null);
    setSupplierSearchTerm('');
    setSupplierBalance(0);
    setBillNumber('');
    setSupplierDescription('');
    setSupplierInvoiceAmount(0);
    setSupplierPaidAmount(0);

    setCustomer(null);
    setCustomerSearchTerm('');
    setCustomerBalance(0);
    setRateType('wholesale');
    setCustomerDescription('');
    setCustomerInvoiceAmount(0);
    setCustomerReceivedAmount(0);
    setCustomerAmount(0);

    setSelectedProduct(null);
    setProductSearchTerm('');
    setQuantity(1);
    setSupplierRate('');
    setCustomerRate('');

    setCartItems([]);
    setTransactionDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Drop Shipping</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Manage drop shipping transactions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Supplier Detail */}
        <div className="card">
          <div className="card-header">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                <Building className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-blue-600" />
                Supplier Detail
              </h3>
              {supplier?.phone && (
                <div className="flex items-center space-x-1">
                  <Phone className="h-3 w-3 text-gray-400" />
                  <span className="text-xs sm:text-sm font-medium text-gray-700">{supplier.phone}</span>
                </div>
              )}
            </div>
          </div>
          <div className="card-content space-y-4">
            <div>
              <div className="flex items-center gap-4 mb-2 flex-wrap">
                <label className="text-xs sm:text-sm font-medium text-gray-700">Supplier</label>
                {supplier && (
                  <div className="flex items-center space-x-1 whitespace-nowrap">
                    <span className="text-xs text-gray-500">Outstanding Balance:</span>
                    <span className={`text-sm font-medium ${(supplierBalance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ${Math.round(supplierBalance || 0)}
                    </span>
                  </div>
                )}
              </div>
              <SearchableDropdown
                placeholder="Select supplier..."
                items={suppliersData?.data?.suppliers || suppliersData?.suppliers || suppliersData || []}
                onSelect={handleSupplierSelect}
                onSearch={setSupplierSearchTerm}
                displayKey={(supplier) => supplier.companyName}
                selectedItem={supplier}
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Bill No</label>
              <input
                type="text"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                className="input"
                placeholder="Enter bill number"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={supplierDescription}
                onChange={(e) => setSupplierDescription(e.target.value)}
                className="input"
                rows="2"
                placeholder="Supplier description"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Invoice Amount</label>
              <input
                type="number"
                value={supplierInvoiceAmount}
                className="input bg-yellow-50 border-yellow-200"
                disabled
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Paid Amount</label>
              <input
                type="number"
                value={supplierPaidAmount}
                onChange={(e) => setSupplierPaidAmount(parseFloat(e.target.value) || 0)}
                className="input"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Customer Detail */}
        <div className="card">
          <div className="card-header">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                <User className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-600" />
                Customer Detail
              </h3>
              {customer?.phone && (
                <div className="flex items-center space-x-1">
                  <Phone className="h-3 w-3 text-gray-400" />
                  <span className="text-xs sm:text-sm font-medium text-gray-700">{customer.phone}</span>
                </div>
              )}
            </div>
          </div>
          <div className="card-content space-y-4">
            <div>
              <div className="flex items-center gap-4 mb-2 flex-wrap">
                <label className="text-xs sm:text-sm font-medium text-gray-700">Customer</label>
                {customer && (() => {
                  const netBalance = customerBalance || 0;
                  const isPayable = netBalance < 0;
                  const isReceivable = netBalance > 0;
                  const hasBalance = Math.abs(netBalance) > 0;
                  const currentBalance = customer.currentBalance || 0;
                  const pendingBalance = customer.pendingBalance || 0;
                  const totalOutstanding = currentBalance;
                  const creditLimit = customer.creditLimit || 0;
                  const availableCredit = creditLimit > 0 ? creditLimit - totalOutstanding : 0;

                  return (
                    <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
                      {hasBalance && (
                        <div className="flex items-center space-x-1 whitespace-nowrap">
                          <span className="text-xs text-gray-500">{isPayable ? 'Payables:' : 'Receivables:'}</span>
                          <span className={`text-sm font-medium ${isPayable ? 'text-red-600' : isReceivable ? 'text-green-600' : 'text-gray-600'
                            }`}>
                            ${Math.abs(netBalance).toFixed(2)}
                          </span>
                        </div>
                      )}
                      {creditLimit > 0 && (
                        <>
                          <div className="flex items-center space-x-1 whitespace-nowrap">
                            <span className="text-xs text-gray-500">Credit Limit:</span>
                            <span className={`text-sm font-medium ${totalOutstanding >= creditLimit * 0.9
                                ? 'text-red-600'
                                : totalOutstanding >= creditLimit * 0.7
                                  ? 'text-yellow-600'
                                  : 'text-blue-600'
                              }`}>
                              ${creditLimit.toFixed(2)}
                            </span>
                            {totalOutstanding >= creditLimit * 0.9 && (
                              <span className="text-xs text-red-600 font-bold ml-1">⚠️</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-1 whitespace-nowrap">
                            <span className="text-xs text-gray-500">Available Credit:</span>
                            <span className={`text-sm font-medium ${availableCredit <= creditLimit * 0.1
                                ? 'text-red-600'
                                : availableCredit <= creditLimit * 0.3
                                  ? 'text-yellow-600'
                                  : 'text-green-600'
                              }`}>
                              ${availableCredit.toFixed(2)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
              <SearchableDropdown
                placeholder="Select customer..."
                items={customers}
                onSelect={handleCustomerSelect}
                onSearch={setCustomerSearchTerm}
                displayKey={(customer) => customer.displayName || customer.name}
                selectedItem={customer}
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Rate</label>
              <select
                value={rateType}
                onChange={(e) => setRateType(e.target.value)}
                className="input"
              >
                <option value="retail">Retail Price</option>
                <option value="wholesale">Wholesale Price</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={customerDescription}
                onChange={(e) => setCustomerDescription(e.target.value)}
                className="input"
                rows="2"
                placeholder="Customer description"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Invoice Amount</label>
              <input
                type="number"
                value={customerInvoiceAmount}
                className="input bg-yellow-50 border-yellow-200"
                disabled
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Received Amount</label>
              <input
                type="number"
                value={customerReceivedAmount}
                onChange={(e) => setCustomerReceivedAmount(parseFloat(e.target.value) || 0)}
                className="input"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Customer Amount</label>
              <input
                type="number"
                value={customerAmount}
                onChange={(e) => setCustomerAmount(parseFloat(e.target.value) || 0)}
                className="input"
                placeholder="0"
              />
            </div>

            <button
              onClick={handleAddToCart}
              className="w-full btn btn-success btn-md flex items-center justify-center gap-2"
              disabled={!selectedProduct}
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Product Details */}
      <div className="card mt-6">
        <div className="card-header">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
            <Package className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-purple-600" />
            Product Details
          </h3>
        </div>
        <div className="card-content">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 sm:gap-4 mb-4">
            <div className="sm:col-span-2 md:col-span-4">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Product</label>
              <SearchableDropdown
                placeholder="--Select--"
                items={products}
                onSelect={handleProductSelect}
                onSearch={setProductSearchTerm}
                displayKey={(product) => product.name}
                selectedItem={selectedProduct}
              />
            </div>

            <div className="sm:col-span-1 md:col-span-1">
              <button className="btn btn-secondary btn-md w-full mt-7 sm:mt-7 flex items-center justify-center">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            <div className="sm:col-span-1 md:col-span-2">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Quantity</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="input"
                min="1"
              />
            </div>

            <div className="sm:col-span-1 md:col-span-2">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Supplier Rate</label>
              <input
                type="number"
                value={supplierRate}
                onChange={(e) => setSupplierRate(e.target.value)}
                className="input"
                placeholder="0"
              />
            </div>

            <div className="sm:col-span-1 md:col-span-2">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Supplier Amount</label>
              <input
                type="number"
                value={quantity * (supplierRate || 0)}
                className="input bg-gray-50"
                disabled
              />
            </div>

            <div className="sm:col-span-1 md:col-span-2">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Customer Rate</label>
              <input
                type="number"
                value={customerRate}
                onChange={(e) => setCustomerRate(e.target.value)}
                className="input"
                placeholder="0"
              />
            </div>

            <div className="sm:col-span-1 md:col-span-2">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Customer Amount</label>
              <input
                type="number"
                value={quantity * (customerRate || 0)}
                className="input bg-gray-50"
                disabled
              />
            </div>
          </div>

          <button
            onClick={handleAddToCart}
            className="btn btn-success btn-md flex items-center justify-center gap-2"
            disabled={!selectedProduct}
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      {/* Cart Items */}
      {cartItems.length > 0 && (
        <div className="card mt-6">
          <div className="card-header">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Product List</h3>
          </div>
          <div className="card-content">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs sm:text-sm font-medium text-gray-700">S.No</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs sm:text-sm font-medium text-gray-700">Product</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs sm:text-sm font-medium text-gray-700">Quantity</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs sm:text-sm font-medium text-gray-700">S_Rate</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs sm:text-sm font-medium text-gray-700">S_Amount</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs sm:text-sm font-medium text-gray-700">C_Rate</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs sm:text-sm font-medium text-gray-700">C_Amount</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-2 text-left text-xs sm:text-sm font-medium text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cartItems.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="px-2 py-2 sm:px-4 sm:py-2 text-xs sm:text-sm">{index + 1}</td>
                      <td className="px-2 py-2 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium">{item.product.name}</td>
                      <td className="px-2 py-2 sm:px-4 sm:py-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            const newQuantity = parseFloat(e.target.value) || 1;
                            if (newQuantity <= 0) {
                              handleRemoveItem(index);
                            } else {
                              handleUpdateCartItem(index, 'quantity', newQuantity);
                            }
                          }}
                          className="input text-center h-8 w-20"
                          min="1"
                        />
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={item.supplierRate}
                          onChange={(e) => handleUpdateCartItem(index, 'supplierRate', parseFloat(e.target.value) || 0)}
                          className="input text-center h-8 w-20 sm:w-24"
                          min="0"
                        />
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-2 text-xs sm:text-sm">{item.supplierAmount.toFixed(2)}</td>
                      <td className="px-2 py-2 sm:px-4 sm:py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={item.customerRate}
                          onChange={(e) => handleUpdateCartItem(index, 'customerRate', parseFloat(e.target.value) || 0)}
                          className="input text-center h-8 w-20 sm:w-24"
                          min="0"
                        />
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-2 text-xs sm:text-sm">{item.customerAmount.toFixed(2)}</td>
                      <td className="px-2 py-2 sm:px-4 sm:py-2">
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
        <LoadingButton
          onClick={handleSave}
          isLoading={creating}
          className="btn btn-primary btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Save className="h-4 w-4" />
          Save
        </LoadingButton>

        <button
          onClick={handleReset}
          className="btn btn-secondary btn-md flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <RefreshCw className="h-4 w-4" />
          Reset
        </button>
      </div>
    </div>
  );
};

export default DropShipping;

