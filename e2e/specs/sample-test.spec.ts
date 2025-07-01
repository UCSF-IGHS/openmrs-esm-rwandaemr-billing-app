import { test, expect } from '@playwright/test';
import { HomePage } from '../pages';

test('Sample test - Basic page functionality', async ({ page }) => {
  const homePage = new HomePage(page);
  await homePage.goto();
  
  // Very basic checks that should always pass
  await expect(page.locator('html')).toBeVisible();
  await expect(page.locator('body')).toBeVisible();
  
  // Check that the page has loaded some content
  await page.waitForLoadState('domcontentloaded');
  
  // Verify page is not completely empty
  const pageText = await page.textContent('body');
  expect(pageText.length).toBeGreaterThan(0);
  
});
