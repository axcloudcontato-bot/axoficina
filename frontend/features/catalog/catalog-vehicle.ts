export const VEHICLE_GROUPS = ['Carro', 'Moto', 'Caminhão', 'Geral'] as const;
export type VehicleGroup = (typeof VEHICLE_GROUPS)[number];

export function splitCatalogCategory(category?: string | null): { vehicle: VehicleGroup; category: string } {
  const match = category?.match(/^(Carro|Moto|Caminhão|Geral) · (.+)$/);
  return match ? { vehicle: match[1] as VehicleGroup, category: match[2] } : { vehicle: 'Geral', category: category ?? '' };
}

export function catalogVehicle(category?: string | null): VehicleGroup {
  return splitCatalogCategory(category).vehicle;
}

export function composeCatalogCategory(vehicle: VehicleGroup, category: string): string {
  return `${vehicle} · ${category.trim() || 'Outros'}`;
}
