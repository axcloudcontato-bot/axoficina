import { InvoiceList } from '@/features/billing/InvoiceList';
import { PlanSwitcher } from '@/features/billing/PlanSwitcher';
import { WorkshopPlanAndData } from '@/features/settings/components/WorkshopPlanAndData';

export default function PlanAndDataPage() { return <WorkshopPlanAndData><PlanSwitcher /><InvoiceList /></WorkshopPlanAndData>; }
