import React from 'react';
import { Download, Check, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import toast from 'react-hot-toast';

export const PWAInstallButton = ({ className = '' }) => {
  const { isInstallable, isInstalled, handleInstallClick } = usePWAInstall();

  // Don't show if already installed or not installable
  if (isInstalled || !isInstallable) {
    return null;
  }

  const handleClick = async () => {
    try {
      await handleInstallClick();
      toast.success('App installed successfully!');
    } catch (error) {
      console.error('Install error:', error);
      toast.error('Failed to install app. Please try again.');
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors ${className}`}
      aria-label="Install POS System App"
    >
      <Download className="h-5 w-5" />
      <span>Install App</span>
    </button>
  );
};

export default PWAInstallButton;

