'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Printing depends on the printer next to each computer (A4 in the office, thermal at the counter), so these
// preferences live in this browser only.
export const PAPER_FORMATS = ['A4', 'THERMAL_80', 'THERMAL_58'] as const;
export type PaperFormat = (typeof PAPER_FORMATS)[number];

export const PAPER_FORMAT_LABELS: Record<PaperFormat, string> = {
  A4: 'Folha A4 (jato de tinta ou laser)',
  THERMAL_80: 'Bobina térmica de 80 mm',
  THERMAL_58: 'Bobina térmica de 58 mm',
};

// Printable width of each roll: the print head never reaches the edges of the paper.
export const THERMAL_PRINTABLE_WIDTH_MM: Record<Exclude<PaperFormat, 'A4'>, number> = { THERMAL_80: 72, THERMAL_58: 48 };

export type ThermalFontSize = 'small' | 'normal' | 'large';
export const THERMAL_FONT_PX: Record<ThermalFontSize, number> = { small: 11, normal: 12, large: 14 };

export interface PrintPreferences {
  serviceOrderFormat: PaperFormat;
  a4MarginMm: number;
  thermalMarginMm: number;
  thermalFontSize: ThermalFontSize;
  thermalCopies: 1 | 2;
  showLogo: boolean;
  // Opens the print dialog as soon as the document is ready (or prints straight away with Chrome's kiosk printing).
  autoPrint: boolean;
  closeAfterPrint: boolean;
}

export const DEFAULT_PRINT_PREFERENCES: PrintPreferences = {
  serviceOrderFormat: 'A4',
  a4MarginMm: 12,
  thermalMarginMm: 2,
  thermalFontSize: 'normal',
  thermalCopies: 1,
  showLogo: true,
  autoPrint: false,
  closeAfterPrint: false,
};

export const MARGIN_LIMITS = { A4: { min: 5, max: 25 }, THERMAL: { min: 0, max: 8 } } as const;

interface PrintPreferencesStore extends PrintPreferences {
  update: (changes: Partial<PrintPreferences>) => void;
  reset: () => void;
}

export const usePrintPreferences = create<PrintPreferencesStore>()(persist(
  (set) => ({
    ...DEFAULT_PRINT_PREFERENCES,
    update: (changes) => set(changes),
    reset: () => set(DEFAULT_PRINT_PREFERENCES),
  }),
  { name: 'ofix-print-preferences', storage: createJSONStorage(() => localStorage), version: 1 },
));

export function isThermal(format: PaperFormat): format is Exclude<PaperFormat, 'A4'> {
  return format !== 'A4';
}

export function parsePaperFormat(value: string | null | undefined): PaperFormat | undefined {
  if (value === 'a4') return 'A4';
  if (value === '80mm') return 'THERMAL_80';
  if (value === '58mm') return 'THERMAL_58';
  return undefined;
}

export const PAPER_FORMAT_QUERY: Record<PaperFormat, string> = { A4: 'a4', THERMAL_80: '80mm', THERMAL_58: '58mm' };

// Page rules injected by the print pages. They come after globals.css, so they win over its default A4 @page.
export function pageStyle(format: PaperFormat, preferences: Pick<PrintPreferences, 'a4MarginMm' | 'thermalMarginMm'>): string {
  if (format === 'A4') {
    const margin = clamp(preferences.a4MarginMm, MARGIN_LIMITS.A4.min, MARGIN_LIMITS.A4.max);
    return `@media print { @page { size: A4 portrait; margin: ${margin}mm; } .print-summary-sheet { height: ${297 - margin * 2 - 1}mm !important; } }`;
  }
  const margin = clamp(preferences.thermalMarginMm, MARGIN_LIMITS.THERMAL.min, MARGIN_LIMITS.THERMAL.max);
  // The roll length comes from the printer driver; the page only fixes the width and the margins.
  return `@media print { @page { size: auto; margin: ${margin}mm ${margin}mm ${margin + 4}mm ${margin}mm; } html, body { width: auto !important; } }`;
}

function clamp(value: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
}

// Saved choices exist only in the browser: render the defaults first, as the server did, then switch to them.
export function useBrowserPrintPreferences(): PrintPreferencesStore & { mounted: boolean } {
  const store = usePrintPreferences();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? { ...store, mounted } : { ...store, ...DEFAULT_PRINT_PREFERENCES, mounted };
}
