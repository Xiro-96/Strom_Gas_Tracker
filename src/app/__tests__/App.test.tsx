import { render, screen } from '@testing-library/react';
import { App } from '@/app/App';

describe('App', () => {
  it('zeigt den App-Namen', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Strom & Gas Tracker' })).toBeInTheDocument();
  });
});
