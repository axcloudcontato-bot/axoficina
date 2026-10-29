import type { CatalogItemResponse, CatalogItemsResponse, CreateCatalogItemRequest, SeedCatalogResponse, UpdateCatalogItemRequest } from '@oficina/contracts';
import { apiClient } from '@/lib/api/client';

export const catalogApi = {
  list: async (): Promise<CatalogItemsResponse> => (await apiClient.get('/api/v1/catalog/items')).data,
  create: async (request: CreateCatalogItemRequest): Promise<{ item: CatalogItemResponse }> => (await apiClient.post('/api/v1/catalog/items', request)).data,
  update: async (request: UpdateCatalogItemRequest): Promise<{ item: CatalogItemResponse }> => (await apiClient.post('/api/v1/catalog/items/update', request)).data,
  remove: async (id: string): Promise<{ success: true }> => (await apiClient.post('/api/v1/catalog/items/delete', { id })).data,
  seedDefaults: async (): Promise<SeedCatalogResponse> => (await apiClient.post('/api/v1/catalog/items/seed-defaults')).data,
};
