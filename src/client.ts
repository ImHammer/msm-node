import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import {
  MsmClientOptions,
  PushOptions,
  DataDefinition,
  SectorDefinition,
  SdkResponse
} from './types';
import { MsmSector } from './sector';

export class MsmClient extends EventEmitter {
  public readonly instanceId: string;
  public readonly instanceName: string;
  public readonly token?: string;
  public readonly socketPath: string;

  private socket: net.Socket | null = null;
  private isConnecting: boolean = false;
  private isConnected: boolean = false;
  private isAuthenticated: boolean = false;
  private shouldReconnect: boolean = true;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private currentReconnectDelay: number;

  private readonly autoReconnect: boolean;
  private readonly reconnectIntervalMs: number;
  private readonly maxReconnectIntervalMs: number;
  private readonly maxBufferSize: number;
  private readonly buffer: string[] = [];
  private readonly registeredSectors = new Map<string, SectorDefinition>();
  private readonly registeredData = new Map<string, DataDefinition>();
  private incomingBuffer: string = '';

  private authResolver?: { resolve: () => void; reject: (err: Error) => void };
  private pingResolvers: Array<(pong: boolean) => void> = [];

  constructor(options: MsmClientOptions) {
    super();

    if (!options.instanceId) {
      throw new Error('[MSM SDK] O parâmetro "instanceId" é obrigatório.');
    }

    this.instanceId = options.instanceId.trim();
    this.instanceName = options.instanceName?.trim() || this.instanceId;
    this.token = options.token?.trim() || process.env.MSM_TOKEN?.trim();

    this.socketPath = this.resolveSocketPath(options.socketPath);
    this.autoReconnect = options.autoReconnect !== false;
    this.reconnectIntervalMs = options.reconnectIntervalMs || 2000;
    this.maxReconnectIntervalMs = options.maxReconnectIntervalMs || 30000;
    this.currentReconnectDelay = this.reconnectIntervalMs;
    this.maxBufferSize = options.maxBufferSize || 1000;

    if (options.logger === true) {
      this.debugLog = (msg: string) => console.log(`[MSM SDK] ${msg}`);
    } else if (typeof options.logger === 'function') {
      this.debugLog = options.logger;
    }
  }

  private debugLog(msg: string): void {
    // Silencioso por padrão, a não ser que logger esteja ativo
  }

  /**
   * Conecta ao Unix Domain Socket do Agent e realiza o handshake de autenticação.
   */
  public async connect(): Promise<void> {
    if (this.isConnected) return;
    this.shouldReconnect = true;

    return new Promise((resolve, reject) => {
      this.isConnecting = true;

      const onInitialConnect = () => {
        cleanup();
        resolve();
      };

      const onInitialError = (err: Error) => {
        cleanup();
        reject(err);
      };

      const cleanup = () => {
        this.removeListener('ready', onInitialConnect);
        this.removeListener('error', onInitialError);
      };

      this.once('ready', onInitialConnect);
      this.once('error', onInitialError);

      this.startConnection();
    });
  }

  /**
   * Encerra a conexão e desliga a reconexão automática.
   */
  public async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    return new Promise((resolve) => {
      if (!this.socket || this.socket.destroyed) {
        this.isConnected = false;
        resolve();
        return;
      }

      this.socket.once('close', () => {
        this.isConnected = false;
        resolve();
      });
      this.socket.end();
    });
  }

  public async close(): Promise<void> {
    return this.disconnect();
  }

  /**
   * Registra a instância no Agent com dados diretos e/ou setores.
   */
  public async register(options?: {
    data?: DataDefinition[];
    sectors?: SectorDefinition[];
  }): Promise<void> {
    if (options?.data) {
      for (const d of options.data) {
        this.registeredData.set(d.id, d);
      }
    }

    if (options?.sectors) {
      for (const s of options.sectors) {
        this.registeredSectors.set(s.id, s);
      }
    }

    const payload = {
      action: 'REGISTER_INSTANCE',
      token: this.token,
      instanceId: this.instanceId,
      name: this.instanceName,
      data: Array.from(this.registeredData.values()),
      sectors: Array.from(this.registeredSectors.values())
    };

    this.sendPayload(payload);
  }

  /**
   * Envia uma métrica ou dado DIRETAMENTE para a instância (sem setor).
   */
  public pushDirect(dataId: string, value: string | number | boolean, options?: PushOptions): void {
    const payload = {
      action: 'PUSH_EVENT',
      token: this.token,
      instanceId: this.instanceId,
      dataId: dataId.trim(),
      value: String(value),
      valueType: options?.type,
      category: options?.category,
      unit: options?.unit,
      details: options?.details,
      timestamp: options?.timestamp || Date.now()
    };

    this.sendPayload(payload);
  }

  /**
   * Envia uma linha de log direto no nível da instância.
   */
  public log(message: string, details?: string, dataId: string = 'logs'): void {
    this.pushDirect(dataId, message, {
      type: 'LOG_LINE',
      category: 'LOGS_ERRORS',
      details
    });
  }

  /**
   * Envia uma métrica ou log para um SETOR específico da instância.
   */
  public pushSector(
    sectorId: string,
    dataId: string,
    value: string | number | boolean,
    options?: PushOptions
  ): void {
    const payload = {
      action: 'PUSH_EVENT',
      token: this.token,
      instanceId: this.instanceId,
      sectorId: sectorId.trim(),
      dataId: dataId.trim(),
      value: String(value),
      valueType: options?.type,
      category: options?.category,
      unit: options?.unit,
      details: options?.details,
      timestamp: options?.timestamp || Date.now()
    };

    this.sendPayload(payload);
  }

  /**
   * Retorna um helper fluente para manipular um setor específico.
   */
  public sector(
    sectorId: string,
    nameOrOptions?: string | { name?: string; category?: import('./types').SectorCategory }
  ): MsmSector {
    const secName = typeof nameOrOptions === 'string' ? nameOrOptions : nameOrOptions?.name;
    const secCategory = typeof nameOrOptions === 'object' ? nameOrOptions?.category : undefined;

    if (!this.registeredSectors.has(sectorId)) {
      this.registeredSectors.set(sectorId, {
        id: sectorId,
        name: secName || sectorId,
        category: secCategory,
        data: []
      });
    } else {
      const existing = this.registeredSectors.get(sectorId)!;
      if (secName) existing.name = secName;
      if (secCategory) existing.category = secCategory;
    }

    return new MsmSector(this, sectorId, secName, secCategory);
  }

  /**
   * Retorna a quantidade de mensagens acumuladas no buffer de retry/offline.
   */
  public getBufferedCount(): number {
    return this.buffer.length;
  }

  /**
   * Testa a conectividade através de um comando PING.
   */
  public async ping(): Promise<boolean> {
    if (!this.isConnected) return false;

    return new Promise((resolve) => {
      this.pingResolvers.push(resolve);
      this.sendPayload({ action: 'PING' });

      setTimeout(() => {
        const idx = this.pingResolvers.indexOf(resolve);
        if (idx !== -1) {
          this.pingResolvers.splice(idx, 1);
          resolve(false);
        }
      }, 5000);
    });
  }

  private startConnection(): void {
    if (this.socket && !this.socket.destroyed) {
      this.socket.destroy();
    }

    this.debugLog(`Conectando ao socket em: ${this.socketPath}...`);
    this.socket = net.createConnection(this.socketPath);

    this.socket.on('connect', () => {
      this.debugLog('Socket Unix conectado. Iniciando handshake de autenticação...');
      this.isConnected = true;
      this.isConnecting = false;
      this.currentReconnectDelay = this.reconnectIntervalMs;

      // Realiza handshake de autenticação
      this.authenticate();
    });

    this.socket.on('data', (chunk: Buffer) => {
      this.incomingBuffer += chunk.toString('utf-8');
      const lines = this.incomingBuffer.split('\n');
      this.incomingBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const response = JSON.parse(line.trim()) as SdkResponse;
          this.handleServerResponse(response);
        } catch (e) {
          this.debugLog(`Erro ao decodificar resposta do servidor: ${line}`);
        }
      }
    });

    this.socket.on('error', (err: Error) => {
      this.debugLog(`Erro no socket: ${err.message}`);
      if (this.listenerCount('error') > 0) {
        this.emit('error', err);
      }
    });

    this.socket.on('close', () => {
      const wasConnected = this.isConnected;
      this.isConnected = false;
      this.isAuthenticated = false;
      this.isConnecting = false;

      if (wasConnected) {
        this.debugLog('Conexão com o MSM Agent encerrada.');
        this.emit('disconnect');
      }

      if (this.shouldReconnect && this.autoReconnect) {
        this.scheduleReconnect();
      }
    });
  }

  private authenticate(): void {
    if (!this.token) {
      this.debugLog('Aviso: Nenhum token de SDK configurado. Prosseguindo sem autenticação.');
      this.onReady();
      return;
    }

    const authPayload = {
      action: 'AUTH',
      token: this.token
    };

    const promise = new Promise<void>((resolve, reject) => {
      this.authResolver = { resolve, reject };
    });

    this.rawSend(JSON.stringify(authPayload));

    promise
      .then(() => {
        this.isAuthenticated = true;
        this.debugLog('Autenticação no Agent realizada com sucesso.');
        this.onReady();
      })
      .catch((err) => {
        this.debugLog(`Falha de autenticação: ${err.message}`);
        this.emit('error', err);
      });
  }

  private onReady(): void {
    // Re-registra catálogo se houver dados ou setores definidos
    if (this.registeredData.size > 0 || this.registeredSectors.size > 0) {
      this.register();
    }

    // Despeja mensagens pendentes no buffer offline
    this.flushBuffer();

    this.emit('ready');
  }

  private handleServerResponse(response: SdkResponse): void {
    if (response.status === 'PONG') {
      const resolver = this.pingResolvers.shift();
      if (resolver) resolver(true);
      return;
    }

    if (this.authResolver) {
      const { resolve, reject } = this.authResolver;
      this.authResolver = undefined;
      if (response.status === 'OK') {
        resolve();
      } else {
        reject(new Error(response.message || 'Falha de autenticação'));
      }
      return;
    }

    if (response.status === 'ERROR') {
      this.debugLog(`Erro retornado pelo Agent: ${response.message}`);
      this.emit('server_error', response.message);
    }
  }

  private sendPayload(payload: object): void {
    const raw = JSON.stringify(payload);

    if (this.isConnected && (this.isAuthenticated || !this.token)) {
      this.rawSend(raw);
    } else {
      // Bufferiza em memória caso o Agent esteja temporariamente fora
      if (this.buffer.length >= this.maxBufferSize) {
        this.buffer.shift(); // Descarta a mensagem mais antiga para evitar vazamento
        this.debugLog('Aviso: Buffer de eventos cheio. Mensagem mais antiga descartada.');
      }
      this.buffer.push(raw);
    }
  }

  private rawSend(rawJsonLine: string): void {
    if (this.socket && !this.socket.destroyed) {
      this.socket.write(rawJsonLine + '\n', 'utf-8');
    }
  }

  private flushBuffer(): void {
    if (this.buffer.length === 0) return;

    this.debugLog(`Despejando ${this.buffer.length} evento(s) acumulado(s) no buffer...`);
    while (this.buffer.length > 0 && this.isConnected) {
      const item = this.buffer.shift();
      if (item) this.rawSend(item);
    }
    this.emit('flushed');
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.debugLog(`Tentando reconectar em ${Math.round(this.currentReconnectDelay / 1000)}s...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.currentReconnectDelay = Math.min(
        this.currentReconnectDelay * 1.5,
        this.maxReconnectIntervalMs
      );
      this.startConnection();
    }, this.currentReconnectDelay);
  }

  private resolveSocketPath(customPath?: string): string {
    if (customPath && customPath.trim()) {
      return customPath.trim();
    }

    if (process.env.MSM_SOCKET_PATH) {
      return process.env.MSM_SOCKET_PATH.trim();
    }

    const isWindows = process.platform === 'win32';
    if (isWindows) {
      let dir = process.cwd();
      for (let i = 0; i < 4; i++) {
        const candidate = path.resolve(dir, '.msm/events.sock');
        if (fs.existsSync(candidate)) return candidate;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
      return path.resolve(process.cwd(), '.msm/events.sock');
    }

    // No Linux: tenta /run/msm/events.sock se existir, ou fallback para ~/.msm/events.sock
    const linuxRunSock = '/run/msm/events.sock';
    if (fs.existsSync(linuxRunSock)) {
      return linuxRunSock;
    }

    const userSock = path.join(os.homedir(), '.msm/events.sock');
    if (fs.existsSync(userSock)) {
      return userSock;
    }

    // Default para Linux
    return linuxRunSock;
  }
}
