'use client';

import { useRef, useState } from 'react';
import { DownloadSimple, UploadSimple } from '@phosphor-icons/react';
import type { ImportCustomersProblem } from '@oficina/contracts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { extractErrorMessage } from '@/lib/api/client';
import { downloadCsv, readFileText } from '@/lib/csv';
import { CUSTOMER_IMPORT_TEMPLATE, parseCustomersCsv, type CustomerImportParse } from '../customer-csv';
import { useImportCustomers } from '../hooks/use-customers';

export function CustomerImportModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const importCustomers = useImportCustomers();
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<CustomerImportParse>();
  // What the server said after importing: some rows may have been left out, and the person needs to see which.
  const [result, setResult] = useState<{ created: number; problems: ImportCustomersProblem[] }>();

  function close(next: boolean) {
    if (importCustomers.isPending) return;
    if (!next) { setParsed(undefined); setFileName(''); setResult(undefined); }
    onOpenChange(next);
  }

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setFileName(file.name);
    setResult(undefined);
    setParsed(parseCustomersCsv(await readFileText(file)));
  }

  function downloadTemplate() {
    downloadCsv('modelo-clientes.csv', CUSTOMER_IMPORT_TEMPLATE.split('\r\n').map((line) => line.split(';')));
  }

  function confirm() {
    if (!parsed?.rows.length) return;
    importCustomers.mutate({ rows: parsed.rows }, {
      onSuccess: (response) => {
        setResult(response);
        setParsed(undefined);
        toast.success(`${response.created} ${response.created === 1 ? 'cliente importado' : 'clientes importados'}.`);
      },
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  }

  const problems = result?.problems ?? [];

  return <Dialog open={open} onOpenChange={close}>
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Importar clientes</DialogTitle>
        <DialogDescription>Salve a planilha do Excel ou do Google Planilhas como CSV. Quem já está cadastrado (mesmo documento, ou mesmo nome e telefone) não é duplicado.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => input.current?.click()}><UploadSimple className="size-4" />{fileName || 'Escolher arquivo CSV'}</Button>
          <Button type="button" variant="ghost" onClick={downloadTemplate}><DownloadSimple className="size-4" />Baixar planilha modelo</Button>
          <input ref={input} type="file" accept=".csv,text/csv" aria-label="Arquivo CSV" className="hidden" onChange={pick} />
        </div>
        <p className="text-xs text-text-muted">Colunas aceitas: Nome e Telefone (obrigatórias), Tipo (PF ou PJ), Documento e E-mail. Até 300 clientes por vez. Os clientes importados não recebem lembretes de cuidado: isso depende da autorização de cada um.</p>
        {parsed && parsed.rows.length > 0 && <p className="rounded-button border border-border bg-surface p-3 text-sm"><strong>{parsed.rows.length}</strong> {parsed.rows.length === 1 ? 'cliente pronto' : 'clientes prontos'} para importar.</p>}
        {parsed && parsed.errors.length > 0 && <div role="alert" className="rounded-button border border-warning/30 bg-warning-subtle p-3 text-sm"><p className="font-semibold">{parsed.errors.length} {parsed.errors.length === 1 ? 'linha ignorada' : 'linhas ignoradas'}:</p><ul className="mt-1 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5">{parsed.errors.slice(0, 20).map((message) => <li key={message}>{message}</li>)}</ul></div>}
        {result && <div className="space-y-2 text-sm">
          <p className="rounded-button border border-success/30 bg-success-subtle p-3"><strong>{result.created}</strong> {result.created === 1 ? 'cliente importado' : 'clientes importados'}.</p>
          {problems.length > 0 && <div role="alert" className="rounded-button border border-warning/30 bg-warning-subtle p-3"><p className="font-semibold">{problems.length} {problems.length === 1 ? 'linha não foi importada' : 'linhas não foram importadas'}:</p><ul className="mt-1 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5">{problems.slice(0, 30).map((problem) => <li key={`${problem.line}-${problem.reason}`}>Linha {problem.line} ({problem.name}): {problem.reason}</li>)}</ul>{problems.length > 30 && <p className="mt-1 text-xs">E mais {problems.length - 30}.</p>}</div>}
        </div>}
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" disabled={importCustomers.isPending} onClick={() => close(false)}>{result ? 'Fechar' : 'Cancelar'}</Button>
        {!result && <Button type="button" disabled={importCustomers.isPending || !parsed?.rows.length} onClick={confirm}>{importCustomers.isPending ? 'Importando...' : `Importar ${parsed?.rows.length ?? 0} ${parsed?.rows.length === 1 ? 'cliente' : 'clientes'}`}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
