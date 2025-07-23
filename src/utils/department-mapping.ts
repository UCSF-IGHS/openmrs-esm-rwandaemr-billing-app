import type { Department, HopService } from '../api/types';

/**
 * Utility functions for mapping between HopServices and Departments
 * This addresses the confusion between service providers and actual departments
 */

/**
 * Maps a HopService to a corresponding Department by name matching
 * @param hopService - The HopService to map
 * @param departments - Available departments to map to
 * @returns The corresponding Department or null if no match found
 */
export function mapHopServiceToDepartment(hopService: HopService, departments: Department[]): Department | null {
  if (!hopService || !departments?.length) {
    return null;
  }

  // Try exact name match first
  const exactMatch = departments.find((dept) => dept.name.toLowerCase() === hopService.name.toLowerCase());

  if (exactMatch) {
    return exactMatch;
  }

  // Try partial name matching for common department variations
  const partialMatch = departments.find((dept) => {
    const deptName = dept.name.toLowerCase();
    const hopName = hopService.name.toLowerCase();

    return deptName.includes(hopName) || hopName.includes(deptName);
  });

  return partialMatch || null;
}

/**
 * Creates a mapping lookup between HopService IDs and Department IDs
 * @param hopServices - List of HopServices
 * @param departments - List of Departments
 * @returns Map of HopService ID to Department ID
 */
export function createHopServiceToDepartmentMapping(
  hopServices: HopService[],
  departments: Department[],
): Map<number, number> {
  const mapping = new Map<number, number>();

  hopServices.forEach((hopService) => {
    const correspondingDept = mapHopServiceToDepartment(hopService, departments);
    if (correspondingDept) {
      mapping.set(hopService.serviceId, correspondingDept.departmentId);
    }
  });

  return mapping;
}

/**
 * Gets the correct department ID for a given HopService ID
 * @param hopServiceId - The HopService ID
 * @param mapping - The HopService to Department mapping
 * @param fallbackDepartmentId - Fallback department ID if no mapping found
 * @returns The mapped department ID or fallback
 */
export function getDepartmentIdForHopService(
  hopServiceId: number,
  mapping: Map<number, number>,
  fallbackDepartmentId?: number,
): number {
  return mapping.get(hopServiceId) || fallbackDepartmentId || hopServiceId;
}

/**
 * Common department name mappings for the Rwanda EMR system
 * This can be extended based on your specific department setup
 */
export const COMMON_DEPARTMENT_MAPPINGS: Record<string, string[]> = {
  opd: ['outpatient', 'out-patient', 'opd', 'consultation'],
  emergency: ['emergency', 'er', 'casualty', 'urgence'],
  laboratory: ['lab', 'laboratory', 'laboratoire'],
  pharmacy: ['pharmacy', 'pharma', 'pharmacie'],
  radiology: ['radiology', 'imaging', 'radiologie'],
  maternity: ['maternity', 'obstetrics', 'maternite'],
  pediatrics: ['pediatrics', 'pediatrie', 'enfants'],
  surgery: ['surgery', 'surgical', 'chirurgie'],
  'internal medicine': ['internal', 'medicine', 'medecine interne'],
  dental: ['dental', 'dentistry', 'dentaire'],
};

/**
 * Enhanced mapping function that uses common department mappings
 * @param hopService - The HopService to map
 * @param departments - Available departments to map to
 * @returns The corresponding Department or null if no match found
 */
export function mapHopServiceToDepartmentEnhanced(
  hopService: HopService,
  departments: Department[],
): Department | null {
  if (!hopService || !departments?.length) {
    return null;
  }

  const hopName = hopService.name.toLowerCase();

  // First try the basic mapping
  const basicMatch = mapHopServiceToDepartment(hopService, departments);
  if (basicMatch) {
    return basicMatch;
  }

  // Try enhanced mapping using common department mappings
  for (const [canonical, variants] of Object.entries(COMMON_DEPARTMENT_MAPPINGS)) {
    if (variants.some((variant) => hopName.includes(variant))) {
      const match = departments.find((dept) => variants.some((variant) => dept.name.toLowerCase().includes(variant)));
      if (match) {
        return match;
      }
    }
  }

  return null;
}
