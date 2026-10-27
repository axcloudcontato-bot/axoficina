import { ContentPageView } from '@/components/landing/content-page';
import { getContentPage } from '@/components/landing/content-pages';
import { publicPageMetadata } from '@/lib/seo';

const page = getContentPage('software-para-oficina-mecanica')!;

export const metadata = publicPageMetadata({ title: page.title, description: page.description, path: '/software-para-oficina-mecanica' });

export default function Page() {
  return <ContentPageView slug="software-para-oficina-mecanica" />;
}
