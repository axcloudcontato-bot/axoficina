import { ContentPageView } from '@/components/landing/content-page';
import { getContentPage } from '@/components/landing/content-pages';
import { publicPageMetadata } from '@/lib/seo';

const page = getContentPage('ordem-de-servico-para-oficina')!;

export const metadata = publicPageMetadata({ title: page.title, description: page.description, path: '/ordem-de-servico-para-oficina' });

export default function Page() {
  return <ContentPageView slug="ordem-de-servico-para-oficina" />;
}
