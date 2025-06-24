import React from 'react';

const BillingIllustration: React.FC = () => {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>Billing module illustration</title>
      <defs>
        <linearGradient id="billingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f62fe" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#0f62fe" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Background circle */}
      <circle cx="32" cy="32" r="30" fill="url(#billingGradient)" stroke="#0f62fe" strokeWidth="1" opacity="0.3" />

      {/* Main money/bill icon */}
      <rect x="16" y="24" width="32" height="20" rx="2" fill="#0f62fe" opacity="0.8" />
      <rect x="18" y="26" width="28" height="16" rx="1" fill="white" />

      {/* Dollar sign in center */}
      <path
        d="M30 30 L30 28 L32 28 L32 30 L34 30 L34 32 L32 32 L32 34 L34 34 L34 36 L32 36 L32 38 L30 38 L30 36 L28 36 L28 34 L30 34 L30 32 L28 32 L28 30 L30 30 Z"
        fill="#0f62fe"
        opacity="0.8"
      />

      {/* Decorative coins */}
      <circle cx="20" cy="18" r="4" fill="#0f62fe" opacity="0.3" />
      <circle cx="44" cy="18" r="3" fill="#0f62fe" opacity="0.25" />
      <circle cx="18" cy="48" r="3" fill="#0f62fe" opacity="0.2" />
      <circle cx="46" cy="48" r="4" fill="#0f62fe" opacity="0.3" />

      {/* Currency symbols on coins */}
      <text x="20" y="22" fontSize="6" fill="#0f62fe" opacity="0.6" textAnchor="middle" fontWeight="bold">
        $
      </text>
      <text x="44" y="21" fontSize="5" fill="#0f62fe" opacity="0.6" textAnchor="middle" fontWeight="bold">
        €
      </text>
      <text x="18" y="51" fontSize="5" fill="#0f62fe" opacity="0.6" textAnchor="middle" fontWeight="bold">
        ¥
      </text>
      <text x="46" y="52" fontSize="6" fill="#0f62fe" opacity="0.6" textAnchor="middle" fontWeight="bold">
        ₹
      </text>

      {/* Receipt/bill lines */}
      <line x1="20" y1="30" x2="26" y2="30" stroke="#0f62fe" strokeWidth="1" opacity="0.4" />
      <line x1="20" y1="32" x2="24" y2="32" stroke="#0f62fe" strokeWidth="1" opacity="0.4" />
      <line x1="36" y1="30" x2="44" y2="30" stroke="#0f62fe" strokeWidth="1" opacity="0.4" />
      <line x1="38" y1="32" x2="44" y2="32" stroke="#0f62fe" strokeWidth="1" opacity="0.4" />
      <line x1="20" y1="36" x2="28" y2="36" stroke="#0f62fe" strokeWidth="1" opacity="0.4" />
      <line x1="36" y1="36" x2="42" y2="36" stroke="#0f62fe" strokeWidth="1" opacity="0.4" />
    </svg>
  );
};

export default BillingIllustration;
