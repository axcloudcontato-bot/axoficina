import { Injectable, Logger } from '@nestjs/common';

// Looks up the 7-digit IBGE city code from the city name and state, which the NFS-e needs for both parties.
// Uses the public IBGE localities API and keeps each state's list in memory.
const IBGE_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados';

export const normalizeCityName = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

@Injectable()
export class IbgeCityService {
  private readonly logger = new Logger(IbgeCityService.name);
  private readonly cache = new Map<string, Map<string, string>>();

  async codeFor(city?: string | null, state?: string | null): Promise<string | undefined> {
    const uf = state?.trim().toUpperCase();
    if (!city?.trim() || !uf || !/^[A-Z]{2}$/.test(uf)) return undefined;
    const cities = await this.citiesOf(uf);
    return cities?.get(normalizeCityName(city));
  }

  private async citiesOf(uf: string): Promise<Map<string, string> | undefined> {
    const cached = this.cache.get(uf);
    if (cached) return cached;
    try {
      const response = await fetch(`${IBGE_URL}/${uf}/municipios`, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) return undefined;
      const rows = (await response.json()) as Array<{ id: number; nome: string }>;
      const cities = new Map(rows.map((row) => [normalizeCityName(row.nome), String(row.id)]));
      this.cache.set(uf, cities);
      return cities;
    } catch (error) {
      this.logger.warn(`Consulta de municípios do IBGE falhou (${uf}): ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }
}
