import { SAME_AS, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import { FAQ } from '@/components/landing/faq';

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  // `<` escapado para que o conteúdo nunca feche a tag <script> por engano.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

export function HomeJsonLd() {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORGANIZATION_ID,
        name: SITE_NAME,
        url: SITE_URL,
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/brand/ofix-logo-dark.svg` },
        description: SITE_DESCRIPTION,
        parentOrganization: { '@type': 'Organization', name: 'Ax Cloud' },
        ...(SAME_AS.length ? { sameAs: SAME_AS } : {}),
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_URL}/#software`,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'Gestão de oficina mecânica',
        operatingSystem: 'Web',
        inLanguage: 'pt-BR',
        publisher: { '@id': ORGANIZATION_ID },
        image: `${SITE_URL}/opengraph-image`,
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}/#faq`,
        inLanguage: 'pt-BR',
        mainEntity: FAQ.map(([name, text]) => ({
          '@type': 'Question',
          name,
          acceptedAnswer: { '@type': 'Answer', text },
        })),
      },
    ],
  };
  return <JsonLd data={graph} />;
}
