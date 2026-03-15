import React, { useState, useEffect, useRef } from 'react';
import { Building, Phone, MapPin, Mail, FileText, Image, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useFetchCompanyQuery,
  useUpdateCompanyMutation,
  useUploadCompanyLogoMutation,
} from '../store/services/companyApi';
import {
  useGetCompanySettingsQuery,
  useUpdateCompanySettingsMutation,
} from '../store/services/settingsApi';
import { LoadingSpinner, LoadingButton } from './LoadingSpinner';
import { handleApiError } from '../utils/errorHandler';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function CompanySettingsForm() {
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    companyName: '',
    phone: '',
    address: '',
    email: '',
    taxRegistrationNumber: '',
  });
  const [logoPreview, setLogoPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const { data: companyResponse, isLoading: loadingCompany } = useFetchCompanyQuery();
  const { data: settingsResponse } = useGetCompanySettingsQuery();
  const [updateCompany, { isLoading: updatingCompany }] = useUpdateCompanyMutation();
  const [uploadLogo, { isLoading: uploadingLogo }] = useUploadCompanyLogoMutation();
  const [updateSettings, { isLoading: updatingSettings }] = useUpdateCompanySettingsMutation();

  const company = companyResponse?.data || {};
  const settings = settingsResponse?.data?.data ?? settingsResponse?.data ?? {};
  const savedLogo = company.logo || '';

  useEffect(() => {
    setForm((f) => ({
      ...f,
      companyName: company.companyName ?? settings.companyName ?? '',
      phone: company.phone ?? settings.contactNumber ?? '',
      address: company.address ?? settings.address ?? '',
      email: settings.email ?? '',
      taxRegistrationNumber: settings.taxId ?? '',
    }));
  }, [company.companyName, company.phone, company.address, settings.companyName, settings.contactNumber, settings.address, settings.email, settings.taxId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setLogoPreview(null);
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Please select a valid image (JPEG, PNG, GIF, WebP).');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Image must be under 5MB.');
      return;
    }
    setSelectedFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSaveAll = async (e) => {
    e.preventDefault();
    try {
      await updateCompany({
        companyName: form.companyName,
        phone: form.phone,
        address: form.address,
      }).unwrap();
      await updateSettings({
        companyName: form.companyName,
        contactNumber: form.phone,
        address: form.address,
        email: form.email,
        taxId: form.taxRegistrationNumber,
      }).unwrap();
      if (selectedFile) {
        const formData = new FormData();
        formData.append('logo', selectedFile);
        await uploadLogo(formData).unwrap();
        setSelectedFile(null);
        if (logoPreview) URL.revokeObjectURL(logoPreview);
        setLogoPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      toast.success('Company information saved.');
    } catch (err) {
      handleApiError(err, 'Failed to save company information');
    }
  };

  // Alias for backwards compatibility (e.g. HMR / stale references)
  const handleSaveProfile = handleSaveAll;

  const handleUploadLogo = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select an image first.');
      return;
    }
    const formData = new FormData();
    formData.append('logo', selectedFile);
    try {
      const res = await uploadLogo(formData).unwrap();
      if (res?.success) {
        toast.success('Logo uploaded.');
        setSelectedFile(null);
        if (logoPreview) URL.revokeObjectURL(logoPreview);
        setLogoPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (err) {
      handleApiError(err, 'Failed to upload logo');
    }
  };

  const displayPreview = logoPreview || savedLogo;
  const isSaving = updatingCompany || updatingSettings || uploadingLogo;

  if (loadingCompany) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">Company name</label>
          <div className="relative">
            <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              name="companyName"
              value={form.companyName}
              onChange={handleChange}
              placeholder="Enter company name"
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">Phone</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="Enter phone number"
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Enter email"
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">Tax registration number</label>
          <div className="relative">
            <FileText className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              name="taxRegistrationNumber"
              value={form.taxRegistrationNumber}
              onChange={handleChange}
              placeholder="Enter tax registration number"
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">Address</label>
        <div className="relative">
          <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <textarea
            name="address"
            value={form.address}
            onChange={handleChange}
            rows={3}
            placeholder="Enter address"
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">Company logo</label>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex-shrink-0">
            {displayPreview ? (
              <div className="h-28 w-28 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
                <img
                  src={displayPreview}
                  alt="Company logo preview"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400">
                <Image className="h-10 w-10" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              onChange={handleLogoSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
            />
            <p className="text-xs text-gray-500">JPEG, PNG, GIF or WebP. Max 5MB.</p>
            {selectedFile && (
              <p className="text-xs text-gray-600">
                New logo will be saved when you click &quot;Save company information&quot; below.
              </p>
            )}
          </div>
        </div>
        {savedLogo && !selectedFile && (
          <p className="text-xs text-gray-500">Logo shown above is the saved logo. Choose a new file to replace it.</p>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
        <LoadingButton
          type="button"
          onClick={handleSaveAll}
          loading={isSaving}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          Save company information
        </LoadingButton>
      </div>
    </form>
  );
}
