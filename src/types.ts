export type ValueType =
  | 'PERCENTAGE'
  | 'CURRENCY'
  | 'BYTES'
  | 'STATUS'
  | 'NUMBER'
  | 'LOG_LINE'
  | 'BOOLEAN'
  | 'TEXT';

export type SectorCategory =
  | 'INFRASTRUCTURE'
  | 'BUSINESS'
  | 'PERFORMANCE'
  | 'LOGS_ERRORS'
  | 'CUSTOM';

export type SectorType = 'COUNTER' | 'GAUGE' | 'LOG_STREAM' | 'STATUS';

export interface DataDefinition {
  id: string;
  name?: string;
  type?: SectorType;
  valueType?: ValueType;
  category?: SectorCategory;
  unit?: string;
}

export interface SectorDefinition {
  id: string;
  name?: string;
  category?: SectorCategory;
  data?: DataDefinition[];
  type?: SectorType;
  valueType?: ValueType;
  unit?: string;
}

export interface PushOptions {
  type?: ValueType;
  category?: SectorCategory;
  unit?: string;
  details?: string;
  timestamp?: number;
}

export interface MsmClientOptions {
  instanceId: string;
  instanceName?: string;
  token?: string;
  socketPath?: string;
  autoReconnect?: boolean;
  reconnectIntervalMs?: number;
  maxReconnectIntervalMs?: number;
  maxBufferSize?: number;
  logger?: boolean | ((msg: string) => void);
}

export interface SdkResponse {
  status: 'OK' | 'ERROR' | 'PONG';
  message?: string;
}
