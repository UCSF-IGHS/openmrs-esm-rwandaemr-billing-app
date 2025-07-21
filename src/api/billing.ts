/**
 * Legacy billing API module
 * This file now re-exports from the new modular billing structure
 * Maintained for backward compatibility
 */

// Re-export everything from the modular billing structure
export * from './billing/index';

// Legacy constants for backward compatibility
export const BASE_API_URL = '/ws/rest/v1/mohbilling';
export const BASE_MAMBA_API = '/ws/rest/v1/mamba/report';
