import { COMPANY, COMPANY_POSTAL_ADDRESS, SAME_AS, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import { FAQ } from '@/components/landing/faq';
import { STEPS } from '@/components/landing/steps';
import { SPEC } from '@/components/landing/facts';
import type { ContentPage } from '@/components/landing/content-pages';

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
        legalName: COMPANY.name,
        taxID: COMPANY.document,
        email: COMPANY.email,
        ...(COMPANY_POSTAL_ADDRESS
          ? {
              address: {
                '@type': 'PostalAddress',
                streetAddress: COMPANY_POSTAL_ADDRESS.street,
                addressLocality: COMPANY_POSTAL_ADDRESS.city,
                addressRegion: COMPANY_POSTAL_ADDRESS.region,
                postalCode: COMPANY_POSTAL_ADDRESS.postalCode,
                addressCountry: 'BR',
              },
            }
          : {}),
        contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: COMPANY.email, availableLanguage: 'pt-BR' },
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
        featureList: SPEC.map(([name, value]) => `${name}: ${value}`),
      },
      {
        '@type': 'HowTo',
        '@id': `${SITE_URL}/#como-funciona`,
        name: 'Como atender um carro na oficina com o Ofix',
        description: 'Do cadastro do cliente à entrega e cobrança, em quatro etapas.',
        inLanguage: 'pt-BR',
        step: STEPS.map(([n, name, text]) => ({
          '@type': 'HowToStep',
          position: Number(n),
          name,
          text,
          url: `${SITE_URL}/#como-funciona`,
        })),
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

export function ContentJsonLd({ page }: { page: ContentPage }) {
  const url = `${SITE_URL}/${page.slug}`;
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: page.title,
        description: page.description,
        inLanguage: 'pt-BR',
        isPartOf: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: page.title, item: url },
        ],
      },
      {
        '@type': 'FAQPage',
        inLanguage: 'pt-BR',
        mainEntity: page.faq.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })),
      },
    ],
  };
  return <JsonLd data={graph} />;
}
