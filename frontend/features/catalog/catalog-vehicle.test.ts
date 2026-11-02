import { describe, expect, it } from 'vitest';
import { catalogVehicle, composeCatalogCategory, splitCatalogCategory } from './catalog-vehicle';

describe('catalog vehicle categories', () => {
  it('keeps vehicle-specific items in their own group', () => {
    for (const vehicle of ['Carro', 'Moto', 'Caminhão'] as const) {
      const category = composeCatalogCategory(vehicle, 'Freios');
      expect(catalogVehicle(category)).toBe(vehicle);
      expect(splitCatalogCategory(category)).toEqual({ vehicle, category: 'Freios' });
    }
  });

  it('shows legacy custom categories under general use', () => {
    expect(splitCatalogCategory('Minha categoria')).toEqual({ vehicle: 'Geral', category: 'Minha categoria' });
    expect(catalogVehicle(null)).toBe('Geral');
  });
});
