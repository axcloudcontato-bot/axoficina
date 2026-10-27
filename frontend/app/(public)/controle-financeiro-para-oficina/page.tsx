import { ContentPageView } from '@/components/landing/content-page';
import { getContentPage } from '@/components/landing/content-pages';
import { publicPageMetadata } from '@/lib/seo';

const page = getContentPage('controle-financeiro-para-oficina')!;

export const metadata = publicPageMetadata({ title: page.title, description: page.description, path: '/controle-financeiro-para-oficina' });

export default function Page() {
  return <ContentPageView slug="controle-financeiro-para-oficina" />;
}
