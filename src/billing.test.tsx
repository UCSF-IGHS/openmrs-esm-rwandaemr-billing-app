import React from 'react';
import { render, screen } from '@testing-library/react';
import { useConfig } from '@openmrs/esm-framework';
import { Config } from './config-schema';
import Billing from './billing.component';

jest.mock('./images/payments-desk-icon.svg', () => 'svg-mock');

jest.mock('./header/BillingHeader', () => ({
  __esModule: true,
  default: () => <div data-testid="billing-header">Billing Header</div>,
}));

const mockUseConfig = jest.mocked(useConfig<Config>);

it('renders the billing landing page', () => {
  const config: Config = { casualGreeting: false, whoToGreet: ['World'] };
  mockUseConfig.mockReturnValue(config);

  render(<Billing />);
  expect(screen.getByText('Billing')).toBeInTheDocument();
  expect(document.getElementById('billing-component-instance')).toBeInTheDocument();
});
