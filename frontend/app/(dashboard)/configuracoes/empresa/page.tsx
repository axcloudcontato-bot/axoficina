import { CompanySettingsForm } from '@/features/settings/components/CompanySettingsForm';
import { PhotoPolicySettings } from '@/features/settings/components/PhotoPolicySettings';
import { AgendaHoursSettings } from '@/features/settings/components/AgendaHoursSettings';

export default function CompanySettingsPage() {
  return <div className="space-y-6"><CompanySettingsForm /><AgendaHoursSettings /><PhotoPolicySettings /></div>;
}
