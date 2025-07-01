import test from '@playwright/test';
import { HomePage } from '../pages';
import { expect } from '@playwright/test';

test('Billing dashboard links are visible', async ({ page }) => {
  const homePage = new HomePage(page);
  await homePage.goto();
  
  // Test for actual billing-related links that exist
  await expect(page.locator('text=Billing').first()).toBeVisible();

});
