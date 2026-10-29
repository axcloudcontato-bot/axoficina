import type { AdjustStockRequest, CatalogItemResponse, CatalogItemsResponse, CatalogPackageResponse, CatalogPackagesResponse, CatalogReportResponse, CreateCatalogItemRequest, ImportCatalogRequest, ImportCatalogResponse, SaveCatalogPackageRequest, SeedCatalogResponse, UpdateCatalogItemRequest } from '@oficina/contracts';
import { apiClient } from '@/lib/api/client';

export const catalogApi = {
  list: async (): Promise<CatalogItemsResponse> => (await apiClient.get('/api/v1/catalog/items')).data,
  create: async (request: CreateCatalogItemRequest): Promise<{ item: CatalogItemResponse }> => (await apiClient.post('/api/v1/catalog/items', request)).data,
  update: async (request: UpdateCatalogItemRequest): Promise<{ item: CatalogItemResponse }> => (await apiClient.post('/api/v1/catalog/items/update', request)).data,
  remove: async (id: string): Promise<{ success: true }> => (await apiClient.post('/api/v1/catalog/items/delete', { id })).data,
  seedDefaults: async (): Promise<SeedCatalogResponse> => (await apiClient.post('/api/v1/catalog/items/seed-defaults')).data,
  adjustStock: async (request: AdjustStockRequest): Promise<{ item: CatalogItemResponse }> => (await apiClient.post('/api/v1/catalog/items/stock', request)).data,
  importRows: async (request: ImportCatalogRequest): Promise<ImportCatalogResponse> => (await apiClient.post('/api/v1/catalog/items/import', request)).data,
  packages: async (): Promise<CatalogPackagesResponse> => (await apiClient.get('/api/v1/catalog/packages')).data,
  savePackage: async (request: SaveCatalogPackageRequest): Promise<{ package: CatalogPackageResponse }> => (await apiClient.post('/api/v1/catalog/packages/save', request)).data,
  removePackage: async (id: string): Promise<{ success: true }> => (await apiClient.post('/api/v1/catalog/packages/delete', { id })).data,
  report: async (days: number): Promise<CatalogReportResponse> => (await apiClient.get('/api/v1/catalog/report', { params: { days } })).data,
};
