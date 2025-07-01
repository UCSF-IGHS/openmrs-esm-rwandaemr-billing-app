import test from '@playwright/test';
import { HomePage } from '../pages';
import { expect } from '@playwright/test';

// This test verifies that billing dashboard links are visible on the homepage

test('Billing dashboard links are visible', async ({ page }) => {
  const homePage = new HomePage(page);
  await homePage.goto();

  // Test for actual billing-related links that exist in the application
  await expect(page.getByRole('link', { name: 'Billing' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Billing Reports' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Insurance Policy' })).toBeVisible();
});
