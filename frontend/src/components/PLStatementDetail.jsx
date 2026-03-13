import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  TrendingUp,
  Percent,
  Calculator,
  Download,
  Share2,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Clock,
  Edit,
} from 'lucide-react';

const PLStatementDetail = ({ statement, onExport, onShare }) => {
  const [showDetails, setShowDetails] = useState(true);
  const [showNotes, setShowNotes] = useState(false);

  const formatCurrency = (amount) => 
    `${amount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`;

  const formatPercent = (value) => 
    `${value?.toFixed(1) || '0.0'}%`;

  const formatDate = (date) => 
    new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'published': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'approved': return <CheckCircle className="h-5 w-5 text-blue-500" />;
      case 'review': return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'draft': return <Edit className="h-5 w-5 text-gray-500" />;
      default: return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'published': return 'text-green-600 bg-green-50 border-green-200';
      case 'approved': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'review': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'draft': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-red-600 bg-red-50 border-red-200';
    }
  };

  const isPositive = (amount) => amount >= 0;
  const getTrendIcon = (amount) => 
    isPositive(amount) ? 
      <TrendingUp className="h-4 w-4 text-green-500" /> : 
      <TrendingDown className="h-4 w-4 text-red-500" />;

  const getAmountColor = (amount) => 
    isPositive(amount) ? 'text-green-600' : 'text-red-600';

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Profit & Loss Statement</h1>
            <p className="text-gray-600 mt-1">
              {formatDate(statement.period?.startDate)} - {formatDate(statement.period?.endDate)}
            </p>
            {statement.company?.name && (
              <p className="text-sm text-gray-500 mt-1">{statement.company.name}</p>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            <div className={`flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(statement.status)}`}>
              {getStatusIcon(statement.status)}
              <span className="ml-2 capitalize">{statement.status}</span>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title={showDetails ? "Hide Details" : "Show Details"}
              >
                {showDetails ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
              <button
                onClick={() => onExport(statement)}
                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Export Statement"
              >
                <Download className="h-5 w-5" />
              </button>
              <button
                onClick={() => onShare(statement)}
                className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                title="Share Statement"
              >
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Summary */}
      <div className="p-6 bg-gray-50">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="h-5 w-5 text-blue-500 mr-1" />
              <span className="text-sm font-medium text-gray-600">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(statement.revenue?.totalRevenue?.amount)}
            </p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Calculator className="h-5 w-5 text-green-500 mr-1" />
              <span className="text-sm font-medium text-gray-600">Gross Profit</span>
            </div>
            <p className={`text-2xl font-bold ${getAmountColor(statement.grossProfit?.amount)}`}>
              {formatCurrency(statement.grossProfit?.amount)}
            </p>
            <p className="text-sm text-gray-500">
              {formatPercent(statement.grossProfit?.margin)} margin
            </p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="h-5 w-5 text-purple-500 mr-1" />
              <span className="text-sm font-medium text-gray-600">Operating Income</span>
            </div>
            <p className={`text-2xl font-bold ${getAmountColor(statement.operatingIncome?.amount)}`}>
              {formatCurrency(statement.operatingIncome?.amount)}
            </p>
            <p className="text-sm text-gray-500">
              {formatPercent(statement.operatingIncome?.margin)} margin
            </p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              {getTrendIcon(statement.netIncome?.amount)}
              <span className="text-sm font-medium text-gray-600">Net Income</span>
            </div>
            <p className={`text-2xl font-bold ${getAmountColor(statement.netIncome?.amount)}`}>
              {formatCurrency(statement.netIncome?.amount)}
            </p>
            <p className="text-sm text-gray-500">
              {formatPercent(statement.netIncome?.margin)} margin
            </p>
          </div>
        </div>
      </div>

      {/* Detailed P&L Statement */}
      <div className="p-6">
        <div className="space-y-8">
          {/* Revenue Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 text-green-500 mr-2" />
              Revenue
            </h2>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">Gross Sales</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(statement.revenue?.grossSales?.amount)}
                  </span>
                </div>
              </div>
              
              {showDetails && statement.revenue?.grossSales?.details?.length > 0 && (
                <div className="px-4 py-2 bg-gray-25">
                  {statement.revenue.grossSales.details.map((detail, index) => (
                    <div key={index} className="flex justify-between items-center py-1 text-sm">
                      <span className="text-gray-600 ml-4">{detail.category}</span>
                      <span className="text-gray-900">{formatCurrency(detail.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">Less: Sales Returns</span>
                  <span className="font-semibold text-red-600">
                    -{formatCurrency(statement.revenue?.salesReturns?.amount)}
                  </span>
                </div>
              </div>
              
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">Less: Sales Discounts</span>
                  <span className="font-semibold text-red-600">
                    -{formatCurrency(statement.revenue?.salesDiscounts?.amount)}
                  </span>
                </div>
              </div>
              
              {showDetails && statement.revenue?.salesDiscounts?.details?.length > 0 && (
                <div className="px-4 py-2 bg-gray-25 border-b border-gray-200">
                  {statement.revenue.salesDiscounts.details.map((detail, index) => (
                    <div key={index} className="flex justify-between items-center py-1 text-sm">
                      <span className="text-gray-600 ml-4 capitalize">{detail.type || 'Discount'}</span>
                      <span className="text-gray-900">{formatCurrency(detail.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="px-4 py-3 bg-blue-50 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Net Sales</span>
                  <span className="font-bold text-blue-600">
                    {formatCurrency(statement.revenue?.netSales?.amount)}
                  </span>
                </div>
              </div>
              
              <div className="px-4 py-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">Other Revenue</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(statement.revenue?.otherRevenue?.amount)}
                  </span>
                </div>
              </div>
              
              <div className="px-4 py-4 bg-green-50 border-t-2 border-green-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">Total Revenue</span>
                  <span className="text-xl font-bold text-green-600">
                    {formatCurrency(statement.revenue?.totalRevenue?.amount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Cost of Goods Sold Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Calculator className="h-5 w-5 text-red-500 mr-2" />
              Cost of Goods Sold
            </h2>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">Beginning Inventory</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(statement.costOfGoodsSold?.beginningInventory)}
                  </span>
                </div>
              </div>
              
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">Purchases</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(statement.costOfGoodsSold?.purchases?.amount)}
                  </span>
                </div>
              </div>
              
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">Freight In</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(statement.costOfGoodsSold?.freightIn)}
                  </span>
                </div>
              </div>
              
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">Less: Purchase Returns</span>
                  <span className="font-semibold text-green-600">
                    -{formatCurrency(statement.costOfGoodsSold?.purchaseReturns)}
                  </span>
                </div>
              </div>
              
              {showDetails && statement.costOfGoodsSold?.purchaseReturnDetails?.length > 0 && (
                <div className="px-4 py-2 bg-gray-25 border-b border-gray-200">
                  {statement.costOfGoodsSold.purchaseReturnDetails.map((returnDetail, index) => (
                    <div key={index} className="flex justify-between items-center py-1 text-sm">
                      <span className="text-gray-600 ml-4">
                        • {returnDetail.supplier || returnDetail.invoiceNumber || 'Return'}
                        {returnDetail.date && (
                          <span className="ml-2 text-xs text-gray-500">
                            ({new Date(returnDetail.date).toLocaleDateString()})
                          </span>
                        )}
                      </span>
                      <span className="text-gray-900">{formatCurrency(returnDetail.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">Less: Purchase Discounts</span>
                  <span className="font-semibold text-green-600">
                    -{formatCurrency(statement.costOfGoodsSold?.purchaseDiscounts)}
                  </span>
                </div>
              </div>
              
              {showDetails && statement.costOfGoodsSold?.purchaseDiscountDetails?.length > 0 && (
                <div className="px-4 py-2 bg-gray-25 border-b border-gray-200">
                  {statement.costOfGoodsSold.purchaseDiscountDetails.map((discountDetail, index) => (
                    <div key={index} className="flex justify-between items-center py-1 text-sm">
                      <span className="text-gray-600 ml-4">
                        • {discountDetail.supplier || discountDetail.invoiceNumber || 'Discount'}
                        {discountDetail.date && (
                          <span className="ml-2 text-xs text-gray-500">
                            ({new Date(discountDetail.date).toLocaleDateString()})
                          </span>
                        )}
                      </span>
                      <span className="text-gray-900">{formatCurrency(discountDetail.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">Less: Ending Inventory</span>
                  <span className="font-semibold text-green-600">
                    -{formatCurrency(statement.costOfGoodsSold?.endingInventory)}
                  </span>
                </div>
              </div>
              
              <div className="px-4 py-4 bg-red-50 border-t-2 border-red-200">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-lg font-bold text-gray-900">Total Cost of Goods Sold</span>
                    {statement.costOfGoodsSold?.totalCOGS?.calculationMethod && (
                      <p className="text-xs text-gray-500 mt-1">
                        Calculation Method: <span className="font-medium capitalize">{statement.costOfGoodsSold.totalCOGS.calculationMethod.replace('_', ' ')}</span>
                        {statement.costOfGoodsSold?.cogsFromInventoryFormula && 
                         statement.costOfGoodsSold.cogsFromInventoryFormula !== statement.costOfGoodsSold?.totalCOGS?.amount && (
                          <span className="ml-2">
                            (Formula: {formatCurrency(statement.costOfGoodsSold.cogsFromInventoryFormula)})
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <span className="text-xl font-bold text-red-600">
                    {formatCurrency(statement.costOfGoodsSold?.totalCOGS?.amount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Gross Profit */}
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-gray-900">Gross Profit</span>
              <div className="text-right">
                <span className="text-2xl font-bold text-green-600">
                  {formatCurrency(statement.grossProfit?.amount)}
                </span>
                <p className="text-sm text-green-700">
                  {formatPercent(statement.grossProfit?.margin)} gross margin
                </p>
              </div>
            </div>
          </div>

          {/* Operating Expenses */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TrendingDown className="h-5 w-5 text-orange-500 mr-2" />
              Operating Expenses
            </h2>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <span className="font-semibold text-gray-900">Selling Expenses</span>
                <span className="float-right font-semibold text-gray-900">
                  {formatCurrency(statement.operatingExpenses?.sellingExpenses?.total)}
                </span>
              </div>
              
              {showDetails && statement.operatingExpenses?.sellingExpenses?.details?.length > 0 && (
                <div className="px-4 py-2 bg-gray-25">
                  {statement.operatingExpenses.sellingExpenses.details.map((detail, index) => (
                    <div key={index}>
                      <div className="flex justify-between items-center py-1 text-sm">
                        <div className="flex-1">
                          <span className="text-gray-600 ml-4 font-medium">{detail.category?.replace(/_/g, ' ') || 'Category'}</span>
                          {/* Budget Variance */}
                          {detail.budget && (
                            <div className="ml-4 mt-1 text-xs">
                              <span className="text-gray-500">Budget: {formatCurrency(detail.budget.amount)}</span>
                              <span className={`ml-2 ${detail.budget.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                Variance: {formatCurrency(detail.budget.variance)} ({formatPercent(Math.abs(detail.budget.variancePercent))})
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="text-gray-900 font-medium">{formatCurrency(detail.amount)}</span>
                      </div>
                      {/* Subcategories (Transaction Details) */}
                      {detail.subcategories && detail.subcategories.length > 0 && (
                        <div className="ml-8 mt-1 space-y-1">
                          {detail.subcategories.map((subcat, subIndex) => (
                            <div key={subIndex} className="flex justify-between items-center text-xs text-gray-500">
                              <span className="ml-2">• {subcat.name || subcat.transactionId || 'Transaction'}</span>
                              <span>{formatCurrency(subcat.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              <div className="px-4 py-3 border-b border-gray-200">
                <span className="font-semibold text-gray-900">Administrative Expenses</span>
                <span className="float-right font-semibold text-gray-900">
                  {formatCurrency(statement.operatingExpenses?.administrativeExpenses?.total)}
                </span>
              </div>
              
              {showDetails && statement.operatingExpenses?.administrativeExpenses?.details?.length > 0 && (
                <div className="px-4 py-2 bg-gray-25">
                  {statement.operatingExpenses.administrativeExpenses.details.map((detail, index) => (
                    <div key={index}>
                      <div className="flex justify-between items-center py-1 text-sm">
                        <div className="flex-1">
                          <span className="text-gray-600 ml-4 font-medium">{detail.category?.replace(/_/g, ' ') || 'Category'}</span>
                          {/* Budget Variance */}
                          {detail.budget && (
                            <div className="ml-4 mt-1 text-xs">
                              <span className="text-gray-500">Budget: {formatCurrency(detail.budget.amount)}</span>
                              <span className={`ml-2 ${detail.budget.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                Variance: {formatCurrency(detail.budget.variance)} ({formatPercent(Math.abs(detail.budget.variancePercent))})
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="text-gray-900 font-medium">{formatCurrency(detail.amount)}</span>
                      </div>
                      {/* Subcategories (Transaction Details) */}
                      {detail.subcategories && detail.subcategories.length > 0 && (
                        <div className="ml-8 mt-1 space-y-1">
                          {detail.subcategories.map((subcat, subIndex) => (
                            <div key={subIndex} className="flex justify-between items-center text-xs text-gray-500">
                              <span className="ml-2">• {subcat.name || subcat.transactionId || 'Transaction'}</span>
                              <span>{formatCurrency(subcat.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              <div className="px-4 py-4 bg-orange-50 border-t-2 border-orange-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">Total Operating Expenses</span>
                  <span className="text-xl font-bold text-orange-600">
                    {formatCurrency(statement.operatingExpenses?.totalOperatingExpenses?.amount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Operating Income */}
          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6">
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-gray-900">Operating Income</span>
              <div className="text-right">
                <span className={`text-2xl font-bold ${getAmountColor(statement.operatingIncome?.amount)}`}>
                  {formatCurrency(statement.operatingIncome?.amount)}
                </span>
                <p className="text-sm text-purple-700">
                  {formatPercent(statement.operatingIncome?.margin)} operating margin
                </p>
              </div>
            </div>
          </div>

          {/* Other Income and Expenses */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Percent className="h-5 w-5 text-indigo-500 mr-2" />
              Other Income and Expenses
            </h2>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">Other Income</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(statement.otherIncome?.totalOtherIncome?.amount)}
                  </span>
                </div>
              </div>
              
              {showDetails && (
                <div className="px-4 py-2 bg-gray-25 border-b border-gray-200">
                  {statement.otherIncome?.interestIncome > 0 && (
                    <div className="flex justify-between items-center py-1 text-sm">
                      <span className="text-gray-600 ml-4">Interest Income</span>
                      <span className="text-gray-900">{formatCurrency(statement.otherIncome.interestIncome)}</span>
                    </div>
                  )}
                  {statement.otherIncome?.rentalIncome > 0 && (
                    <div className="flex justify-between items-center py-1 text-sm">
                      <span className="text-gray-600 ml-4">Rental Income</span>
                      <span className="text-gray-900">{formatCurrency(statement.otherIncome.rentalIncome)}</span>
                    </div>
                  )}
                  {statement.otherIncome?.other?.amount > 0 && (
                    <div className="flex justify-between items-center py-1 text-sm">
                      <span className="text-gray-600 ml-4">Other Income</span>
                      <span className="text-gray-900">{formatCurrency(statement.otherIncome.other.amount)}</span>
                    </div>
                  )}
                  {statement.otherIncome?.other?.details?.length > 0 && (
                    <div className="ml-8 mt-1 space-y-1">
                      {statement.otherIncome.other.details.map((detail, index) => (
                        <div key={index} className="flex justify-between items-center text-xs text-gray-500">
                          <span className="ml-2">• {detail.source || detail.description || 'Other'}</span>
                          <span>{formatCurrency(detail.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">Other Expenses</span>
                  <span className="font-semibold text-red-600">
                    {formatCurrency(statement.otherExpenses?.totalOtherExpenses?.amount)}
                  </span>
                </div>
              </div>
              
              {showDetails && (
                <div className="px-4 py-2 bg-gray-25 border-b border-gray-200">
                  {statement.otherExpenses?.interestExpense > 0 && (
                    <div className="flex justify-between items-center py-1 text-sm">
                      <span className="text-gray-600 ml-4">Interest Expense</span>
                      <span className="text-gray-900">{formatCurrency(statement.otherExpenses.interestExpense)}</span>
                    </div>
                  )}
                  {statement.otherExpenses?.depreciation > 0 && (
                    <div className="flex justify-between items-center py-1 text-sm">
                      <span className="text-gray-600 ml-4">Depreciation</span>
                      <span className="text-gray-900">{formatCurrency(statement.otherExpenses.depreciation)}</span>
                    </div>
                  )}
                  {statement.otherExpenses?.amortization > 0 && (
                    <div className="flex justify-between items-center py-1 text-sm">
                      <span className="text-gray-600 ml-4">Amortization</span>
                      <span className="text-gray-900">{formatCurrency(statement.otherExpenses.amortization)}</span>
                    </div>
                  )}
                  {statement.otherExpenses?.other?.amount > 0 && (
                    <div className="flex justify-between items-center py-1 text-sm">
                      <span className="text-gray-600 ml-4">Other Expenses</span>
                      <span className="text-gray-900">{formatCurrency(statement.otherExpenses.other.amount)}</span>
                    </div>
                  )}
                  {statement.otherExpenses?.other?.details?.length > 0 && (
                    <div className="ml-8 mt-1 space-y-1">
                      {statement.otherExpenses.other.details.map((detail, index) => (
                        <div key={index} className="flex justify-between items-center text-xs text-gray-500">
                          <span className="ml-2">• {detail.category || detail.description || 'Other'}</span>
                          <span>{formatCurrency(detail.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              <div className="px-4 py-4 bg-indigo-50 border-t-2 border-indigo-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">Earnings Before Tax</span>
                  <span className={`text-xl font-bold ${getAmountColor(statement.earningsBeforeTax?.amount)}`}>
                    {formatCurrency(statement.earningsBeforeTax?.amount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sales Tax */}
          {statement.salesTax && statement.salesTax.amount > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-lg font-bold text-gray-900">Sales Tax</span>
                  {showDetails && statement.salesTax.taxableSales > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      Taxable Sales: {formatCurrency(statement.salesTax.taxableSales)}
                      {statement.salesTax.taxExemptSales > 0 && (
                        <span className="ml-4">Tax Exempt: {formatCurrency(statement.salesTax.taxExemptSales)}</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-blue-600">
                    {formatCurrency(statement.salesTax.amount)}
                  </span>
                  {statement.salesTax.taxableSales > 0 && (
                    <p className="text-sm text-blue-700">
                      {formatPercent((statement.salesTax.amount / statement.salesTax.taxableSales) * 100)} effective rate
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Income Tax */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-lg font-bold text-gray-900">Income Tax</span>
                {showDetails && statement.incomeTax?.current > 0 && statement.incomeTax?.deferred > 0 && (
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Current Tax:</span>
                      <span className="font-medium">{formatCurrency(statement.incomeTax.current)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Deferred Tax:</span>
                      <span className="font-medium">{formatCurrency(statement.incomeTax.deferred)}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="text-right">
                <span className="text-xl font-bold text-gray-900">
                  {formatCurrency(statement.incomeTax?.total?.amount)}
                </span>
                <p className="text-sm text-gray-600">
                  {formatPercent(statement.incomeTax?.total?.rate)} tax rate
                </p>
              </div>
            </div>
          </div>

          {/* Net Income */}
          <div className={`border-2 rounded-xl p-8 shadow-sm transition-all ${
            netIncome >= 0 
              ? 'bg-slate-900 border-slate-900' 
              : 'bg-white border-rose-200 shadow-rose-100/50'
          }`}>
            <div className="flex justify-between items-center">
              <div>
                <span className={`text-2xl font-bold tracking-tight ${
                  netIncome >= 0 ? 'text-white' : 'text-slate-900'
                }`}>Net Income</span>
                <p className={`text-sm mt-1 font-medium ${
                  netIncome >= 0 ? 'text-slate-400' : 'text-slate-500'
                }`}>Comprehensive profit/loss after all deductions</p>
              </div>
              <div className="text-right">
                <span className={`text-4xl font-extrabold tracking-tighter ${
                  netIncome >= 0 ? 'text-emerald-400' : 'text-rose-600'
                }`}>
                  {formatCurrency(statement.netIncome?.amount)}
                </span>
                <p className={`text-sm mt-1 font-bold ${
                  netIncome >= 0 ? 'text-emerald-500/80' : 'text-rose-500'
                }`}>
                  {formatPercent(statement.netIncome?.margin)} net margin
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        {statement.keyMetrics && (
          <div className="mt-8 bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Performance Metrics</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Gross Profit Margin</p>
                <p className="text-lg font-semibold text-green-600">
                  {formatPercent(statement.keyMetrics.grossProfitMargin)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Operating Margin</p>
                <p className="text-lg font-semibold text-purple-600">
                  {formatPercent(statement.keyMetrics.operatingMargin)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Net Profit Margin</p>
                <p className="text-lg font-semibold text-green-600">
                  {formatPercent(statement.keyMetrics.netProfitMargin)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">EBITDA</p>
                <p className="text-lg font-semibold text-blue-600">
                  {formatCurrency(statement.keyMetrics.ebitda)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Comparisons */}
        {statement.comparison && (
          <div className="mt-8 bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Period Comparisons</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {statement.comparison.previousPeriod && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">vs Previous Period</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Previous Net Income:</span>
                      <span className="font-medium">
                        {formatCurrency(statement.comparison.previousPeriod.netIncome)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Change:</span>
                      <span className={`font-medium ${getAmountColor(statement.comparison.previousPeriod.change)}`}>
                        {formatCurrency(statement.comparison.previousPeriod.change)}
                        ({formatPercent(statement.comparison.previousPeriod.changePercent)})
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {statement.comparison.budget && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">vs Budget</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Budgeted Net Income:</span>
                      <span className="font-medium">
                        {formatCurrency(statement.comparison.budget.netIncome)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Variance:</span>
                      <span className={`font-medium ${getAmountColor(statement.comparison.budget.variance)}`}>
                        {formatCurrency(statement.comparison.budget.variance)}
                        ({formatPercent(statement.comparison.budget.variancePercent)})
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {statement.notes && statement.notes.length > 0 && (
          <div className="mt-8">
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
            >
              <span className="mr-2">{showNotes ? 'Hide' : 'Show'} Notes</span>
              {showNotes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            
            {showNotes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Statement Notes</h4>
                <div className="space-y-2">
                  {statement.notes.map((note, index) => (
                    <div key={index} className="text-sm text-gray-700">
                      <span className="font-medium">{note.section}:</span> {note.note}
                      {note.amount && (
                        <span className="ml-2 font-medium text-gray-900">
                          ({formatCurrency(note.amount)})
                        </span>
                      )}
                      <span className="ml-2 text-gray-500">
                        - {formatDate(note.date)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-sm text-gray-500">
          <div className="flex justify-between items-center">
            <div>
              <p>Generated on {formatDate(statement.createdAt)}</p>
              {statement.generatedBy && (
                <p>Generated by: {statement.generatedBy.firstName} {statement.generatedBy.lastName}</p>
              )}
            </div>
            <div>
              {statement.approvedBy && (
                <p>Approved by: {statement.approvedBy.firstName} {statement.approvedBy.lastName}</p>
              )}
              {statement.approvedAt && (
                <p>Approved on: {formatDate(statement.approvedAt)}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PLStatementDetail;
