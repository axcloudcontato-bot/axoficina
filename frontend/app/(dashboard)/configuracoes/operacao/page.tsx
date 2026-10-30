import { AgendaHoursSettings } from '@/features/settings/components/AgendaHoursSettings';
import { PhotoPolicySettings } from '@/features/settings/components/PhotoPolicySettings';
import { OrderDefaultsSettings } from '@/features/settings/components/OrderDefaultsSettings';

export default function OperationSettingsPage() {
  return <div className="space-y-6"><AgendaHoursSettings /><OrderDefaultsSettings /><PhotoPolicySettings /></div>;
}
