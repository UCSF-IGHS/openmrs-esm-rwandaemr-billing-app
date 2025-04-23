import React from 'react';
import { render, screen } from '@testing-library/react';

// A simple component that doesn't have any external dependencies
const SimpleComponent = () => {
  return (
    <div data-testid="simple-component">
      <h1>Hello, Jest!</h1>
    </div>
  );
};

describe('Simple Component', () => {
  it('renders without crashing', () => {
    render(<SimpleComponent />);
    
    // Basic assertion
    expect(screen.getByTestId('simple-component')).toBeInTheDocument();
    expect(screen.getByText('Hello, Jest!')).toBeInTheDocument();
  });
  
  it('performs basic math correctly', () => {
    expect(1 + 1).toBe(2);
    expect(2 * 3).toBe(6);
  });
});