import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGetInvestorsQuery } from '../store/services/investorsApi';
import { toast } from 'sonner';

export const ProductInvestorsModal = ({ product, isOpen, onClose, onSave }) => {
  const [linkedInvestors, setLinkedInvestors] = useState([]);
  const [selectedInvestor, setSelectedInvestor] = useState('');
  const [sharePercentage, setSharePercentage] = useState(30);
  const { data: investorsData, isLoading: investorsLoading } = useGetInvestorsQuery(
    {},
    { 
      skip: !isOpen,
      refetchOnMountOrArgChange: true,
    }
  );
  const investors = useMemo(() => {
    // API returns { success, data: [...] } — same shape as Investors page (data may be the array directly).
    const list =
      investorsData?.data?.investors ||
      investorsData?.data ||
      investorsData?.investors ||
      investorsData ||
      [];
    return Array.isArray(list) ? list : [];
  }, [investorsData]);

  /** Stable string id for selects and comparisons (avoids ObjectId / type mismatches). */
  const investorRowId = (inv) => {
    const raw = inv?._id ?? inv?.id;
    if (raw == null) return '';
    if (typeof raw === 'object') {
      const inner = raw._id ?? raw.id;
      return inner != null ? String(inner).trim() : String(raw).trim();
    }
    return String(raw).trim();
  };

  const idsMatch = (a, b) => {
    const sa = a == null ? '' : String(a).trim().toLowerCase();
    const sb = b == null ? '' : String(b).trim().toLowerCase();
    return sa !== '' && sa === sb;
  };

  const productIdKey = product?._id ?? product?.id;
  const lastSyncedProductIdRef = useRef(null);

  // Seed from the server when the modal opens or the product changes — not on every parent
  // `product` reference change (background refetch was resetting linkedInvestors and clearing Adds).
  useEffect(() => {
    if (!isOpen) {
      lastSyncedProductIdRef.current = null;
      return;
    }
    if (!productIdKey || !product) return;
    if (lastSyncedProductIdRef.current === productIdKey) return;
    lastSyncedProductIdRef.current = productIdKey;

    const existingInvestors = (product.investors || []).map((inv) => {
      const raw = inv.investor;
      const id =
        typeof raw === 'object' && raw != null
          ? raw._id || raw.id
          : raw;
      const name =
        typeof raw === 'object' && raw != null
          ? raw.name || raw.email || 'Unknown'
          : 'Unknown';
      return {
        investorId: id != null ? String(id).trim() : '',
        investorName: name,
        sharePercentage: inv.sharePercentage ?? inv.share_percentage ?? 30
      };
    });
    setLinkedInvestors(existingInvestors);
  }, [isOpen, productIdKey, product]);

  const handleAddInvestor = () => {
    if (!selectedInvestor) {
      toast.error('Please select an investor');
      return;
    }

    const investor = investors.find((inv) => idsMatch(investorRowId(inv), selectedInvestor));
    if (!investor) {
      toast.error('Could not match the selected investor. Refresh the page and try again.');
      return;
    }

    const chosenId = investorRowId(investor);
    if (linkedInvestors.some((inv) => idsMatch(inv.investorId, chosenId))) {
      toast.error('This investor is already linked to this product');
      return;
    }

    setLinkedInvestors([
      ...linkedInvestors,
      {
        investorId: chosenId,
        investorName: investor.name || investor.email || 'Investor',
        sharePercentage: sharePercentage
      }
    ]);

    setSelectedInvestor('');
    setSharePercentage(30);
  };

  const handleRemoveInvestor = (investorId) => {
    setLinkedInvestors(linkedInvestors.filter(inv => inv.investorId !== investorId));
  };

  const handleUpdatePercentage = (investorId, newPercentage) => {
    setLinkedInvestors(linkedInvestors.map(inv =>
      inv.investorId === investorId
        ? { ...inv, sharePercentage: parseFloat(newPercentage) || 0 }
        : inv
    ));
  };

  const handleSave = () => {
    if (linkedInvestors.length === 0) {
      toast.error('Please add at least one investor');
      return;
    }

    const investorsToSave = linkedInvestors.map((inv) => {
      const sp = parseFloat(inv.sharePercentage);
      return {
        investor: inv.investorId,
        sharePercentage: Number.isFinite(sp) ? sp : 30
      };
    });

    const productId = product?._id ?? product?.id;
    if (!productId) {
      toast.error('Missing product id');
      return;
    }
    onSave(productId, investorsToSave);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-[100dvh] pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />
        
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Manage Investors - {product?.name}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Add Investor</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <select
                    value={selectedInvestor}
                    onChange={(e) => setSelectedInvestor(e.target.value)}
                    disabled={investorsLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {investorsLoading ? 'Loading investors...' : 'Select Investor'}
                    </option>
                    {!investorsLoading && investors.length === 0 ? (
                      <option value="" disabled>No investors available. Create one from the Investors page.</option>
                    ) : (
                      investors.map((inv) => {
                        const id = investorRowId(inv);
                        if (!id) return null;
                        return (
                          <option key={id} value={id}>
                            {inv.name || inv.email || id}
                          </option>
                        );
                      }).filter(Boolean)
                    )}
                  </select>
                </div>
                <div className="col-span-1 flex gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={sharePercentage}
                    onChange={(e) => setSharePercentage(parseFloat(e.target.value) || 0)}
                    placeholder="%"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <Button
                    type="button"
                    onClick={handleAddInvestor}
                    variant="default"
                    className="px-4"
                  >
                    Add
                  </Button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Set the profit share percentage for this product. This determines what % of profit goes to investors (split among all linked investors), with the remainder going to the company.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Linked Investors ({linkedInvestors.length})
              </h4>
              {linkedInvestors.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No investors linked. Add investors above.
                </p>
              ) : (
                <div className="space-y-2">
                  {linkedInvestors.map((linkedInv) => (
                    <div
                      key={linkedInv.investorId}
                      className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {linkedInv.investorName}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={linkedInv.sharePercentage}
                            onChange={(e) => handleUpdatePercentage(linkedInv.investorId, e.target.value)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <span className="text-sm text-gray-600">%</span>
                        </div>
                        <button
                          onClick={() => handleRemoveInvestor(linkedInv.investorId)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <Button
              type="button"
              onClick={handleSave}
              variant="default"
              size="default"
              className="w-full sm:w-auto sm:ml-3"
            >
              Save Investors
            </Button>
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
              size="default"
              className="w-full sm:w-auto mt-3 sm:mt-0"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

