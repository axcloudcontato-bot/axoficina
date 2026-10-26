'use client';
import { FinancialNav } from '@/features/financial/components/FinancialNav';
import { FinancialWorkspace } from '@/features/financial/components/FinancialWorkspace';
export default function TransactionsPage() { return <div className="space-y-5"><FinancialNav /><FinancialWorkspace mode="transactions" /></div>; }
