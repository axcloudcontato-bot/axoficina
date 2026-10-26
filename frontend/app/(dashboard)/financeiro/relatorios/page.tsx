'use client';
import { FinancialNav } from '@/features/financial/components/FinancialNav';
import { FinancialWorkspace } from '@/features/financial/components/FinancialWorkspace';
export default function FinancialReportsPage() { return <div className="space-y-5"><FinancialNav /><FinancialWorkspace mode="reports" /></div>; }
