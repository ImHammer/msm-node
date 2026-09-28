import { MsmClient } from './client';
import { MsmSector } from './sector';
import { MsmClientOptions, PushOptions, SectorCategory } from './types';

export { MsmClient } from './client';
export { MsmSector } from './sector';
export * from './types';

let defaultClient: MsmClient | null = null;

/**
 * Inicializa a instância padrão (Singleton) do MSM para a aplicação.
 * Chame uma única vez no arquivo principal da sua aplicação (ex: server.ts / app.ts).
 */
export function init(options: MsmClientOptions): MsmClient {
  if (defaultClient) {
    return defaultClient;
  }
  defaultClient = new MsmClient(options);
  // Inicia conexão em background automaticamente
  defaultClient.connect().catch(() => {});
  return defaultClient;
}

/**
 * Retorna a instância padrão inicializada do MSM.
 */
export function getClient(): MsmClient {
  if (!defaultClient) {
    throw new Error('[MSM SDK] O cliente MSM ainda não foi inicializado. Chame init({ instanceId: "..." }) no ponto de entrada da sua aplicação.');
  }
  return defaultClient;
}

/**
 * Acessa um setor diretamente a partir do cliente padrão.
 */
export function sector(
  sectorId: string,
  nameOrOptions?: string | { name?: string; category?: SectorCategory }
): MsmSector {
  return getClient().sector(sectorId, nameOrOptions);
}

/**
 * Envia um log direto no nível da instância usando o cliente padrão.
 */
export function log(message: string, details?: string, dataId: string = 'logs'): void {
  getClient().log(message, details, dataId);
}

/**
 * Envia um dado direto no nível da instância usando o cliente padrão.
 */
export function pushDirect(
  dataId: string,
  value: string | number | boolean,
  options?: PushOptions
): void {
  getClient().pushDirect(dataId, value, options);
}

/**
 * Envia um dado para um setor usando o cliente padrão.
 */
export function pushSector(
  sectorId: string,
  dataId: string,
  value: string | number | boolean,
  options?: PushOptions
): void {
  getClient().pushSector(sectorId, dataId, value, options);
}

const msm = {
  init,
  getClient,
  sector,
  log,
  pushDirect,
  pushSector,
  MsmClient,
  MsmSector
};

export default msm;
