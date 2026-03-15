import React from 'react';
import { Users, Building, User, Edit, Trash2, MessageSquare } from 'lucide-react';

export const CustomerList = ({
  customers,
  searchTerm,
  onEdit,
  onDelete,
  onShowNotes
}) => {
  if (customers.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No customers found</h3>
        <p className="mt-1 text-sm text-gray-500">
          {searchTerm ? 'Try adjusting your search terms.' : 'Get started by adding a new customer.'}
        </p>
      </div>
    );
  }

  return (
    <div className="card w-full">
      <div className="card-content p-0 w-full">
        <div className="hidden md:block bg-gray-50 px-4 lg:px-8 py-4 lg:py-6 border-b border-gray-200">
          <div className="grid grid-cols-12 gap-3 lg:gap-4 items-center">

            <div className="col-span-4">
              <h3 className="text-sm lg:text-base font-medium text-gray-700">Business Name</h3>
              <p className="text-xs lg:text-sm text-gray-500">Contact Person</p>
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
              <h3 className="text-sm lg:text-base font-medium text-gray-700">Tier</h3>
            </div>
            <div className="col-span-1">
              <h3 className="text-sm lg:text-base font-medium text-gray-700">Opening</h3>
            </div>
            <div className="col-span-1">
              <h3 className="text-sm lg:text-base font-medium text-gray-700">Balance</h3>
            </div>
            <div className="col-span-1 text-right">
              <h3 className="text-sm lg:text-base font-medium text-gray-700">Actions</h3>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {customers.map((customer) => (
            <div key={customer.id || customer._id} className="px-4 py-4 lg:px-8 lg:py-6 hover:bg-gray-50">
              {/* Mobile Card Layout */}
              <div className="md:hidden space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {customer.businessType === 'individual' ? (
                      <User className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    ) : (
                      <Building className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {customer.businessName || customer.business_name || customer.displayName}
                      </h3>
                      <p className="text-xs text-gray-500 truncate">
                        {customer.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-2">
                    <button
                      onClick={() => onShowNotes(customer)}
                      className="text-green-600 hover:text-green-800 p-1"
                      title="Notes"
                    >
                      <MessageSquare className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => onEdit(customer)}
                      className="text-primary-600 hover:text-primary-800 p-1"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => onDelete(customer)}
                      className="text-danger-600 hover:text-danger-800 p-1"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">

                  <div>
                    <p className="text-gray-500 mb-1">Phone</p>
                    <p className="text-gray-700">{customer.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Status</p>
                    <span className={`badge ${customer.status === 'active' ? 'badge-success' : 'badge-gray'
                      }`}>
                      {customer.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Type</p>
                    <span className={`badge ${customer.businessType === 'wholesale' ? 'badge-info' : 'badge-gray'
                      }`}>
                      {customer.businessType}
                    </span>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Tier</p>
                    <span className={`badge ${customer.customerTier === 'gold' ? 'badge-warning' :
                      customer.customerTier === 'platinum' ? 'badge-info' : 'badge-gray'
                      }`}>
                      {customer.customerTier}
                    </span>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Opening</p>
                    <p className="text-gray-700">{Math.round(customer.openingBalance || customer.opening_balance || 0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Balance</p>
                    <p className={`font-semibold ${customer.currentBalance > 0 ? 'text-red-600' : customer.currentBalance < 0 ? 'text-green-600' : 'text-gray-700'}`}>
                      {Math.round(customer.currentBalance || 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Desktop Table Layout */}
              <div className="hidden md:grid grid-cols-12 gap-3 lg:gap-4 items-center">


                <div className="col-span-4 min-w-0">
                  <div className="flex items-center space-x-3 lg:space-x-4">
                    {customer.businessType === 'individual' ? (
                      <User className="h-5 w-5 lg:h-6 lg:w-6 text-gray-400 flex-shrink-0" />
                    ) : (
                      <Building className="h-5 w-5 lg:h-6 lg:w-6 text-gray-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm lg:text-base font-medium text-gray-900 truncate" title={customer.businessName || customer.business_name || customer.displayName}>
                        {customer.businessName || customer.business_name || customer.displayName}
                      </h3>
                      <p className="text-xs lg:text-sm text-gray-500 truncate" title={customer.name}>
                        {customer.name}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="col-span-1">
                  <p className="text-xs lg:text-sm text-gray-600">{customer.phone || '-'}</p>
                </div>

                <div className="col-span-1">
                  <span className={`badge ${customer.status === 'active' ? 'badge-success' : 'badge-gray'
                    }`}>
                    {customer.status}
                  </span>
                </div>

                <div className="col-span-1">
                  <span className={`badge ${customer.businessType === 'wholesale' ? 'badge-info' : 'badge-gray'
                    }`}>
                    {customer.businessType}
                  </span>
                </div>

                <div className="col-span-1">
                  <span className={`badge ${customer.customerTier === 'gold' ? 'badge-warning' :
                    customer.customerTier === 'platinum' ? 'badge-info' : 'badge-gray'
                    }`}>
                    {customer.customerTier}
                  </span>
                </div>

                <div className="col-span-1">
                  <p className="text-xs lg:text-sm text-gray-600">{Math.round(customer.openingBalance || customer.opening_balance || 0)}</p>
                </div>

                <div className="col-span-1">
                  <p className={`text-xs lg:text-sm font-semibold ${customer.currentBalance > 0 ? 'text-red-600' : customer.currentBalance < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                    {Math.round(customer.currentBalance || 0)}
                  </p>
                </div>

                <div className="col-span-1 flex justify-end">
                  <div className="flex items-center flex-nowrap gap-1">
                    <button
                      onClick={() => onShowNotes(customer)}
                      className="text-green-600 hover:text-green-800 p-1"
                      title="Notes"
                    >
                      <MessageSquare className="h-4 w-4 lg:h-5 lg:w-5" />
                    </button>
                    <button
                      onClick={() => onEdit(customer)}
                      className="text-primary-600 hover:text-primary-800 p-1"
                    >
                      <Edit className="h-4 w-4 lg:h-5 lg:w-5" />
                    </button>
                    <button
                      onClick={() => onDelete(customer)}
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
  );
};

