import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleButton } from '../GoogleButton';

vi.mock('next/script', () => ({ default: ({ onReady }: { onReady: () => void }) => { useEffect(() => onReady(), [onReady]); return null; } }));

describe('GoogleButton', () => {
  afterEach(() => { vi.unstubAllEnvs(); delete window.google; });

  it('renders again after navigation when the Google script is already loaded', () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', 'ofix-client');
    const renderButton = vi.fn((element: HTMLElement) => { element.textContent = 'Continuar com Google'; });
    window.google = { accounts: { id: { initialize: vi.fn(), renderButton } } };
    const first = render(<GoogleButton onCredential={vi.fn()} />);
    expect(screen.getByText('Continuar com Google')).toBeInTheDocument();
    first.unmount();
    render(<GoogleButton onCredential={vi.fn()} />);
    expect(screen.getByText('Continuar com Google')).toBeInTheDocument();
    expect(renderButton).toHaveBeenCalledTimes(2);
  });
});
