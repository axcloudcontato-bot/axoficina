import { ContactPreferences } from '@/features/customer-care/ContactPreferences';
export const metadata = { title: 'Suas preferências de contato · Ofix', robots: { index: false, follow: false } };
export default async function ContactPreferencesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ContactPreferences token={token} />;
}
