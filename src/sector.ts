import { MsmClient } from './client';
import { PushOptions, SectorCategory } from './types';

export class MsmSector {
  constructor(
    private readonly client: MsmClient,
    public readonly id: string,
    public readonly name?: string,
    public readonly category?: SectorCategory
  ) {}

  /**
   * Envia uma métrica genérica para este setor.
   */
  push(dataId: string, value: string | number | boolean, options?: PushOptions): void {
    this.client.pushSector(this.id, dataId, value, {
      ...options,
      category: options?.category ?? this.category
    });
  }

  /**
   * Registra uma linha de log para este setor.
   */
  log(message: string, details?: string, dataId: string = 'logs'): void {
    this.push(dataId, message, {
      type: 'LOG_LINE',
      category: this.category ?? 'LOGS_ERRORS',
      details
    });
  }

  /**
   * Atualiza uma métrica de status para este setor.
   */
  status(value: string): void {
    this.push('status', value, { type: 'STATUS' });
  }

  /**
   * Atualiza um contador numérico para este setor.
   */
  count(dataId: string, value: number, unit?: string): void {
    this.push(dataId, value, { type: 'NUMBER', unit });
  }

  /**
   * Atualiza um valor financeiro formatado (moeda) para este setor.
   */
  currency(dataId: string, value: number, unit: string = 'BRL'): void {
    this.push(dataId, value, { type: 'CURRENCY', unit });
  }

  /**
   * Atualiza uma porcentagem (0 a 100) para este setor.
   */
  percentage(dataId: string, value: number): void {
    this.push(dataId, value, { type: 'PERCENTAGE', unit: '%' });
  }
}
