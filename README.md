# MSM Node.js SDK (`msm-node`)

SDK oficial em Node.js / TypeScript para integração de projetos e microsserviços com o **MSM Agent** (Micro Server Monitor).

Comunique métricas, contadores, valores financeiros e logs do seu projeto para o MSM Agent via **Unix Domain Socket** de alta performance, com **autenticação por Token**, **reconexão automática** e **bufferização offline**.

---

## 🚀 Instalação

```bash
npm install msm-node
```
*(ou instale localmente no seu monorepo via `npm install ./packages/msm-node`)*.

---

## 🔑 Autenticação

Para proteger o Agent contra acessos não autorizados de outros processos na VPS, a conexão exige um **Token de Acesso do SDK**.

Você encontra o token do seu Agent executando o comando no console do Agent:
```bash
msm@vps > token
Token de Acesso do SDK: msm_sdk_91b72a...
```
Ou no comando `info`:
```bash
msm@vps > info
```

Configure este token no seu arquivo `.env`:
```env
MSM_TOKEN=msm_sdk_91b72a...
```

---

## ⚡ Início Rápido

```typescript
import { MsmClient } from 'msm-node';

async function bootstrap() {
  const msm = new MsmClient({
    instanceId: 'payment-gateway',
    instanceName: 'Gateway de Pagamentos',
    token: process.env.MSM_TOKEN
  });

  await msm.connect();
  console.log('Conectado ao MSM Agent!');

  // 1. Enviar métricas DIRETAS para a instância (Sem setor)
  msm.pushDirect('status', 'ONLINE', { type: 'STATUS' });
  msm.pushDirect('uptime', '24h', { type: 'TEXT' });

  // 2. Enviar métricas organizadas por SETORES (Módulos do Projeto)
  const auth = msm.sector('auth', 'Autenticação');
  auth.count('logins', 120, 'req/min');
  auth.log('Falha de login para o usuário admin');

  const payments = msm.sector('transactions', 'Transações');
  payments.currency('faturamento', 18450.00, 'BRL');
  payments.log('Transação #1092 aprovada com sucesso via PIX');
}

bootstrap();
```

---

## 🔄 Como Usar em Múltiplos Arquivos (Evitando Duplicação)

Se o seu projeto possui vários controllers, services ou rotas, **você não deve instanciar `new MsmClient` em cada arquivo**, pois isso criaria múltiplas conexões de socket desnecessárias. O Node.js oferece duas formas elegantes para compartilhar a mesma instância:

### Opção 1: Singleton Global Nativo do SDK (`init`, `sector`, `log`) — **Mais Prático**

1. No ponto de entrada da sua aplicação (`server.ts` ou `app.js`), inicialize o MSM uma única vez:
```typescript
import { init } from 'msm-node';

init({
  instanceId: 'ecommerce-api',
  instanceName: 'API E-Commerce',
  token: process.env.MSM_TOKEN
});
```

2. Em qualquer controller, service ou middleware (`src/services/order.service.ts`):
```typescript
import { sector, log } from 'msm-node';

export function processOrder(order) {
  // Acessa o setor diretamente sem abrir novas conexões
  sector('orders').currency('revenue', order.amount, 'BRL');
  sector('orders').log(`Pedido #${order.id} aprovado via PIX`);
}
```

---

### Opção 2: Módulo Compartilhado (`src/lib/msm.ts`)

Como o Node.js faz cache de módulos carregados (`require.cache`), exportar uma única instância garante que todos os arquivos recebam o mesmo objeto e a mesma conexão:

```typescript
// src/lib/msm.ts
import { MsmClient } from 'msm-node';

export const msm = new MsmClient({
  instanceId: 'ecommerce-api',
  token: process.env.MSM_TOKEN
});

// Inicia conexão
msm.connect().catch(console.error);

// Opcional: exportar setores já configurados
export const ordersSector = msm.sector('orders', 'Vendas');
export const authSector = msm.sector('auth', 'Autenticação');
```

E importar onde precisar:
```typescript
// src/controllers/auth.controller.ts
import { authSector } from '../lib/msm';

export function onLoginSuccess(user) {
  authSector.log(`Usuário ${user.email} autenticado com sucesso`);
}
```

---

## 📊 Dois Modos de Monitoramento Suportados

O MSM foi projetado com máxima flexibilidade:

### 1. Modo Direto na Instância (Sem Setores)
Ideal para scripts, workers ou microsserviços simples onde você só quer enviar dados rápidos:
```typescript
msm.pushDirect('status', 'ONLINE', { type: 'STATUS' });
msm.pushDirect('cpu', 4.5, { type: 'PERCENTAGE' });
msm.pushDirect('emails_enviados', 1520, { type: 'NUMBER' });
```

### 2. Modo com Setores (Projetos Modulares)
Ideal para projetos com múltiplos módulos funcionais para manter as métricas organizadas no aplicativo mobile:
```typescript
// Setor de Vendas
const sales = msm.sector('vendas');
sales.count('pedidos', 45);
sales.currency('faturamento', 5290.00, 'BRL');

// Setor de Notificações
const notifs = msm.sector('notificacoes');
notifs.count('push_enviados', 340);
notifs.log('Falha temporária ao conectar com Firebase FCM');
```

---

## 🎨 Tipos de Valores (`ValueType`)

O SDK permite especificar o tipo do dado para que os aplicativos monitores (Android / iOS / Web) renderizem o widget correto na tela:

| `ValueType` | Formato | Como é exibido no App |
|---|---|---|
| `PERCENTAGE` | `number` (0 a 100) | Barra de progresso ou medidor circular |
| `CURRENCY` | `number` ou `string` | Card financeiro com formatação de moeda (R$) |
| `BYTES` | `number` (bytes) | Formatador automático (KB, MB, GB) |
| `STATUS` | `string` (`ONLINE`, etc.) | Badge / etiqueta colorida |
| `NUMBER` | `number` | Contador numérico em destaque |
| `LOG_LINE` | `string` | Terminal monoespaçado |
| `BOOLEAN` | `boolean` | Switch ou LED indicador |
| `TEXT` | `string` | Rótulo de texto livre |

---

## 🌐 Integração com Frameworks (Express / Fastify / NestJS)

### Exemplo com Express:
```typescript
import express from 'express';
import { MsmClient } from 'msm-node';

const app = express();
const msm = new MsmClient({
  instanceId: 'api-express',
  instanceName: 'API Principal',
  token: process.env.MSM_TOKEN
});

// Conecta em segundo plano
msm.connect().catch(console.error);

// Setores do projeto
const httpSector = msm.sector('http', 'Tráfego HTTP');
const errorSector = msm.sector('errors', 'Falhas e Erros');

let reqCount = 0;

// Middleware de métricas
app.use((req, res, next) => {
  reqCount++;
  httpSector.count('total_requests', reqCount);
  next();
});

// Middleware de erros
app.use((err, req, res, next) => {
  errorSector.log(`Erro na rota ${req.path}: ${err.message}`, err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(3000, () => {
  msm.pushDirect('status', 'ONLINE', { type: 'STATUS' });
  console.log('App rodando na porta 3000');
});
```

---

## 🛡️ Resiliência e Buffer Offline

- **Reconexão Automática**: Se o MSM Agent for reiniciado ou estiver atualizando na VPS, o SDK tentará reconectar automaticamente com backoff exponencial.
- **Buffer Offline**: Enquanto a conexão com o socket estiver indisponível, as métricas enviadas são mantidas em um buffer na memória (máx 1.000 itens) e enviadas automaticamente assim que o Agent voltar ao ar, sem travar sua aplicação.

---

## 📜 Licença

MIT © Hammer
