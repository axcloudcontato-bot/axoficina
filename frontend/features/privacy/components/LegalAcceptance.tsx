'use client';

import Link from 'next/link';
import type { UseFormReturn, FieldValues, Path } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

export function LegalAcceptance<T extends FieldValues>({ form }: { form: UseFormReturn<T> }) {
  return <div className="space-y-3 text-sm text-text-muted">
    <FormField control={form.control} name={'acceptedTerms' as Path<T>} render={({ field }) => <FormItem><div className="flex items-start gap-3"><FormControl><input type="checkbox" checked={Boolean(field.value)} onChange={(event) => field.onChange(event.target.checked)} onBlur={field.onBlur} ref={field.ref} className="mt-1 size-4 shrink-0 accent-primary" /></FormControl><FormLabel className="font-normal leading-5 text-text-muted">Li e aceito os <Link href="/termos" target="_blank" rel="noopener noreferrer" className="text-primary underline">Termos de uso</Link> e estou ciente da <Link href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-primary underline">Política de privacidade</Link>.</FormLabel></div><FormMessage /></FormItem>} />
    <p className="text-xs leading-5">Seus dados serão usados para criar e proteger a conta e prestar o serviço. Este aceite não autoriza publicidade. Consulte também a <Link href="/reembolso" target="_blank" rel="noopener noreferrer" className="text-primary underline">Política de cancelamento e reembolso</Link>.</p>
  </div>;
}
