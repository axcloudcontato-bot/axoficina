'use client';

import { useMemo, useRef, useState } from 'react';
import type { CatalogItemResponse } from '@oficina/contracts';
import { DownloadSimple, UploadSimple } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { extractErrorMessage } from '@/lib/api/client';
import { CATALOG_IMPORT_TEMPLATE, parseCatalogCsv, type CatalogImportParse } from '../catalog-import';
import { useImportCatalog } from '../hooks/use-catalog';

const keyOf = (type: string, name: string) => `${type}:${name.trim().toLowerCase()}`;

export function CatalogImportModal({ open, existing, onOpenChange }: { open: boolean; existing: CatalogItemResponse[]; onOpenChange: (open: boolean) => void }) {
  const importRows = useImportCatalog();
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<CatalogImportParse>();

  const summary = useMemo(() => {
    if (!parsed) return undefined;
    const known = new Set(existing.map(item => keyOf(item.type, item.name)));
    const unique = new Map(parsed.rows.map(row => [keyOf(row.type, row.name), row]));
    const updated = [...unique.keys()].filter(key => known.has(key)).length;
    return { created: unique.size - updated, updated };
  }, [parsed, existing]);

  function close(next: boolean) {
    if (importRows.isPending) return;
    if (!next) { setParsed(undefined); setFileName(''); }
    onOpenChange(next);
  }

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setFileName(file.name);
    setParsed(parseCatalogCsv(await file.text()));
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([`﻿${CATALOG_IMPORT_TEMPLATE}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo-catalogo.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function confirm() {
    if (!parsed?.rows.length) return;
    importRows.mutate({ rows: parsed.rows }, {
      onSuccess: result => { toast.success(`${result.created} itens criados e ${result.updated} atualizados.`); close(false); },
      onError: error => toast.error(extractErrorMessage(error)),
    });
  }

  return <Dialog open={open} onOpenChange={close}>
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Importar planilha</DialogTitle>
        <DialogDescription>Salve a planilha do Excel ou do Google Planilhas como CSV. Itens com o mesmo tipo e nome já cadastrados têm o preço atualizado; os demais são criados.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => input.current?.click()}><UploadSimple className="size-4" />{fileName || 'Escolher arquivo CSV'}</Button>
          <Button type="button" variant="ghost" onClick={downloadTemplate}><DownloadSimple className="size-4" />Baixar planilha modelo</Button>
          <input ref={input} type="file" accept=".csv,text/csv" aria-label="Arquivo CSV" className="hidden" onChange={pick} />
        </div>
        <p className="text-xs text-text-muted">Colunas aceitas: Tipo (Peça, Produto ou Serviço), Nome, Categoria, Preço, Custo, Código, Marca e Unidade. Só Nome e Preço são obrigatórias. Até 500 itens por vez.</p>
        {parsed && summary && <div className="space-y-2 text-sm">
          {parsed.rows.length > 0 && <p className="rounded-button border border-border bg-surface p-3"><strong>{summary.created}</strong> {summary.created === 1 ? 'item novo' : 'itens novos'} e <strong>{summary.updated}</strong> {summary.updated === 1 ? 'já cadastrado' : 'já cadastrados'} (o preço será atualizado).</p>}
          {parsed.errors.length > 0 && <div role="alert" className="rounded-button border border-warning/30 bg-warning-subtle p-3"><p className="font-semibold">{parsed.errors.length} {parsed.errors.length === 1 ? 'linha ignorada' : 'linhas ignoradas'}:</p><ul className="mt-1 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5">{parsed.errors.slice(0, 20).map(message => <li key={message}>{message}</li>)}</ul>{parsed.errors.length > 20 && <p className="mt-1 text-xs">E mais {parsed.errors.length - 20}.</p>}</div>}
        </div>}
      </div>
      <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={importRows.isPending} onClick={() => close(false)}>Cancelar</Button><Button type="button" disabled={importRows.isPending || !parsed?.rows.length} onClick={confirm}>{importRows.isPending ? 'Importando...' : `Importar ${parsed?.rows.length ?? 0} ${parsed?.rows.length === 1 ? 'item' : 'itens'}`}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
