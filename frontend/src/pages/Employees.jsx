import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Users,
  User,
  X,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  TrendingUp,
  Building,
  Clock,
  Filter
} from 'lucide-react';
import {
  useGetEmployeesQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
  useGetDepartmentsQuery,
  useGetPositionsQuery,
} from '../store/services/employeesApi';
import { useGetUsersQuery } from '../store/services/usersApi';
import toast from 'react-hot-toast';
import { LoadingSpinner, LoadingButton } from '../components/LoadingSpinner';
import { handleApiError, showSuccessToast } from '../utils/errorHandler';
import { formatDate } from '../utils/formatters';
import { DeleteConfirmationDialog } from '../components/ConfirmationDialog';
import { useDeleteConfirmation } from '../hooks/useConfirmation';

const Employees = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    employeeId: '',
    email: '',
    phone: '',
    position: '',
    department: '',
    hireDate: new Date().toISOString().split('T')[0],
    employmentType: 'full_time',
    status: 'active',
    salary: '',
    hourlyRate: '',
    payFrequency: 'monthly',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'US'
    },
    userAccount: '',
    notes: ''
  });

  const { confirmation, confirmDelete, handleConfirm, handleCancel } = useDeleteConfirmation();

  // Fetch employees
  const { data: employeesData, isLoading, refetch, error: employeesError } = useGetEmployeesQuery({
    search: searchTerm,
    status: statusFilter,
    department: departmentFilter,
    page: currentPage,
    limit: 20
  }, {
    keepPreviousData: true,
  });

  React.useEffect(() => {
    if (employeesError) {
      handleApiError(employeesError, 'Failed to fetch employees');
    }
  }, [employeesError]);

  // Fetch users for linking
  const { data: usersData } = useGetUsersQuery(
    { limit: 100 },
    {
      skip: !showForm,
      staleTime: 5 * 60 * 1000
    }
  );
  const users = React.useMemo(() => {
    return usersData?.data?.users || usersData?.users || [];
  }, [usersData]);

  // Fetch departments and positions
  const { data: departmentsData } = useGetDepartmentsQuery();
  const { data: positionsData } = useGetPositionsQuery();

  const employees = employeesData?.data?.employees || employeesData?.employees || [];
  const pagination = employeesData?.data?.pagination || employeesData?.pagination || {};

  // Create employee mutation
  const [createEmployee, { isLoading: creating }] = useCreateEmployeeMutation();

  // Update employee mutation
  const [updateEmployee, { isLoading: updating }] = useUpdateEmployeeMutation();

  // Delete employee mutation
  const [deleteEmployee, { isLoading: deleting }] = useDeleteEmployeeMutation();

  // Handle mutations with callbacks
  const handleCreateEmployee = async (data) => {
    try {
      await createEmployee(data).unwrap();
      showSuccessToast('Employee created successfully');
      resetForm();
    } catch (error) {
      handleApiError(error, 'Failed to create employee');
    }
  };

  const handleUpdateEmployee = async ({ id, data }) => {
    try {
      await updateEmployee({ id, data }).unwrap();
      showSuccessToast('Employee updated successfully');
      resetForm();
    } catch (error) {
      handleApiError(error, 'Failed to update employee');
    }
  };

  const handleDeleteEmployee = async (id) => {
    try {
      await deleteEmployee(id).unwrap();
      showSuccessToast('Employee deleted successfully');
    } catch (error) {
      handleApiError(error, 'Failed to delete employee');
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      employeeId: '',
      email: '',
      phone: '',
      position: '',
      department: '',
      hireDate: new Date().toISOString().split('T')[0],
      employmentType: 'full_time',
      status: 'active',
      salary: '',
      hourlyRate: '',
      payFrequency: 'monthly',
      address: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US'
      },
      userAccount: '',
      notes: ''
    });
    setSelectedEmployee(null);
    setShowForm(false);
  };

  const handleEdit = (employee) => {
    setSelectedEmployee(employee);
    setFormData({
      firstName: employee.firstName || '',
      lastName: employee.lastName || '',
      employeeId: employee.employeeId || '',
      email: employee.email || '',
      phone: employee.phone || '',
      position: employee.position || '',
      department: employee.department || '',
      hireDate: employee.hireDate ? new Date(employee.hireDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      employmentType: employee.employmentType || 'full_time',
      status: employee.status || 'active',
      salary: employee.salary || '',
      hourlyRate: employee.hourlyRate || '',
      payFrequency: employee.payFrequency || 'monthly',
      address: employee.address || {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US'
      },
      userAccount: employee.userAccount?._id || employee.userAccount || '',
      notes: employee.notes || ''
    });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...formData };
    
    // Clean up empty fields
    if (!data.employeeId) delete data.employeeId;
    if (!data.email) delete data.email;
    if (!data.salary) delete data.salary;
    if (!data.hourlyRate) delete data.hourlyRate;
    if (!data.userAccount) delete data.userAccount;

    if (selectedEmployee) {
      handleUpdateEmployee({ id: selectedEmployee._id, data });
    } else {
      handleCreateEmployee(data);
    }
  };

  const handleDelete = (employee) => {
    const employeeName = `${employee.firstName} ${employee.lastName}`;
    confirmDelete(employeeName, 'Employee', async () => {
      try {
        await handleDeleteEmployee(employee._id);
      } catch (error) {
        // Error already handled in handleDeleteEmployee
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-8 bg-gray-50/30 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center">
            <div className="bg-primary-100 p-2 rounded-lg mr-4">
              <Users className="h-7 w-7 text-primary-600" />
            </div>
            Employee Directory
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Manage human resources and organizational structure</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center space-x-2 px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-all shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Personnel</p>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{pagination.total || 0}</h3>
          <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-tight">Active workforce</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Departments</p>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{departmentsData?.data?.departments?.length || 0}</h3>
          <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-tight">Operational units</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Active Now</p>
          <h3 className="text-3xl font-black text-emerald-600 tracking-tighter">
            {employees.filter(e => e.status === 'active').length}
          </h3>
          <div className="mt-2 text-[10px] font-bold text-emerald-500 uppercase tracking-tight">Productive status</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">On Leave</p>
          <h3 className="text-3xl font-black text-amber-600 tracking-tighter">
            {employees.filter(e => e.status === 'on_leave').length}
          </h3>
          <div className="mt-2 text-[10px] font-bold text-amber-500 uppercase tracking-tight">Away from office</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, ID or position..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-medium text-slate-700"
              />
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">All Departments</option>
                {departmentsData?.data?.departments?.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="terminated">Terminated</option>
                <option value="on_leave">On Leave</option>
              </select>
            </div>
          </div>

          <div className="lg:col-span-1 flex justify-end">
            <button 
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setDepartmentFilter('');
              }}
              className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
              title="Clear Filters"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-20 text-center"><LoadingSpinner /></div>
          ) : employees.length === 0 ? (
            <div className="py-24 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-slate-200" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No records found</h3>
              <p className="text-slate-400 text-sm max-w-xs mx-auto mt-1">Try adjusting your search or filters to find what you're looking for.</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Employee</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Role & Unit</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Contact Info</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Hiring Date</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((employee) => (
                  <tr key={employee._id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold uppercase tracking-tight">
                          {employee.firstName[0]}{employee.lastName[0]}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{employee.firstName} {employee.lastName}</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">ID: {employee.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-sm font-bold text-slate-700">{employee.position}</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <Building className="h-3 w-3 text-slate-300" />
                        <span className="text-xs font-medium text-slate-500">{employee.department || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-xs font-medium text-slate-600">
                          <Mail className="h-3 w-3 text-slate-400" />
                          <span>{employee.email || 'N/A'}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-xs font-medium text-slate-600">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span>{employee.phone || 'N/A'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-sm font-bold text-slate-700">{formatDate(employee.hireDate)}</span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                        Tenure: {Math.floor((new Date() - new Date(employee.hireDate)) / (1000 * 60 * 60 * 24 * 365))} Years
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            employee.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : employee.status === 'terminated'
                              ? 'bg-rose-100 text-rose-700'
                              : employee.status === 'on_leave'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {employee.status.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(employee)}
                          className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-primary-600 hover:border-primary-200 rounded-lg shadow-sm transition-all"
                          title="Edit Profile"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(employee)}
                          className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200 rounded-lg shadow-sm transition-all"
                          title="Archive Record"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Showing {((currentPage - 1) * (pagination.limit || 20)) + 1} - {Math.min(currentPage * (pagination.limit || 20), pagination.total)} of {pagination.total} records
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-1.5 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(pagination.pages, p + 1))}
                disabled={currentPage === pagination.pages}
                className="px-4 py-1.5 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Employee Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  {selectedEmployee ? 'Edit Personnel Profile' : 'Register New Personnel'}
                </h2>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mt-1">Fill in the required information below</p>
              </div>
              <button
                onClick={resetForm}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1">
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Basic Section */}
                <div>
                  <h3 className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-6 border-b border-primary-100 pb-2">Primary Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">First Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm font-medium"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Last Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm font-medium"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Employee ID</label>
                      <input
                        type="text"
                        value={formData.employeeId}
                        onChange={(e) => setFormData({ ...formData, employeeId: e.target.value.toUpperCase() })}
                        placeholder="AUTO-GENERATE"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm font-bold uppercase tracking-widest placeholder:text-slate-300"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Professional Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm font-medium"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Phone Number</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Assignment Section */}
                <div>
                  <h3 className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-6 border-b border-primary-100 pb-2">Organizational Assignment</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Job Position *</label>
                      <input
                        type="text"
                        required
                        value={formData.position}
                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Department</label>
                      <input
                        type="text"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Date of Hire *</label>
                      <input
                        type="date"
                        required
                        value={formData.hireDate}
                        onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Employment Type</label>
                      <select
                        value={formData.employmentType}
                        onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm font-bold uppercase tracking-widest"
                      >
                        <option value="full_time">Full Time</option>
                        <option value="part_time">Part Time</option>
                        <option value="contract">Contract</option>
                        <option value="temporary">Temporary</option>
                        <option value="intern">Intern</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Operational Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm font-bold uppercase tracking-widest"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="terminated">Terminated</option>
                        <option value="on_leave">On Leave</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Linked System Account</label>
                      <select
                        value={formData.userAccount}
                        onChange={(e) => setFormData({ ...formData, userAccount: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm font-medium"
                      >
                        <option value="">None / Unlinked</option>
                        {users?.filter(u => !u.employeeLinked || u._id === formData.userAccount).map((user) => (
                          <option key={user._id} value={user._id}>
                            {user.firstName} {user.lastName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="pt-6 border-t border-slate-200 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2.5 text-xs font-bold text-slate-600 uppercase tracking-widest hover:bg-slate-200 rounded-xl transition-all"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={creating || updating}
                  >
                    {creating || updating ? (
                      <LoadingSpinner size="sm" />
                    ) : selectedEmployee ? (
                      'Confirm Updates'
                    ) : (
                      'Create Personnel Record'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={confirmation.isOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        itemName={confirmation.message?.match(/"([^"]*)"/)?.[1] || ''}
        itemType="Employee"
        isLoading={deleting}
      />
    </div>
  );
};

export default Employees;

