/**
 * API Demo de Testes para o MSM Node.js SDK
 *
 * Esta API demonstra na prática a integração com o MSM Agent:
 * - Registro de catálogo de métricas e setores
 * - Envio de dados diretos (status, uptime, requests)
 * - Envio de dados por setores (auth, orders, errors)
 * - Envio intensivo de logs (LOG_LINE com details)
 * - Simulação de tráfego e erros para visualização em tempo real no console/app
 *
 * Execução:
 *   node server.js
 *   ou via npm (na pasta packages/msm-node): npm run api
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { MsmClient } = require('../../dist/index');

const PORT = process.env.PORT || 3333;

// 1. Tenta recuperar automaticamente o SDK Token do msm-config.json
let sdkToken = process.env.MSM_TOKEN;
if (!sdkToken) {
  try {
    const configPath = path.resolve(__dirname, '../../../../msm-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      sdkToken = config.sdkToken;
      console.log(`[MSM API Demo] Token carregado de msm-config.json: ${sdkToken}`);
    }
  } catch (_) {}
}

// 2. Inicializa o cliente MSM
const msm = new MsmClient({
  instanceId: 'node-ecommerce-api',
  instanceName: 'E-Commerce Demo API (Node.js)',
  token: sdkToken,
  logger: true
});

// Setores organizados
const authSector = msm.sector('auth', { name: 'Autenticação & Segurança', category: 'BUSINESS' });
const ordersSector = msm.sector('orders', { name: 'Pedidos & Pagamentos', category: 'BUSINESS' });
const errorsSector = msm.sector('errors', { name: 'Erros & Exceções', category: 'LOGS_ERRORS' });

// Estado local da API para demonstração
const state = {
  startTime: Date.now(),
  totalRequests: 0,
  ordersCount: 0,
  totalRevenue: 0.0,
  activeUsers: 12,
  failedLogins: 0,
  errorsCount: 0,
  lastLogs: []
};

function recordLocalLog(sector, message, details) {
  const item = {
    timestamp: new Date().toISOString(),
    sector,
    message,
    details: details || null
  };
  state.lastLogs.unshift(item);
  if (state.lastLogs.length > 20) state.lastLogs.pop();
}

// 3. Inicialização e Registro no MSM Agent
async function setupMsm() {
  console.log('[MSM API Demo] Conectando ao Agent via Unix Domain Socket...');

  try {
    await msm.connect();
    console.log('[MSM API Demo] ✓ Conectado com sucesso ao MSM Agent!');

    // Registra catálogo completo de dados diretos e setores
    await msm.register({
      data: [
        { id: 'status', name: 'Status da API', type: 'STATUS', valueType: 'STATUS' },
        { id: 'uptime', name: 'Tempo de Uptime', type: 'GAUGE', valueType: 'TEXT' },
        { id: 'requests_total', name: 'Total de Requisições', type: 'COUNTER', valueType: 'NUMBER', unit: 'req' },
        { id: 'logs', name: 'Logs da Aplicação', type: 'LOG_STREAM', valueType: 'LOG_LINE' }
      ],
      sectors: [
        {
          id: 'auth',
          name: 'Autenticação & Segurança',
          category: 'BUSINESS',
          data: [
            { id: 'active_users', name: 'Usuários Ativos', type: 'GAUGE', valueType: 'NUMBER', unit: 'users' },
            { id: 'failed_logins', name: 'Falhas de Login', type: 'COUNTER', valueType: 'NUMBER', unit: 'fails' },
            { id: 'logs', name: 'Logs de Acesso', type: 'LOG_STREAM', valueType: 'LOG_LINE' }
          ]
        },
        {
          id: 'orders',
          name: 'Pedidos & Pagamentos',
          category: 'BUSINESS',
          data: [
            { id: 'total_orders', name: 'Total de Pedidos', type: 'COUNTER', valueType: 'NUMBER', unit: 'pedidos' },
            { id: 'revenue', name: 'Faturamento Total', type: 'GAUGE', valueType: 'CURRENCY', unit: 'BRL' },
            { id: 'logs', name: 'Logs de Transações', type: 'LOG_STREAM', valueType: 'LOG_LINE' }
          ]
        },
        {
          id: 'errors',
          name: 'Erros & Exceções',
          category: 'LOGS_ERRORS',
          data: [
            { id: 'error_count', name: 'Total de Erros', type: 'COUNTER', valueType: 'NUMBER', unit: 'erros' },
            { id: 'status', name: 'Estado de Integridade', type: 'STATUS', valueType: 'STATUS' },
            { id: 'logs', name: 'Logs de Erro', type: 'LOG_STREAM', valueType: 'LOG_LINE' }
          ]
        }
      ]
    });

    // Envia valores iniciais
    msm.pushDirect('status', 'ONLINE', { valueType: 'STATUS' });
    msm.pushDirect('uptime', '0m', { valueType: 'TEXT' });
    msm.pushDirect('requests_total', 0, { valueType: 'NUMBER', unit: 'req' });

    authSector.push('active_users', state.activeUsers, { type: 'NUMBER', unit: 'users' });
    authSector.push('failed_logins', 0, { type: 'NUMBER', unit: 'fails' });
    authSector.log('API inicializada - Serviço de autenticação operacional');

    ordersSector.count('total_orders', 0, 'pedidos');
    ordersSector.currency('revenue', 0.0, 'BRL');
    ordersSector.log('Módulo de pagamentos iniciado e pronto para receber pedidos');

    errorsSector.count('error_count', 0, 'erros');
    errorsSector.status('NORMAL');

    // Log direto na instância
    msm.log('API E-Commerce iniciada na porta ' + PORT, 'Node.js v' + process.version);
    recordLocalLog('root', 'API E-Commerce iniciada na porta ' + PORT);

  } catch (err) {
    console.warn('[MSM API Demo] ⚠ Aviso ao conectar com o Agent:', err.message);
    console.warn('[MSM API Demo] A API continuará rodando! Eventos serão enfileirados no buffer offline.');
  }
}

// Atualização periódica de uptime e métricas gerais (a cada 10 segundos)
setInterval(() => {
  const uptimeSeconds = Math.floor((Date.now() - state.startTime) / 1000);
  const minutes = Math.floor(uptimeSeconds / 60);
  const seconds = uptimeSeconds % 60;
  const uptimeText = `${minutes}m ${seconds}s`;

  msm.pushDirect('uptime', uptimeText, { valueType: 'TEXT' });
  msm.pushDirect('requests_total', state.totalRequests, { valueType: 'NUMBER', unit: 'req' });
}, 10000);

// Helper para ler JSON do corpo da requisição
function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (_) {
        resolve({});
      }
    });
  });
}

// 4. Servidor HTTP da API de Testes
const server = http.createServer(async (req, res) => {
  state.totalRequests++;
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // ROTA 1: Informações gerais e Painel de Ajuda
  if ((pathname === '/' || pathname === '/api') && method === 'GET') {
    return res.end(JSON.stringify({
      app: 'MSM Node.js SDK Test API',
      status: 'ONLINE',
      uptime_seconds: Math.floor((Date.now() - state.startTime) / 1000),
      metrics: {
        total_requests: state.totalRequests,
        orders_count: state.ordersCount,
        total_revenue_brl: state.totalRevenue.toFixed(2),
        active_users: state.activeUsers,
        failed_logins: state.failedLogins,
        errors_count: state.errorsCount,
        buffered_events_in_sdk: msm.getBufferedCount()
      },
      available_endpoints: {
        'GET /': 'Exibe este resumo de status e endpoints',
        'POST /api/orders': 'Cria um pedido fictício (gera métricas de faturamento e log de venda)',
        'POST /api/auth/login': 'Simula login { username, success: true/false } (gera log de autenticação)',
        'POST /api/errors': 'Simula um erro { message, level } (gera log de erro e alerta no setor)',
        'POST /api/logs': 'Envia um log customizado { sector, message, details, dataId }',
        'GET /api/simulate': 'Simula uma rajada automática de pedidos, logins e logs para testes',
        'GET /api/logs': 'Lista os últimos 20 logs emitidos localmente pela API',
        'GET /health': 'Verifica saúde da aplicação e do socket do MSM Agent'
      }
    }, null, 2));
  }

  // ROTA 2: Criar Pedido (Testa métricas de negócio e logs de transação)
  if (pathname === '/api/orders' && method === 'POST') {
    const body = await parseJsonBody(req);
    const amount = typeof body.amount === 'number' ? body.amount : (Math.random() * 200 + 20);
    const customer = body.customer || 'Cliente-' + Math.floor(Math.random() * 9000 + 1000);
    const orderId = 'ORD-' + Math.floor(Math.random() * 90000 + 10000);

    state.ordersCount++;
    state.totalRevenue += amount;

    // Atualiza métricas no MSM Agent
    ordersSector.count('total_orders', state.ordersCount, 'pedidos');
    ordersSector.currency('revenue', state.totalRevenue, 'BRL');

    // Registra LOG detalhado da transação
    const logMsg = `Pedido ${orderId} aprovado via PIX: R$ ${amount.toFixed(2)} (${customer})`;
    const logDetails = JSON.stringify({
      orderId,
      customer,
      amount: amount.toFixed(2),
      paymentMethod: 'PIX',
      itemsCount: Math.floor(Math.random() * 4 + 1),
      timestamp: new Date().toISOString()
    });

    ordersSector.log(logMsg, logDetails);
    recordLocalLog('orders', logMsg, logDetails);

    return res.end(JSON.stringify({
      success: true,
      message: 'Pedido processado e transmitido ao MSM Agent!',
      order: { orderId, customer, amount: amount.toFixed(2) }
    }));
  }

  // ROTA 3: Simulação de Login (Testa métricas de acesso e logs de segurança)
  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = await parseJsonBody(req);
    const username = body.username || 'usuario_' + Math.floor(Math.random() * 50);
    const isSuccess = body.success !== false;

    if (isSuccess) {
      state.activeUsers++;
      authSector.push('active_users', state.activeUsers, { type: 'NUMBER', unit: 'users' });

      const logMsg = `Login bem-sucedido para '${username}'`;
      const logDetails = `IP: 192.168.1.${Math.floor(Math.random() * 250)} | Dispositivo: Chrome/120 Android`;
      authSector.log(logMsg, logDetails);
      recordLocalLog('auth', logMsg, logDetails);

      return res.end(JSON.stringify({
        success: true,
        message: 'Login registrado com sucesso',
        user: username
      }));
    } else {
      state.failedLogins++;
      authSector.push('failed_logins', state.failedLogins, { type: 'NUMBER', unit: 'fails' });

      const logMsg = `Falha de autenticação para '${username}': Senha incorreta`;
      const logDetails = `Tentativa suspeita bloqueada. IP: 187.54.12.${Math.floor(Math.random() * 250)}`;
      authSector.log(logMsg, logDetails);
      recordLocalLog('auth', logMsg, logDetails);

      res.statusCode = 401;
      return res.end(JSON.stringify({
        success: false,
        error: 'Credenciais inválidas. Evento de falha enviado ao MSM Agent.',
        user: username
      }));
    }
  }

  // ROTA 4: Simulação de Erro / Falha de Sistema (Testa logs de erro e status)
  if ((pathname === '/api/errors' || pathname === '/api/error') && (method === 'POST' || method === 'GET')) {
    const body = method === 'POST' ? await parseJsonBody(req) : {};
    const errorMsg = body.message || 'Exceção não tratada na conexão com banco de dados de réplica';
    const errorLevel = (body.level || 'ERROR').toUpperCase();

    state.errorsCount++;
    errorsSector.count('error_count', state.errorsCount, 'erros');
    errorsSector.status(state.errorsCount > 5 ? 'CRITICAL' : 'WARNING');

    // Monta stack trace fictício ou real
    const fakeStack = `Error: ${errorMsg}\n    at DatabasePool.query (/app/src/db/postgres.js:142:15)\n    at async OrderService.checkout (/app/src/services/orders.js:89:12)\n    at async dispatch (/app/src/routes/api.js:45:7)`;

    // Envia o log de erro detalhado para o setor de erros
    errorsSector.log(`[${errorLevel}] ${errorMsg}`, fakeStack, 'error_logs');
    recordLocalLog('errors', `[${errorLevel}] ${errorMsg}`, fakeStack);

    res.statusCode = 500;
    return res.end(JSON.stringify({
      success: false,
      error: errorMsg,
      msm_notified: true,
      errors_total: state.errorsCount
    }));
  }

  // ROTA 5: Envio de Log Personalizado Arbitrário
  if (pathname === '/api/logs' && method === 'POST') {
    const body = await parseJsonBody(req);
    const message = body.message || 'Log de teste emitido via endpoint /api/logs';
    const details = body.details || `Emitido em ${new Date().toISOString()} via HTTP`;
    const targetSector = body.sector; // opcional: 'auth', 'orders', 'errors', ou vazio para log direto
    const dataId = body.dataId || 'logs';

    if (targetSector) {
      const sec = msm.sector(targetSector);
      sec.log(message, details, dataId);
      recordLocalLog(targetSector, message, details);
    } else {
      msm.log(message, details, dataId);
      recordLocalLog('root', message, details);
    }

    return res.end(JSON.stringify({
      success: true,
      message: 'Log transmitido para o MSM Agent!',
      log: { sector: targetSector || 'root', dataId, message, details }
    }));
  }

  // ROTA 6: Simulação de Tráfego em Tempo Real (Eventos espaçados para visualização ao vivo)
  if (pathname === '/api/simulate' && (method === 'GET' || method === 'POST')) {
    console.log('[MSM API Demo] Disparando simulação de tráfego...');

    // Resposta imediata para liberar a requisição HTTP
    res.end(JSON.stringify({
      success: true,
      message: 'Simulação de tráfego iniciada! Acompanhe os logs e métricas sendo emitidos em tempo real no app MSM.',
      status: 'TRANSMITTING'
    }));

    // Executa os eventos com pequeno intervalo (500ms) para cada métrica/log ser visível no app
    (async () => {
      const wait = (ms) => new Promise(r => setTimeout(r, ms));

      // 1. Gera 3 pedidos sequenciais
      for (let i = 1; i <= 3; i++) {
        state.ordersCount++;
        const val = +(Math.random() * 150 + 30).toFixed(2);
        state.totalRevenue += val;
        const orderId = `ORD-SIM-${state.ordersCount}`;
        ordersSector.count('total_orders', state.ordersCount, 'pedidos');
        ordersSector.currency('revenue', state.totalRevenue, 'BRL');
        ordersSector.log(`[SIMULAÇÃO] Pedido ${orderId} concluído: R$ ${val}`, `Valor: R$ ${val} | Pagamento: Cartão de Crédito`);
        recordLocalLog('orders', `[SIMULAÇÃO] Pedido ${orderId} concluído: R$ ${val}`);
        await wait(500);
      }

      // 2. Gera 1 login ok e 1 login falho
      state.activeUsers += 2;
      authSector.push('active_users', state.activeUsers, { type: 'NUMBER', unit: 'users' });
      authSector.log('[SIMULAÇÃO] Usuário maria_silva logado com sucesso');
      recordLocalLog('auth', '[SIMULAÇÃO] Usuário maria_silva logado com sucesso');
      await wait(500);

      state.failedLogins++;
      authSector.push('failed_logins', state.failedLogins, { type: 'NUMBER', unit: 'fails' });
      authSector.log('[SIMULAÇÃO] Falha de login suspeita: tentativa com usuário admin');
      recordLocalLog('auth', '[SIMULAÇÃO] Falha de login suspeita');
      await wait(500);

      // 3. Gera 1 aviso de log de erro
      state.errorsCount++;
      errorsSector.count('error_count', state.errorsCount, 'erros');
      errorsSector.log('[SIMULAÇÃO] Timeout de 2000ms atingido na API de frete dos Correios', 'TimeoutError: Connection timed out after 2000ms\n    at HttpClient.request (/app/client.js:32)', 'logs');
      recordLocalLog('errors', '[SIMULAÇÃO] Timeout na API de frete');
      await wait(500);

      // 4. Log geral na instância
      msm.log('[SIMULAÇÃO] Lote de eventos de teste processado com sucesso');
      recordLocalLog('root', '[SIMULAÇÃO] Lote de eventos de teste processado');
      console.log('[MSM API Demo] ✓ Simulação concluída com sucesso!');
    })().catch(err => {
      console.error('[MSM API Demo] Erro na simulação assíncrona:', err);
    });

    return;
  }

  // ROTA 7: Histórico de Logs locais
  if (pathname === '/api/logs' && method === 'GET') {
    return res.end(JSON.stringify({
      total: state.lastLogs.length,
      logs: state.lastLogs
    }, null, 2));
  }

  // ROTA 8: Health check
  if (pathname === '/health') {
    const isPingOk = await msm.ping();
    return res.end(JSON.stringify({
      status: 'UP',
      uptime_seconds: Math.floor((Date.now() - state.startTime) / 1000),
      msm_connected: isPingOk,
      msm_socket_path: msm.socketPath,
      msm_buffer_count: msm.getBufferedCount()
    }));
  }

  // ROTA 404
  res.statusCode = 404;
  res.end(JSON.stringify({
    error: 'Rota não encontrada',
    hint: 'Acesse GET / para ver a lista de rotas de teste disponíveis.'
  }));
});

// 5. Inicia o servidor HTTP e a conexão com o MSM
server.listen(PORT, async () => {
  console.log(`\n======================================================`);
  console.log(`  🚀 API de Teste MSM Node.js rodando em: http://localhost:${PORT}`);
  console.log(`======================================================`);
  console.log(`Rotas rápidas para testar:`);
  console.log(`  👉 Painel geral:         curl http://localhost:${PORT}/`);
  console.log(`  👉 Simular tráfego/logs: curl http://localhost:${PORT}/api/simulate`);
  console.log(`  👉 Criar pedido:         curl -X POST http://localhost:${PORT}/api/orders`);
  console.log(`  👉 Simular erro:         curl -X POST http://localhost:${PORT}/api/errors`);
  console.log(`  👉 Ver logs emitidos:    curl http://localhost:${PORT}/api/logs`);
  console.log(`======================================================\n`);

  await setupMsm();
});
