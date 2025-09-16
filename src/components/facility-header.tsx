/**
 * Facility Header Component
 * Displays facility information in the style of the Rwanda medical bill header
 */

import React from 'react';
import { type FacilityInfo } from '../api/billing/facility-info';

interface FacilityHeaderProps {
  facilityInfo: FacilityInfo;
  className?: string;
}

export const FacilityHeader: React.FC<FacilityHeaderProps> = ({ facilityInfo, className = '' }) => {
  return (
    <div className={`facility-header ${className}`}>
      <div className="facility-header-content">
        {/* Republic of Rwanda header */}
        <div className="republic-header">
          <h1>REPUBLIQUE DU RWANDA</h1>
        </div>

        {/* Facility information section */}
        <div className="facility-info-section">
          <div className="facility-logo">
            {facilityInfo.logoUrl && <img src={facilityInfo.logoUrl} alt="Facility Logo" className="logo-image" />}
          </div>
          <div className="facility-details">
            <h2 className="facility-name">{facilityInfo.name}</h2>
            {facilityInfo.physicalAddress && <p className="facility-address">{facilityInfo.physicalAddress}</p>}
            {facilityInfo.email && <p className="facility-email">{facilityInfo.email}</p>}
          </div>
          <div className="facility-spacer"></div>
        </div>
      </div>

      <style>{`
        .facility-header {
          text-align: center;
          margin-bottom: 20px;
          padding: 20px 0;
          border-bottom: 2px solid #0056b3;
          background: linear-gradient(135deg, #f8f9fa, #e9ecef);
        }

        .facility-header-content {
          max-width: 800px;
          margin: 0 auto;
          padding: 0 20px;
        }

        .republic-header {
          margin-bottom: 15px;
        }

        .republic-header h1 {
          color: #0056b3;
          font-size: 24px;
          font-weight: bold;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .facility-info-section {
          display: grid;
          grid-template-columns: 1fr 2fr 1fr;
          align-items: center;
          gap: 20px;
          min-height: 160px;
          width: 100%;
        }

        .facility-logo {
          display: flex;
          justify-content: flex-start;
          align-items: center;
        }

        .logo-image {
          max-height: 140px;
          max-width: 180px;
          height: 140px;
          width: auto;
          object-fit: contain;
          border-radius: 4px;
        }

        .facility-details {
          text-align: center;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          grid-column: 2;
        }

        .facility-spacer {
          /* Empty column for balance */
        }

        .facility-name {
          color: #333;
          font-size: 20px;
          font-weight: 600;
          margin: 0 0 8px 0;
          text-transform: uppercase;
        }

        .facility-address,
        .facility-email {
          color: #555;
          font-size: 14px;
          margin: 4px 0;
          font-weight: 500;
        }

        .facility-email {
          color: #0056b3;
          font-weight: 600;
        }

        @media print {
          .facility-header {
            background: white !important;
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
            margin-bottom: 15px;
            padding: 10px 0;
          }

          .republic-header h1 {
            font-size: 20px;
          }

          .facility-info-section {
            gap: 15px;
            min-height: 120px;
            grid-template-columns: 1fr 2fr 1fr;
          }

          .logo-image {
            max-height: 100px;
            max-width: 130px;
            height: 100px;
          }

          .facility-name {
            font-size: 18px;
          }

          .facility-address,
          .facility-email {
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default FacilityHeader;
