'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { GTM_ID } from '@/lib/site';
import { hasAnalyticsConsent, PRIVACY_CHOICE_EVENT } from '../cookie-preferences';

/** Apaga os cookies do Google Analytics no domínio atual e nos domínios-pai. */
function clearAnalyticsCookies() {
  const names = document.cookie.split(';').map((c) => c.split('=')[0]!.trim()).filter((n) => n === '_ga' || n.startsWith('_ga_') || n === '_gid' || n.startsWith('_gat'));
  const parts = location.hostname.split('.');
  const domains = [''];
  for (let i = 0; i < parts.length - 1; i++) domains.push(`; domain=.${parts.slice(i).join('.')}`);
  for (const name of names) for (const domain of domains) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
}

/**
 * Google Tag Manager carregado só depois do consentimento para estatísticas
 * (LGPD e a própria Política de cookies). Sem escolha positiva, nenhum script
 * do Google é baixado. Ao revogar, os cookies do Analytics são apagados e a
 * página recarrega para descarregar o script.
 */
export function GoogleTagManager() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    setAllowed(hasAnalyticsConsent());
    function sync() {
      const next = hasAnalyticsConsent();
      setAllowed((was) => {
        if (was && !next) { clearAnalyticsCookies(); location.reload(); }
        return next;
      });
    }
    window.addEventListener(PRIVACY_CHOICE_EVENT, sync);
    return () => window.removeEventListener(PRIVACY_CHOICE_EVENT, sync);
  }, []);
  if (!GTM_ID || !allowed) return null;
  return (
    <Script id="gtm" strategy="afterInteractive">
      {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(GTM_ID)});`}
    </Script>
  );
}
