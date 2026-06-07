import React, { useState, memo } from 'react';
import {
  Users,
  User,
  Plus,
  Trash2,
  Edit,
  Shield,
  UserCheck,
  Save,
  X,
  Check,
  Clock,
  TrendingUp,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  UserPlus,
  BarChart3,
  Mail,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetUsersQuery,
  useGetUserActivityQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useResetPasswordMutation,
  useUpdateRolePermissionsMutation,
} from '../../store/services/usersApi';
import { useChangePasswordMutation } from '../../store/services/authApi';
import { LoadingSpinner, LoadingButton } from '../../components/LoadingSpinner';
import { handleApiError } from '../../utils/errorHandler';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { DeleteConfirmationDialog } from '../../components/ConfirmationDialog';
import { useDeleteConfirmation } from '../../hooks/useConfirmation';
import { PAGE_PERMISSION_GROUPS, DEFAULT_ROLE_PERMISSIONS } from './usersPermissionsConfig';

export const UsersSettingsTab = memo(function UsersSettingsTab() {
  const { user } = useAuth();
  const {
    confirmation: deleteUserConfirmation,
    confirmDelete: confirmDeleteUser,
    handleConfirm: handleDeleteUserConfirm,
    handleCancel: handleDeleteUserCancel,
  } = useDeleteConfirmation();

  const [activePermissionGroup, setActivePermissionGroup] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [newUserData, setNewUserData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'cashier',
    status: 'active',
    permissions: {},
  });
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showMyPasswordModal, setShowMyPasswordModal] = useState(false);
  const [passwordResetUser, setPasswordResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [rolePermissionsChanged, setRolePermissionsChanged] = useState({});
  const [selectedUserActivity, setSelectedUserActivity] = useState(null);
  const [showActivityModal, setShowActivityModal] = useState(false);

  const { data: usersResponse, isLoading: usersLoading, error: usersError, refetch: refetchUsers } = useGetUsersQuery(
    undefined,
    {
      onError: (error) => {
        if (error?.status === 403) {
          toast.error('Access denied. You need "manage_users" permission to view users.');
        } else if (error?.status === 401) {
          toast.error('Authentication required. Please log in again.');
        } else {
          toast.error(`Failed to load users: ${error?.data?.message || error?.message || 'Unknown error'}`);
        }
        setUsers([]);
      },
    }
  );

  React.useEffect(() => {
    if (usersResponse) {
      let usersArray = null;
      if (usersResponse?.data?.users && Array.isArray(usersResponse.data.users)) {
        usersArray = usersResponse.data.users;
      } else if (usersResponse?.users && Array.isArray(usersResponse.users)) {
        usersArray = usersResponse.users;
      } else if (Array.isArray(usersResponse)) {
        usersArray = usersResponse.filter((item) => item._id && item.email);
      } else {
        const findUsers = (obj, depth = 0) => {
          if (depth > 5) return null;
          if (Array.isArray(obj)) {
            if (obj.length > 0 && obj[0]?._id && obj[0]?.email) return obj;
          }
          if (typeof obj === 'object' && obj !== null) {
            for (const key in obj) {
              if (key === 'users' && Array.isArray(obj[key])) return obj[key];
              const result = findUsers(obj[key], depth + 1);
              if (result) return result;
            }
          }
          return null;
        };
        usersArray = findUsers(usersResponse);
      }
      setUsers(usersArray && Array.isArray(usersArray) ? usersArray : []);
    }
  }, [usersResponse]);

  const [createUser, { isLoading: isCreatingUser }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdatingUser }] = useUpdateUserMutation();
  const [deleteUser] = useDeleteUserMutation();
  const [resetPassword, { isLoading: isResettingPassword }] = useResetPasswordMutation();
  const [changeMyPassword, { isLoading: isChangingMyPassword }] = useChangePasswordMutation();
  const [updateRolePermissions, { isLoading: isUpdatingRolePermissions }] = useUpdateRolePermissionsMutation();

  const { data: userActivityResponse, isLoading: activityLoading } = useGetUserActivityQuery(
    selectedUserActivity?.id,
    { skip: !selectedUserActivity?.id }
  );

  React.useEffect(() => {
    if (userActivityResponse?.data) {
      setSelectedUserActivity((prev) => ({ ...prev, activity: userActivityResponse.data }));
    }
  }, [userActivityResponse]);

  const pagePermissionGroups = PAGE_PERMISSION_GROUPS;

  const createUserAsync = async (userData) => {
    try {
      await createUser(userData).unwrap();
      toast.success('User created successfully!');
      resetNewUserForm();
      refetchUsers();
    } catch (error) {
      handleApiError(error, 'User Creation');
    }
  };

  const handleUpdateUser = async (id, data) => {
    try {
      await updateUser({ id, ...data }).unwrap();
      toast.success('User updated successfully!');
      setEditingUser(null);
      refetchUsers();
    } catch (error) {
      handleApiError(error, 'User Update');
    }
  };

  const handleDeleteUser = async (id) => {
    try {
      await deleteUser(id).unwrap();
      toast.success('User deleted successfully!');
      refetchUsers();
    } catch (error) {
      handleApiError(error, 'User Deletion');
    }
  };

  const handleResetPassword = async (id, password) => {
    try {
      await resetPassword({ id, newPassword: password }).unwrap();
      toast.success('Password reset successfully!');
      setShowPasswordModal(false);
      setPasswordResetUser(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      handleApiError(error, 'Password Reset');
    }
  };

  const handleNewUserChange = (e) => {
    const { name, value } = e.target;
    setNewUserData((prev) => ({ ...prev, [name]: value }));
    if (name === 'role' && DEFAULT_ROLE_PERMISSIONS[value]) {
      setNewUserData((prev) => ({ ...prev, permissions: DEFAULT_ROLE_PERMISSIONS[value] }));
    }
  };

  const handleCreateUser = (e) => {
    e.preventDefault();
    if (!newUserData.firstName.trim()) { toast.error('First name is required'); return; }
    if (!newUserData.lastName.trim()) { toast.error('Last name is required'); return; }
    if (!newUserData.email.trim()) { toast.error('Email is required'); return; }
    if (!newUserData.password.trim()) { toast.error('Password is required'); return; }
    if (newUserData.password.length < 6) { toast.error('Password must be at least 6 characters long'); return; }
    const permissionsArray = Object.keys(newUserData.permissions).filter((key) => newUserData.permissions[key]);
    createUserAsync({ ...newUserData, permissions: permissionsArray });
  };

  const handleEditUser = (editUser) => {
    setEditingUser(editUser);
    const permissionsObject = {};
    if (editUser.permissions && Array.isArray(editUser.permissions)) {
      editUser.permissions.forEach((permission) => { permissionsObject[permission] = true; });
    }
    setNewUserData({
      firstName: editUser.firstName || '',
      lastName: editUser.lastName || '',
      email: editUser.email || '',
      password: '',
      role: editUser.role || 'cashier',
      status: editUser.status || 'active',
      permissions: permissionsObject,
    });
  };

  const handleUpdateUserSubmit = (e) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!newUserData.firstName.trim()) { toast.error('First name is required'); return; }
    if (!newUserData.lastName.trim()) { toast.error('Last name is required'); return; }
    if (!newUserData.email.trim()) { toast.error('Email is required'); return; }
    const permissionsArray = Object.keys(newUserData.permissions).filter((key) => newUserData.permissions[key]);
    const userDataToSend = {
      firstName: newUserData.firstName,
      lastName: newUserData.lastName,
      email: newUserData.email,
      permissions: permissionsArray,
    };
    if (editingUser._id !== user?._id) {
      userDataToSend.role = newUserData.role;
      userDataToSend.status = newUserData.status;
    }
    handleUpdateUser(editingUser._id, userDataToSend);
  };

  const handleDeleteUserClick = (userId, userName = 'this user') => {
    confirmDeleteUser(userName, 'User', () => handleDeleteUser(userId));
  };

  const handlePermissionChange = (permissionKey, isChecked, subcategoryKeys = []) => {
    const permissionUpdates = { [permissionKey]: isChecked };
    subcategoryKeys.forEach((subcategoryKey) => { permissionUpdates[subcategoryKey] = isChecked; });
    setNewUserData((prev) => ({ ...prev, permissions: { ...prev.permissions, ...permissionUpdates } }));
    if (newUserData.role) {
      setRolePermissionsChanged((prev) => ({
        ...prev,
        [newUserData.role]: { ...prev[newUserData.role], ...permissionUpdates },
      }));
    }
  };

  const togglePageAllPermissions = (page, isChecked) => {
    const updates = {};
    ['view', 'create', 'edit', 'delete', 'confirm', 'cancel'].forEach((action) => {
      if (page[action]) updates[page[action]] = isChecked;
    });
    if (Object.keys(updates).length === 0) return;
    setNewUserData((prev) => ({ ...prev, permissions: { ...prev.permissions, ...updates } }));
    if (newUserData.role) {
      setRolePermissionsChanged((prev) => ({
        ...prev,
        [newUserData.role]: { ...prev[newUserData.role], ...updates },
      }));
    }
  };

  const resetNewUserForm = () => {
    setNewUserData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'cashier',
      status: 'active',
      permissions: {},
    });
    setEditingUser(null);
  };

  const handlePasswordReset = () => {
    if (!newPassword.trim()) { toast.error('New password is required'); return; }
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters long'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    const targetUser = passwordResetUser || editingUser;
    if (!targetUser?._id) { toast.error('User not selected'); return; }
    handleResetPassword(targetUser._id, newPassword);
  };

  const handleChangeMyPassword = async () => {
    if (!currentPassword.trim()) { toast.error('Current password is required'); return; }
    if (!newPassword.trim()) { toast.error('New password is required'); return; }
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters long'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    try {
      await changeMyPassword({ currentPassword, newPassword }).unwrap();
      toast.success('Password changed successfully');
      setShowMyPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      handleApiError(error, 'Password Change');
    }
  };

  const openPasswordModal = (userToReset = null) => {
    setPasswordResetUser(userToReset || editingUser);
    setShowPasswordModal(true);
    setNewPassword('');
    setConfirmPassword('');
  };

  const openMyPasswordModal = () => {
    setShowMyPasswordModal(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleUpdateRolePermissions = async (role) => {
    if (!rolePermissionsChanged[role]) {
      toast.error('No permission changes detected for this role');
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to update permissions for ALL users with "${role}" role? This will override their current permissions.`
    );
    if (!confirmed) return;
    const currentPermissions = newUserData.permissions;
    const permissions = Object.keys(currentPermissions).filter((key) => currentPermissions[key]);
    try {
      const result = await updateRolePermissions({ role, permissions }).unwrap();
      toast.success(result?.message || `Permissions updated for all users with the "${role}" role.`);
      setRolePermissionsChanged((prev) => ({ ...prev, [role]: false }));
      refetchUsers();
    } catch (error) {
      handleApiError(error, 'Push Role Permissions');
    }
  };

  const openActivityModal = (activityUser) => {
    setSelectedUserActivity({
      id: activityUser._id,
      name: `${activityUser.firstName} ${activityUser.lastName}`,
      email: activityUser.email,
      role: activityUser.role,
    });
    setShowActivityModal(true);
  };

  return (
    <>
  <div className="space-y-8 max-w-full mx-auto">
    {/* Users List Card */}
    <div className="bg-white border text-gray-900 shadow-sm border-gray-200 rounded-2xl overflow-hidden relative">

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-6 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gray-900 text-white rounded-xl shadow-sm">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">System Users ({users.length})</h2>
            <p className="text-sm text-gray-500 mt-1">
              Manage existing team members, system access, and individual permissions.
            </p>
          </div>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <Button
            onClick={() => {
              resetNewUserForm();
              const form = document.getElementById('add-edit-user-form');
              if (form) {
                form.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                  const firstInput = form.querySelector('input[type="text"]');
                  if (firstInput) {
                    firstInput.focus();
                  }
                }, 300);
              }
            }}
            className="bg-gray-900 text-white hover:bg-gray-800 shadow-md transition-all rounded-lg px-5 py-2.5 h-auto text-sm font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New User
          </Button>
        </div>
      </div>

      <div className="p-0">
        {usersLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : usersError ? (
          <div className="text-center py-12">
            <div className="bg-red-50 border border-red-100 rounded-xl p-6 max-w-md mx-auto shadow-sm">
              <div className="flex items-center justify-center mb-4">
                <div className="p-3 bg-red-100 text-red-600 rounded-full">
                  <X className="h-8 w-8" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-red-900 mb-2">Failed to Load Users</h3>
              <p className="text-sm text-red-700 mb-6 font-medium">
                {usersError.response?.status === 403
                  ? 'You need "manage_users" permission to view users. Please contact an administrator.'
                  : usersError.response?.status === 401
                    ? 'Authentication required. Please refresh the page and log in again.'
                    : usersError.message || 'An error occurred while loading users.'}
              </p>
              <Button onClick={() => refetchUsers()} variant="outline" className="bg-white hover:bg-red-50 border-red-200 text-red-700 font-semibold px-6 py-2 rounded-lg transition-colors">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        ) : users.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {users.map((systemUser) => (
              <li
                key={systemUser._id}
                className="group flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 hover:bg-gray-50/80 transition-all duration-200"
              >
                <div className="flex items-center space-x-5 flex-1 min-w-0">
                  {/* Avatar */}
                  <div className="h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-black text-white font-bold text-xl shadow-sm">
                    {systemUser.firstName?.charAt(0) || ''}{systemUser.lastName?.charAt(0) || ''}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                      <p className="text-base font-bold text-gray-900 truncate tracking-tight">
                        {systemUser.firstName} {systemUser.lastName}
                      </p>
                      {systemUser._id === user?._id && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 tracking-wider uppercase border border-indigo-100 shadow-sm">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5 truncate font-medium flex items-center gap-1.5">
                      {systemUser.email}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mt-2.5">
                      {/* Role Badge */}
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm border ${systemUser.role === 'admin' ? 'bg-gray-900 text-white border-gray-900' :
                        systemUser.role === 'manager' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          systemUser.role === 'cashier' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>
                        <Shield className="w-3.5 h-3.5 mr-1.5 opacity-70" />
                        {systemUser.role.charAt(0).toUpperCase() + systemUser.role.slice(1)}
                      </span>

                      {/* Status Badge */}
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm border ${systemUser.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                        <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${systemUser.status === 'active' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
                        {systemUser.status === 'active' ? 'Active' : 'Inactive'}
                      </span>

                      {systemUser.loginCount > 0 && (
                        <span className="text-xs text-gray-400 font-medium ml-2 px-2 border-l border-gray-200">
                          {systemUser.loginCount} logins
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 sm:mt-0 flex flex-nowrap items-center gap-2.5 flex-shrink-0 opacity-100 lg:opacity-60 group-hover:opacity-100 transition-opacity">
                  <Button variant="outline" size="sm" onClick={() => openActivityModal(systemUser)} title="Activity Logs" className="h-10 w-10 p-0 rounded-xl hover:bg-gray-900 hover:text-white hover:border-gray-900 shadow-sm">
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openPasswordModal(systemUser)} title="Reset Password" className="h-10 w-10 p-0 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 shadow-sm border-gray-200">
                    <Lock className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleEditUser(systemUser)} title="Edit Configuration" className="h-10 w-10 p-0 rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 shadow-sm border-gray-200">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDeleteUserClick(systemUser._id, `${systemUser.firstName || ''} ${systemUser.lastName || ''}`.trim() || systemUser.email || 'this user')} disabled={systemUser._id === user?._id} title="Delete User" className="h-10 w-10 p-0 rounded-xl hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:opacity-40 shadow-sm border-gray-200">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-16 px-4">
            <div className="bg-gray-50 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-1 ring-gray-200">
              <Users className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">No Users Found</h3>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto font-medium">
              The system doesn't have any users assigned yet. Start by inviting a new team member below.
            </p>
            <Button
              onClick={() => {
                const form = document.getElementById('add-edit-user-form');
                if (form) {
                  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  setTimeout(() => form.querySelector('input[type="text"]')?.focus(), 300);
                }
              }}
              className="bg-gray-900 text-white hover:bg-gray-800 rounded-xl px-6 py-2.5 h-auto font-semibold shadow-md"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create First User
            </Button>
          </div>
        )}
      </div>
    </div>

    {/* Add/Edit User Form */}
    <div id="add-edit-user-form" className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden relative mt-8">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-900"></div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 md:p-8 border-b border-gray-100 bg-white">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-gray-100 text-gray-900 rounded-xl shadow-sm">
            {editingUser ? <UserCheck className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
              {editingUser ? 'Edit Member Profile' : 'Add New Member'}
            </h2>
            <p className="text-sm font-medium text-gray-500 mt-1">
              {editingUser ? 'Modify credentials, roles, and fine-grained permissions.' : 'Create a new user access profile and designate system permissions.'}
            </p>
          </div>
        </div>
        {editingUser && (
          <Button
            onClick={resetNewUserForm}
            variant="outline"
            className="mt-4 sm:mt-0 font-semibold px-4 shadow-sm rounded-lg hover:border-gray-900"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel Edit
          </Button>
        )}
      </div>

      <div className="p-6 md:p-8 bg-gray-50/30">
        <form key={editingUser?._id || 'new-user'} onSubmit={editingUser ? handleUpdateUserSubmit : handleCreateUser} className="space-y-8">

          {/* Row 1: Profile Information container */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-md font-bold text-gray-900 border-b border-gray-100 pb-4 mb-6 flex items-center">
              <User className="h-5 w-5 mr-2 text-gray-500" />
              Profile Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {/* First Name */}
              <div className="group">
                <label className="block text-sm font-semibold text-gray-900 mb-2 group-focus-within:text-blue-600 transition-colors">
                  First Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  name="firstName"
                  value={newUserData.firstName}
                  onChange={handleNewUserChange}
                  placeholder="e.g. John"
                  autoComplete="off"
                  required
                  className="h-11 rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-all shadow-sm"
                />
              </div>

              {/* Last Name */}
              <div className="group">
                <label className="block text-sm font-semibold text-gray-900 mb-2 group-focus-within:text-blue-600 transition-colors">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  name="lastName"
                  value={newUserData.lastName}
                  onChange={handleNewUserChange}
                  placeholder="e.g. Doe"
                  autoComplete="off"
                  required
                  className="h-11 rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-all shadow-sm"
                />
              </div>

              {/* Email */}
              <div className="group">
                <label className="block text-sm font-semibold text-gray-900 mb-2 group-focus-within:text-blue-600 transition-colors">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-gray-400" />
                  </div>
                  <Input
                    type="email"
                    name="email"
                    value={newUserData.email}
                    onChange={handleNewUserChange}
                    placeholder="john.doe@company.com"
                    autoComplete="off"
                    required
                    className="h-11 pl-10 rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* Password / Change Auth */}
              {!editingUser ? (
                <div className="group">
                  <label className="block text-sm font-semibold text-gray-900 mb-2 group-focus-within:text-blue-600 transition-colors">
                    Initial Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-gray-400" />
                    </div>
                    <Input
                      type={showNewUserPassword ? 'text' : 'password'}
                      name="password"
                      value={newUserData.password}
                      onChange={handleNewUserChange}
                      className="h-11 pl-10 pr-10 rounded-xl bg-gray-50/50 border-gray-200 focus:bg-white transition-all shadow-sm"
                      placeholder="Minimum 6 characters"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center hover:text-blue-600 transition-colors"
                    >
                      {showNewUserPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Security Credentials
                  </label>
                  <Button
                    type="button"
                    onClick={() => openPasswordModal()}
                    variant="outline"
                    className="w-full h-11 rounded-xl shadow-sm border-gray-200 font-semibold border hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 transition-all justify-start"
                  >
                    <Lock className="h-4 w-4 mr-3 text-indigo-500" />
                    Force Password Reset
                  </Button>
                  <p className="text-xs font-semibold text-gray-400 mt-2 ml-1">
                    Sends an update overlay to change this user's password immediately.
                  </p>
                </div>
              )}

            </div>

          </div>

          {/* Row 2: Access Configuration container */}
          <div className="bg-gradient-to-br from-white to-gray-50/50 p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-md font-bold text-gray-900 border-b border-gray-200 pb-4 mb-6 flex items-center">
              <Shield className="h-5 w-5 mr-2 text-indigo-500" />
              Access & Authorizations
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Role selection */}
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-semibold text-gray-900">
                  Template Role <span className="text-red-500">*</span>
                </label>
                <select
                  name="role"
                  value={newUserData.role}
                  onChange={handleNewUserChange}
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium shadow-sm transition-all appearance-none cursor-pointer"
                  required
                  disabled={editingUser && editingUser._id === user?._id}
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.75rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem'
                  }}
                >
                  <option value="admin">Administrator — Full uninhibited access</option>
                  <option value="manager">Manager — Full back-office operations</option>
                  <option value="sales_person">Sales Person — Sales &amp; purchase transaction workflow</option>
                  <option value="cashier">Cashier — Daily point of sale ops</option>
                  <option value="inventory">Inventory — Manage stock &amp; ledgers</option>
                  <option value="employee">Employee — Restricted access to Sales only</option>
                  <option value="viewer">Viewer — Read-only reporting access</option>
                </select>
                <span className="text-xs font-semibold text-gray-500 mt-1 pl-1">
                  {editingUser && editingUser._id === user?._id
                    ? 'LOCKED: You cannot change your own authorization level.'
                    : 'Selecting a role automatically ticks default required permissions.'}
                </span>

                {rolePermissionsChanged[newUserData.role] && (
                  <div className="mt-4 p-4 bg-orange-50/80 border border-orange-200 rounded-xl shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-400"></div>
                    <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row pl-2">
                      <div>
                        <h4 className="text-sm font-bold text-orange-900 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1.5" /> Overrides Detected
                        </h4>
                        <p className="text-xs font-semibold text-orange-700 mt-1">
                          You altered <strong>{newUserData.role}</strong> baseline defaults.
                        </p>
                      </div>
                      <LoadingButton
                        type="button"
                        onClick={() => handleUpdateRolePermissions(newUserData.role)}
                        isLoading={isUpdatingRolePermissions}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-bold h-9 text-xs rounded-lg shadow-sm whitespace-nowrap px-4"
                      >
                        <>
                          <Users className="h-3.5 w-3.5 mr-1.5" />
                          Push to all {newUserData.role}s
                        </>
                      </LoadingButton>
                    </div>
                  </div>
                )}
              </div>

              {/* Status toggle */}
              <div className="flex flex-col space-y-3">
                <label className="text-sm font-semibold text-gray-900">
                  Account Status
                </label>
                <div className="flex p-1 bg-gray-100 rounded-xl border border-gray-200 w-full sm:w-fit cursor-pointer shadow-inner">
                  <label className={`flex-1 sm:w-28 flex items-center justify-center py-2.5 px-3 rounded-lg text-sm font-bold cursor-pointer transition-all ${newUserData.status === 'active' ? 'bg-white text-green-700 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-900'}`} style={{
                    opacity: (editingUser && editingUser._id === user?._id) ? 0.6 : 1, pointerEvents: (editingUser && editingUser._id === user?._id) ? 'none' : 'auto'
                  }}>
                    <input
                      type="radio"
                      name="status"
                      value="active"
                      checked={newUserData.status === 'active'}
                      onChange={handleNewUserChange}
                      className="sr-only"
                      disabled={editingUser && editingUser._id === user?._id}
                    />
                    <div className={`w-2 h-2 rounded-full mr-2 ${newUserData.status === 'active' ? 'bg-green-500' : 'bg-transparent'}`}></div>
                    Active
                  </label>
                  <label className={`flex-1 sm:w-28 flex items-center justify-center py-2.5 px-3 rounded-lg text-sm font-bold cursor-pointer transition-all ${newUserData.status === 'inactive' ? 'bg-white text-red-700 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-900'}`} style={{
                    opacity: (editingUser && editingUser._id === user?._id) ? 0.6 : 1, pointerEvents: (editingUser && editingUser._id === user?._id) ? 'none' : 'auto'
                  }}>
                    <input
                      type="radio"
                      name="status"
                      value="inactive"
                      checked={newUserData.status === 'inactive'}
                      onChange={handleNewUserChange}
                      className="sr-only"
                      disabled={editingUser && editingUser._id === user?._id}
                    />
                    <div className={`w-2 h-2 rounded-full mr-2 ${newUserData.status === 'inactive' ? 'bg-red-500' : 'bg-transparent'}`}></div>
                    Suspended
                  </label>
                </div>
                {editingUser && editingUser._id === user?._id && (
                  <span className="text-xs font-semibold text-gray-500">
                    You cannot suspend your own active session.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Permissions Big Block */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col sm:flex-row items-baseline justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  Granular Permissions Matrix
                </h3>
                <p className="text-sm font-medium text-gray-500 mt-1">
                  Fine-tune exactly what functionalities this user has rights to interact with globally.
                </p>
              </div>
              <div className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 shadow-sm whitespace-nowrap">
                {(() => {
                  const matrixKeys = new Set();
                  Object.values(pagePermissionGroups).forEach((group) => {
                    group.pages.forEach((page) => {
                      ['view', 'create', 'edit', 'delete', 'confirm', 'cancel'].forEach((action) => {
                        if (page[action]) matrixKeys.add(page[action]);
                      });
                    });
                    (group.extraPermissions || []).forEach((permission) => {
                      matrixKeys.add(permission.key);
                    });
                  });
                  const allowedCount = Array.from(matrixKeys).filter(
                    (key) => !!newUserData.permissions?.[key]
                  ).length;
                  return `${allowedCount} Allowed`;
                })()}
              </div>
            </div>

            {editingUser && editingUser._id === user?._id ? (
              <div className="p-10 text-center bg-gray-50 border-t border-dashed border-gray-200">
                <div className="inline-flex bg-gray-900 text-white rounded-full p-4 mb-4 shadow-md">
                  <Lock className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">Security Lock Engaged</h4>
                <p className="text-base text-gray-600 max-w-lg mx-auto font-medium">
                  You cannot modify your own granular authorization policies. This safeguard guarantees administrators cannot accidentally revoke their own access.
                </p>
              </div>
            ) : (
              <div className="bg-gray-50/50">
                {/* Multi-tab top bar for permission groups */}
                <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
                  <div className="flex items-center gap-1 overflow-x-auto px-3 py-2 scrollbar-thin scrollbar-thumb-gray-200">
                    {Object.entries(pagePermissionGroups).map(([groupKey, group]) => {
                      const Icon = group.icon;
                      const allKeys = group.pages.flatMap((page) =>
                        ['view', 'create', 'edit', 'delete', 'confirm', 'cancel']
                          .map((action) => page[action])
                          .filter(Boolean)
                      ).concat((group.extraPermissions || []).map((permission) => permission.key));
                      const activeCount = allKeys.filter((k) => newUserData.permissions[k]).length;
                      const isActive = activePermissionGroup === groupKey;
                      return (
                        <button
                          type="button"
                          key={groupKey}
                          onClick={() => setActivePermissionGroup(groupKey)}
                          className={`flex items-center gap-2 whitespace-nowrap px-3 py-2 rounded-lg text-sm font-semibold transition-all ${isActive
                            ? 'bg-gray-900 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                        >
                          {Icon && <Icon className="h-4 w-4" />}
                          <span>{group.name}</span>
                          {activeCount > 0 && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white text-gray-900' : 'bg-blue-100 text-blue-700'
                              }`}>
                              {activeCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active group's pages with CRUD checkboxes */}
                <div className="p-4 md:p-6">
                  {(() => {
                    const group = pagePermissionGroups[activePermissionGroup];
                    if (!group) return null;
                    const ACTIONS = [
                      { key: 'view', label: 'View', color: 'text-blue-600 focus:ring-blue-500' },
                      { key: 'create', label: 'Create', color: 'text-green-600 focus:ring-green-500' },
                      { key: 'edit', label: 'Edit', color: 'text-amber-600 focus:ring-amber-500' },
                      { key: 'delete', label: 'Delete', color: 'text-red-600 focus:ring-red-500' },
                      { key: 'confirm', label: 'Confirm', color: 'text-emerald-600 focus:ring-emerald-500' },
                      { key: 'cancel', label: 'Cancel', color: 'text-rose-600 focus:ring-rose-500' }
                    ];
                    return (
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        {/* Group header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white">
                          <div className="flex items-center gap-2">
                            {group.icon && <group.icon className="h-5 w-5" />}
                            <h4 className="font-bold tracking-tight text-sm md:text-base">{group.name}</h4>
                          </div>
                          <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
                            {group.pages.length > 0
                              ? `${group.pages.length} ${group.pages.length === 1 ? 'page' : 'pages'}`
                              : `${group.extraPermissions?.length || 0} options`}
                          </span>
                        </div>

                        {/* Column headers */}
                        {group.pages.length > 0 && (
                          <div className="hidden md:grid grid-cols-[1fr_repeat(6,80px)_100px] items-center px-4 py-2 bg-gray-50 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                            <div>Page</div>
                            {ACTIONS.map((a) => (
                              <div key={a.key} className="text-center">{a.label}</div>
                            ))}
                            <div className="text-center">All</div>
                          </div>
                        )}

                        {/* Page rows */}
                        <div className="divide-y divide-gray-100">
                          {group.pages.map((page) => {
                            const definedActions = ACTIONS.filter((a) => page[a.key]);
                            const allChecked = definedActions.length > 0 && definedActions.every((a) => newUserData.permissions[page[a.key]]);
                            const someChecked = definedActions.some((a) => newUserData.permissions[page[a.key]]);

                            return (
                              <div
                                key={page.key}
                                className="grid grid-cols-1 md:grid-cols-[1fr_repeat(6,80px)_100px] gap-3 md:gap-0 items-center px-4 py-3 hover:bg-gray-50/80 transition-colors"
                              >
                                {/* Page name */}
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${allChecked ? 'bg-green-500' : someChecked ? 'bg-blue-500' : 'bg-gray-300'}`}></span>
                                  <span className="text-sm font-semibold text-gray-900 truncate">{page.name}</span>
                                </div>

                                {/* CRUD checkboxes */}
                                {ACTIONS.map((action) => {
                                  const permKey = page[action.key];
                                  if (!permKey) {
                                    return (
                                      <div key={action.key} className="md:flex md:items-center md:justify-center">
                                        <span className="text-gray-300 text-xs md:text-base">—</span>
                                      </div>
                                    );
                                  }
                                  const checked = !!newUserData.permissions[permKey];
                                  return (
                                    <label
                                      key={action.key}
                                      className="flex items-center justify-start md:justify-center gap-2 cursor-pointer select-none"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => handlePermissionChange(permKey, e.target.checked)}
                                        className={`w-4 h-4 rounded border-2 border-gray-300 ${action.color} focus:ring-offset-0 transition-all cursor-pointer`}
                                      />
                                      <span className="md:hidden text-xs font-semibold text-gray-700">{action.label}</span>
                                    </label>
                                  );
                                })}

                                {/* "All" toggle */}
                                <div className="flex items-center justify-start md:justify-center">
                                  <button
                                    type="button"
                                    onClick={() => togglePageAllPermissions(page, !allChecked)}
                                    className={`text-[11px] font-bold px-3 py-1.5 rounded-md border transition-all ${allChecked
                                      ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800'
                                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-900 hover:text-gray-900'
                                      }`}
                                  >
                                    {allChecked ? 'Revoke' : 'Grant All'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {group.extraPermissions?.length > 0 && (
                          <div className="border-t border-gray-200 bg-blue-50/40 px-4 py-4">
                            <h5 className="text-xs font-black uppercase tracking-wider text-blue-900 mb-3">
                              Additional Permissions
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {group.extraPermissions.map((permission) => (
                                <label
                                  key={permission.key}
                                  className="flex items-center gap-3 rounded-lg border border-blue-100 bg-white px-3 py-2.5 shadow-sm cursor-pointer hover:border-blue-300 transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={!!newUserData.permissions[permission.key]}
                                    onChange={(e) => handlePermissionChange(permission.key, e.target.checked)}
                                    className="w-4 h-4 rounded border-2 border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 transition-all cursor-pointer"
                                  />
                                  <span className="text-sm font-bold text-gray-900">{permission.name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Submission Footer */}
          <div className="flex justify-end items-center pt-6 px-2 gap-4">
            {editingUser && (
              <span className="text-sm font-semibold text-gray-500 mr-auto">
                Make sure to review changes before committing.
              </span>
            )}
            <LoadingButton
              type="submit"
              isLoading={editingUser ? isUpdatingUser : isCreatingUser}
              variant="default"
              className="bg-gray-900 text-white hover:bg-gray-800 hover:shadow-lg rounded-xl px-10 py-3.5 h-auto text-base font-bold transition-all"
            >
              {editingUser ? (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Commit Changes
                </>
              ) : (
                <>
                  <Check className="h-5 w-5 mr-2" />
                  Finalize & Create Member
                </>
              )}
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  </div>


{/* User Activity Modal */}
{showActivityModal && selectedUserActivity && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">User Activity Dashboard</h3>
          <p className="text-sm text-gray-600">
            {selectedUserActivity.name} ({selectedUserActivity.email})
          </p>
        </div>
        <button
          onClick={() => {
            setShowActivityModal(false);
            setSelectedUserActivity(null);
          }}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {activityLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : selectedUserActivity.activity ? (
        <div className="page-container">
          {/* Activity Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Last Login</p>
                  <p className="text-lg font-semibold text-blue-900">
                    {selectedUserActivity.activity.lastLogin
                      ? new Date(selectedUserActivity.activity.lastLogin).toLocaleString()
                      : 'Never'
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-green-800">Total Logins</p>
                  <p className="text-lg font-semibold text-green-900">
                    {selectedUserActivity.activity.loginCount || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center">
                <div className={`h-8 w-8 rounded-full mr-3 flex items-center justify-center ${selectedUserActivity.activity.isOnline ? 'bg-green-500' : 'bg-gray-400'
                  }`}>
                  <div className="h-3 w-3 bg-white rounded-full"></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-800">Status</p>
                  <p className="text-lg font-semibold text-purple-900">
                    {selectedUserActivity.activity.isOnline ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Login History */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="p-4 border-b border-gray-200">
              <h4 className="text-md font-semibold flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Recent Login History
              </h4>
            </div>
            <div className="p-4">
              {selectedUserActivity.activity.loginHistory && selectedUserActivity.activity.loginHistory.length > 0 ? (
                <div className="space-y-3">
                  {selectedUserActivity.activity.loginHistory.map((login, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(login.loginTime).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          IP: {login.ipAddress}
                        </p>
                      </div>
                      <div className="text-xs text-gray-500">
                        {login.userAgent?.split(' ')[0] || 'Unknown'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No login history available</p>
              )}
            </div>
          </div>

          {/* Permission History */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="p-4 border-b border-gray-200">
              <h4 className="text-md font-semibold flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Permission Change History
              </h4>
            </div>
            <div className="p-4">
              {selectedUserActivity.activity.permissionHistory && selectedUserActivity.activity.permissionHistory.length > 0 ? (
                <div className="space-y-3">
                  {selectedUserActivity.activity.permissionHistory.map((change, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${change.changeType === 'created' ? 'bg-green-100 text-green-800' :
                          change.changeType === 'role_changed' ? 'bg-blue-100 text-blue-800' :
                            change.changeType === 'permissions_modified' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                          }`}>
                          {change.changeType.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(change.changedAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-1">
                        Changed by: {change.changedBy ?
                          `${change.changedBy.firstName} ${change.changedBy.lastName}` :
                          'System'
                        }
                      </p>
                      {change.notes && (
                        <p className="text-xs text-gray-600">{change.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No permission changes recorded</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500">Failed to load activity data</p>
        </div>
      )}
    </div>
  </div>
)}

{/* Password Change Modal */}
{showPasswordModal && (passwordResetUser || editingUser) && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Reset Password</h3>
          <p className="text-sm text-gray-500 mt-1">
            {(passwordResetUser || editingUser)?.email && `Resetting password for: ${(passwordResetUser || editingUser).email}`}
          </p>
        </div>
        <button
          onClick={() => {
            setShowPasswordModal(false);
            setPasswordResetUser(null);
          }}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            New Password *
          </label>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pr-10"
              placeholder="Enter new password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-gray-400" />
              ) : (
                <Eye className="h-4 w-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Confirm Password *
          </label>
          <div className="relative">
            <Input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pr-10"
              placeholder="Confirm new password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4 text-gray-400" />
              ) : (
                <Eye className="h-4 w-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3 mt-6">
        <Button
          onClick={() => {
            setShowPasswordModal(false);
            setPasswordResetUser(null);
          }}
          variant="secondary"
        >
          Cancel
        </Button>
        <Button
          onClick={handlePasswordReset}
          disabled={isResettingPassword || !(passwordResetUser || editingUser)}
          variant="default"
        >
          {isResettingPassword ? 'Resetting...' : 'Reset Password'}
        </Button>
      </div>
    </div>
  </div>
)}

{/* Change My Password Modal */}
{showMyPasswordModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Change My Password</h3>
          <p className="text-sm text-gray-500 mt-1">
            {user?.email && `Changing password for: ${user.email}`}
          </p>
        </div>
        <button
          onClick={() => setShowMyPasswordModal(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Current Password *
          </label>
          <div className="relative">
            <Input
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="pr-10"
              placeholder="Enter current password"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showCurrentPassword ? (
                <EyeOff className="h-4 w-4 text-gray-400" />
              ) : (
                <Eye className="h-4 w-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            New Password *
          </label>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pr-10"
              placeholder="Enter new password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-gray-400" />
              ) : (
                <Eye className="h-4 w-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Confirm New Password *
          </label>
          <div className="relative">
            <Input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pr-10"
              placeholder="Confirm new password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4 text-gray-400" />
              ) : (
                <Eye className="h-4 w-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-xs text-blue-800">
            <strong>Note:</strong> You must enter your current password to change it to a new one.
          </p>
        </div>
      </div>

      <div className="flex justify-end space-x-3 mt-6">
        <Button
          onClick={() => setShowMyPasswordModal(false)}
          variant="secondary"
        >
          Cancel
        </Button>
        <Button
          onClick={handleChangeMyPassword}
          disabled={isChangingMyPassword}
          variant="default"
        >
          {isChangingMyPassword ? 'Changing...' : 'Change Password'}
        </Button>
      </div>
    </div>
  </div>
)}

      <DeleteConfirmationDialog
        isOpen={deleteUserConfirmation.isOpen}
        onClose={handleDeleteUserCancel}
        onConfirm={handleDeleteUserConfirm}
        itemName={deleteUserConfirmation.message?.match(/"([^"]*)"/)?.[1] || ''}
        itemType="User"
        isLoading={deleteUserConfirmation.isLoading}
      />
    </>
  );
});

export default UsersSettingsTab;
