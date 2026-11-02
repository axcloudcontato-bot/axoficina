'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    google?: { accounts: { id: {
      initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
      renderButton(element: HTMLElement, options: { theme: string; size: string; text: string; width: number }): void;
    } } };
  }
}

export function GoogleButton({ onCredential, text = 'continue_with' }: { onCredential: (credential: string) => void; text?: 'continue_with' | 'signup_with' | 'signin_with' }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!clientId || !loaded || !container.current || !window.google) return;
    container.current.replaceChildren();
    window.google.accounts.id.initialize({ client_id: clientId, callback: (response) => onCredential(response.credential) });
    window.google.accounts.id.renderButton(container.current, { theme: 'outline', size: 'large', text, width: 320 });
  }, [clientId, loaded, onCredential, text]);

  if (!clientId) return null;
  return <div className="flex justify-center"><Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setLoaded(true)} /><div ref={container} /></div>;
}
