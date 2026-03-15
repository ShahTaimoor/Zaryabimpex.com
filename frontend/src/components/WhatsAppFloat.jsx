import React from 'react';
import { MessageCircle } from 'lucide-react';

export const WhatsAppFloat = () => {
  const phoneNumber = '923166464649'; // WhatsApp number without + sign
  
  return (
    <a
      href={`https://wa.me/${phoneNumber}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-16 h-16 bg-[#25D366] rounded-full shadow-lg hover:bg-[#20B858] transition-all duration-300 hover:scale-110 group"
      aria-label="Contact us on WhatsApp"
    >
      <MessageCircle className="w-8 h-8 text-white" strokeWidth={2.5} />
      <span className="absolute top-0 right-0 w-3 h-3 bg-white rounded-full animate-ping" />
      <span className="absolute top-0 right-0 w-3 h-3 bg-white rounded-full" />
      
      {/* Tooltip on hover */}
      <div className="absolute right-20 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap pointer-events-none">
        Chat on WhatsApp
        <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
      </div>
    </a>
  );
};

