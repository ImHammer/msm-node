const { MsmClient } = require('../dist/index');
const fs = require('fs');
const path = require('path');

const os = require('os');

// Tenta obter o token automaticamente em vários locais possíveis
let token = process.env.MSM_TOKEN;
if (!token) {
  const candidatePaths = [
    path.resolve(__dirname, '../../../msm-config.json'),
    path.resolve(process.cwd(), 'msm-config.json'),
    '/etc/msm/msm-config.json',
    path.join(os.homedir(), '.msm/msm-config.json')
  ];

  for (const cp of candidatePaths) {
    try {
      if (fs.existsSync(cp)) {
        const config = JSON.parse(fs.readFileSync(cp, 'utf8'));
        if (config.sdkToken) {
          token = config.sdkToken;
          console.log(`[Demo] Token obtido automaticamente de: ${cp}`);
          break;
        }
      }
    } catch (_) {}
  }
}

async function runDemo() {
  console.log('--- Iniciando Demonstração do MSM Node.js SDK (Linux VPS) ---');

  const client = new MsmClient({
    instanceId: 'ecommerce-api',
    instanceName: 'API E-Commerce (Node.js)',
    token: token,
    logger: true
  });

  try {
    console.log('[Demo] Conectando ao Agent via Unix Domain Socket...');
    await client.connect();
    console.log('[Demo] ✓ Conectado e autenticado com sucesso via AF_UNIX!');

    // 1. Testa Ping
    const pong = await client.ping();
    console.log(`[Demo] Teste de Ping: ${pong ? 'PONG recebido ✓' : 'Falhou ✗'}`);

    // 2. Registra o catálogo de setores e métricas
    console.log('[Demo] Registrando setores e métricas...');
    await client.register({
      data: [
        { id: 'status', name: 'Status Geral', type: 'STATUS', valueType: 'STATUS' },
        { id: 'uptime', name: 'Uptime', type: 'GAUGE', valueType: 'TEXT' }
      ],
      sectors: [
        {
          id: 'auth',
          name: 'Autenticação',
          category: 'BUSINESS',
          data: [
            { id: 'logins', name: 'Logins por Minuto', type: 'COUNTER', valueType: 'NUMBER', unit: 'req/min' },
            { id: 'logs', name: 'Logs de Acesso', type: 'LOG_STREAM', valueType: 'LOG_LINE' }
          ]
        },
        {
          id: 'transactions',
          name: 'Transações & Vendas',
          category: 'BUSINESS',
          data: [
            { id: 'faturamento', name: 'Faturamento', type: 'GAUGE', valueType: 'CURRENCY', unit: 'BRL' },
            { id: 'logs', name: 'Logs de Vendas', type: 'LOG_STREAM', valueType: 'LOG_LINE' }
          ]
        },
        {
          id: 'errors',
          name: 'Erros & Exceções',
          category: 'LOGS_ERRORS',
          data: [
            { id: 'error_count', name: 'Total de Erros', type: 'COUNTER', valueType: 'NUMBER', unit: 'erros' },
            { id: 'status', name: 'Estado', type: 'STATUS', valueType: 'STATUS' },
            { id: 'logs', name: 'Trilha de Erros', type: 'LOG_STREAM', valueType: 'LOG_LINE' }
          ]
        }
      ]
    });

    // 3. Envia métricas e logs DIRETOS na instância (sem setor)
    console.log('[Demo] Enviando métricas diretas...');
    client.pushDirect('status', 'ONLINE', { type: 'STATUS' });
    client.pushDirect('uptime', '24h', { type: 'TEXT' });
    client.log('Aplicação iniciada com sucesso em produção', 'PID ' + process.pid);

    // 4. Envia métricas e logs para o setor 'auth'
    console.log('[Demo] Enviando logs para setor auth...');
    const auth = client.sector('auth');
    auth.count('logins', 85, 'req/min');
    auth.log('Login efetuado com sucesso para admin@empresa.com', 'IP: 177.18.29.41');
    auth.log('Tentativa de login suspeita mitigada pelo WAF', 'Origem: 194.26.29.112 (Bloqueado)');

    // 5. Envia métricas e logs para o setor 'transactions'
    console.log('[Demo] Enviando métricas e logs de vendas...');
    const tx = client.sector('transactions');
    tx.currency('faturamento', 18450.75, 'BRL');
    tx.log('Pedido #4982 aprovado com sucesso via PIX: R$ 349.90', 'Cliente: Carlos Silva');
    tx.log('Pedido #4983 aprovado via Cartão de Crédito: R$ 1.250,00', 'Cliente: Maria Santos');

    // 6. Envia métricas e log com Stack Trace para o setor 'errors'
    console.log('[Demo] Enviando log de erro com Stack Trace...');
    const errSector = client.sector('errors');
    errSector.count('error_count', 1, 'erros');
    errSector.status('WARNING');
    errSector.log(
      '[CRITICAL] Falha de conexão com réplica do banco de dados',
      'TimeoutError: Connection timed out after 5000ms\n    at Pool.connect (/app/src/db.js:84:12)\n    at async OrderService.checkout (/app/src/services.js:32:5)'
    );

    console.log('[Demo] ✓ Todos os dados e logs foram transmitidos com sucesso ao MSM Agent!');
    console.log('[Demo] Abra o console do Agent e digite "instances" ou "instance ecommerce-api" para ver tudo em tempo real.');

    // Aguarda um momento antes de fechar
    await new Promise((r) => setTimeout(r, 1000));
    await client.close();
    console.log('[Demo] Conexão encerrada com sucesso.');
  } catch (err) {
    console.error('[Demo] ✗ Erro durante execução:', err.message);
    console.error('[Demo] Certifique-se de que o MSM Agent está em execução (./gradlew run ou systemctl start msm).');
    await client.close();
  }
}

runDemo();
