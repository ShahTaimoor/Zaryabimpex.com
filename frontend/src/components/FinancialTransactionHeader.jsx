import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, CreditCard, Building, ArrowUpDown, Wallet } from 'lucide-react';

const FinancialTransactionHeader = ({ children }) => {
  const navigate = useNavigate();

  const transactionButtons = [
    {
      id: 'cash-receipt',
      label: 'Cash Receipt',
      color: 'bg-green-500 hover:bg-green-600',
      icon: Receipt,
      route: '/cash-receipts'
    },
    {
      id: 'cash-payment',
      label: 'Cash Payment',
      color: 'bg-blue-500 hover:bg-blue-600',
      icon: CreditCard,
      route: '/cash-payments'
    },
    {
      id: 'bank-receipt',
      label: 'Bank Receipt',
      color: 'bg-purple-500 hover:bg-purple-600',
      icon: Building,
      route: '/bank-receipts'
    },
    {
      id: 'bank-payment',
      label: 'Bank Payment',
      color: 'bg-orange-500 hover:bg-orange-600',
      icon: ArrowUpDown,
      route: '/bank-payments'
    },
    {
      id: 'expense-entry',
      label: 'Record Expense',
      color: 'bg-red-500 hover:bg-red-600',
      icon: Wallet,
      route: '/expenses'
    }
  ];

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-3 lg:space-y-0">
        <div className="flex flex-wrap justify-center lg:justify-start gap-3">
          {transactionButtons.map((button) => {
            const IconComponent = button.icon;
            return (
              <button
                key={button.id}
                onClick={() => navigate(button.route)}
                className={`${button.color} text-white px-5 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center space-x-2 font-medium`}
              >
                <IconComponent className="h-5 w-5" />
                <span>{button.label}</span>
              </button>
            );
          })}
        </div>
        {children && (
          <div className="flex justify-center lg:justify-end">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialTransactionHeader;
