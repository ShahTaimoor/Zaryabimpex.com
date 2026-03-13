import React from 'react';
import { HelpCircle, Mail, Phone, Clock, CheckCircle, MessageCircle } from 'lucide-react';

export const Help = () => {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="bg-white rounded-lg shadow-md p-8">
        {/* Header */}
        <div className="flex items-center mb-8">
          <HelpCircle className="h-12 w-12 text-primary-600 mr-4" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Help & Support</h1>
            <p className="text-gray-600 mt-1">Get assistance with your POS System</p>
          </div>
        </div>

        {/* Support Contact Section */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 mb-8 border-2 border-blue-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Contact Support</h2>
          <div className="space-y-4">
            <div className="flex items-start">
              <Mail className="h-6 w-6 text-blue-600 mr-3 mt-1 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Email Support</p>
                <a 
                  href="mailto:support@wisorsconsulting.com" 
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  support@wisorsconsulting.com
                </a>
                <p className="text-sm text-gray-600 mt-1">
                  For technical issues, feature requests, or general inquiries
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <Phone className="h-6 w-6 text-green-600 mr-3 mt-1 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Phone Support</p>
                <a 
                  href="tel:+923166464649" 
                  className="text-green-600 hover:text-green-800 underline"
                >
                  +92 316 64 64 64 9
                </a>
                <p className="text-sm text-gray-600 mt-1">
                  Available Monday - Saturday, 9:00 AM - 6:00 PM (PST)
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <MessageCircle className="h-6 w-6 text-[#25D366] mr-3 mt-1 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">WhatsApp Support</p>
                <a 
                  href="https://wa.me/923166464649" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#25D366] hover:text-[#20B858] underline"
                >
                  +92 316 64 64 64 9
                </a>
                <p className="text-sm text-gray-600 mt-1">
                  Chat with us on WhatsApp for instant support
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <Clock className="h-6 w-6 text-purple-600 mr-3 mt-1 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Response Time</p>
                <p className="text-sm text-gray-600">
                  We typically respond within 2-4 business hours
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Common Issues Section */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Common Issues & Solutions</h2>
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4 py-2">
              <h3 className="font-semibold text-gray-900">Can't log in to the system</h3>
              <p className="text-gray-600 text-sm mt-1">
                Make sure you're using the correct credentials. If you forgot your password, contact support to reset it.
              </p>
            </div>

            <div className="border-l-4 border-green-500 pl-4 py-2">
              <h3 className="font-semibold text-gray-900">Backend connection errors</h3>
              <p className="text-gray-600 text-sm mt-1">
                Ensure the backend server is running on port 5000. If the problem persists, check your network connection and contact support.
              </p>
            </div>

            <div className="border-l-4 border-yellow-500 pl-4 py-2">
              <h3 className="font-semibold text-gray-900">Inventory not updating</h3>
              <p className="text-gray-600 text-sm mt-1">
                Refresh the page and check if your purchase/sale transaction was completed successfully. If issues persist, contact support with details.
              </p>
            </div>

            <div className="border-l-4 border-purple-500 pl-4 py-2">
              <h3 className="font-semibold text-gray-900">Slow performance</h3>
              <p className="text-gray-600 text-sm mt-1">
                Try clearing your browser cache or closing unnecessary tabs. If performance remains slow, contact support with system information.
              </p>
            </div>
          </div>
        </div>

        {/* What to Include Section */}
        <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <CheckCircle className="h-6 w-6 text-yellow-600 mr-2" />
            When Contacting Support
          </h2>
          <p className="text-gray-700 mb-3">
            To help us resolve your issue quickly, please include:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>A clear description of the problem</li>
            <li>Steps to reproduce the issue</li>
            <li>Screenshots or error messages (if any)</li>
            <li>Your browser and operating system information</li>
            <li>Any recent changes or updates made</li>
          </ul>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-center text-sm text-gray-500">
            Powered by Wisors Accounts - Professional POS Solutions
          </p>
        </div>
      </div>
    </div>
  );
};

