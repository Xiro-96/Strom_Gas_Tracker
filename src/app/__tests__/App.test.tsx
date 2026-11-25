import { render, screen } from '@testing-library/react';
import { App } from '@/app/App';

describe('App', () => {
  it('startet mit der Übersicht im Hash-Router', async () => {
    window.history.replaceState(null, '', '/Strom_Gas_Tracker/');
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Übersicht' })).toBeInTheDocument();
  });
});
