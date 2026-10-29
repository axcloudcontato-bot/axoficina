import { CompanySettingsForm } from '@/features/settings/components/CompanySettingsForm';
import { PhotoPolicySettings } from '@/features/settings/components/PhotoPolicySettings';

export default function CompanySettingsPage() {
  return <div className="space-y-6"><CompanySettingsForm /><PhotoPolicySettings /></div>;
}
