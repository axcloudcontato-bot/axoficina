import { CloseAccountSection } from '@/features/account-closure/CloseAccountSection';
import { InvoiceList } from '@/features/billing/InvoiceList';
import { PlanSwitcher } from '@/features/billing/PlanSwitcher';
import { WorkshopPlanAndData } from '@/features/settings/components/WorkshopPlanAndData';

export default function PlanAndDataPage() {
  return <div className="space-y-6"><WorkshopPlanAndData><PlanSwitcher /><InvoiceList /></WorkshopPlanAndData><CloseAccountSection /></div>;
}
