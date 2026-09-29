# MSM Node.js SDK (`@imhammer/msm-node`)

[![npm version](https://img.shields.io/npm/v/@imhammer/msm-node.svg)](https://www.npmjs.com/package/@imhammer/msm-node)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MSM Agent](https://img.shields.io/badge/MSM-Agent-green.svg)](https://github.com/imhammer/msm)

SDK oficial em Node.js / TypeScript para integrar suas aplicações e microsserviços ao **[MSM Agent (Micro Server Monitor)](https://github.com/imhammer/msm)**.

Comunique métricas de negócios, contadores, dados financeiros, status e logs do seu projeto Node.js diretamente para o **MSM Agent** via **Unix Domain Socket** de alta performance, visualizando tudo em tempo real no aplicativo mobile.

> 🌐 **Precisa do Agent no seu servidor?**  
> Este SDK conecta-se ao **MSM Agent** em execução na sua VPS ou servidor local. Acesse o repositório principal do Agent para instalar o serviço: **[github.com/imhammer/msm](https://github.com/imhammer/msm)**.

---

## 🚀 Instalação

Instale via NPM no seu projeto Node.js:

```bash
npm install @imhammer/msm-node
```

*(Ou com Yarn / pnpm):*
```bash
yarn add @imhammer/msm-node
# ou
pnpm add @imhammer/msm-node
```

---

## 🔑 Autenticação

O MSM Agent protege a comunicação do socket contra acessos não autorizados. Para conectar sua aplicação, você precisará do **Token do SDK**.

1. Na VPS ou máquina onde o MSM Agent está rodando, consulte seu token:
   ```bash
   msm token
   ```
   *Exemplo de saída:* `msm_sdk_b588d3c29add4b0bb112bc1ed77417bb`

2. Configure a variável no arquivo `.env` do seu projeto Node:
   ```env
   MSM_TOKEN=msm_sdk_b588d3c29add4b0bb112bc1ed77417bb
   ```

---

## ⚡ Início Rápido

### Padrão Singleton Global (Recomendado para Express, Fastify, NestJS)

Inicialize o cliente **uma única vez** no arquivo de entrada da sua aplicação (`server.js` ou `index.ts`):

```typescript
import express from 'express';
import { init, sector, pushDirect } from '@imhammer/msm-node';

const app = express();
app.use(express.json());

// 1. Inicializa o MSM no boot da aplicação
init({
  instanceId: 'ecommerce-api',           // ID único da instância
  instanceName: 'API E-Commerce Principal' // Nome amigável no app mobile
  // O token é lido automaticamente de process.env.MSM_TOKEN
});

// 2. Dispare métricas e logs em qualquer rota ou controller
app.post('/api/pedidos', (req, res) => {
  const { total, cliente } = req.body;

  // Setor de Vendas
  const vendas = sector('vendas', 'Vendas & Pedidos');
  vendas.count('pedidos_total', 1, 'pedidos');
  vendas.currency('faturamento', total, 'BRL');
  vendas.log(`Novo pedido recebido de ${cliente}`);

  res.json({ success: true });
});

app.listen(3000, () => {
  pushDirect('status', 'ONLINE', { type: 'STATUS' });
  console.log('Servidor rodando na porta 3000');
});
```

---

## 🔄 Usando com Instância Dedicada (`MsmClient`)

Se preferir instanciar manualmente o cliente:

```typescript
import { MsmClient } from '@imhammer/msm-node';

const msm = new MsmClient({
  instanceId: 'payment-gateway',
  instanceName: 'Gateway de Pagamentos',
  token: process.env.MSM_TOKEN
});

async function main() {
  await msm.connect();
  console.log('Conectado ao MSM Agent!');

  // Métricas diretas na instância
  msm.pushDirect('status', 'ONLINE', { type: 'STATUS' });

  // Métricas organizadas por setores funcionais
  const pix = msm.sector('pix', 'Pagamentos Instantâneos (PIX)');
  pix.count('transacoes', 10, 'tx/min');
  pix.currency('volume', 4500.50, 'BRL');
  pix.log('Lote de 10 transações compensado com sucesso');
}

main();
```

---

## 🎨 Tipos de Valores Suportados (`ValueType`)

O SDK permite declarar o formato do dado para que o aplicativo mobile exiba o widget correto:

| `ValueType` | Formato | Como é exibido no App Mobile |
|---|---|---|
| `PERCENTAGE` | `number` (0 a 100) | Barra de progresso / Gauge circular |
| `CURRENCY` | `number` | Card financeiro formatado (R$ 1.250,00) |
| `BYTES` | `number` (bytes) | Formatador inteligente (KB, MB, GB) |
| `STATUS` | `string` (`ONLINE`, `STOPPED`) | Badge / tag de status com cor dinâmica |
| `NUMBER` | `number` | Contador numérico com histórico |
| `LOG_LINE` | `string` | Linha no feed / console em tempo real |
| `BOOLEAN` | `boolean` | Indicador visual ligado/desligado |
| `TEXT` | `string` | Texto livre formatado |

---

## 🛡️ Alta Performance & Resiliência Offline

- **Comunicação Nativa IPC**: Conecta-se via Unix Domain Socket (`/run/msm/events.sock` no Linux ou `.msm/events.sock` em Dev local), com latência inferior a 1ms e sem carga de rede HTTP.
- **Buffer Offline Automático**: Se o MSM Agent for reiniciado na VPS (`sudo msm update` ou `systemctl restart msm`), o SDK enfileira as métricas em memória (até 1.000 eventos) e reconecta com backoff exponencial sem travar ou derrubar sua aplicação Node.js.
- **Zero Dependências Pesadas**: Utiliza módulos nativos do Node.js (`net`, `events`, `path`), garantindo instalação ultraleve.

---

## 🔗 Links Úteis

- **Repositório do MSM Agent (VPS / Daemon)**: [github.com/imhammer/msm](https://github.com/imhammer/msm)
- **Pacote no NPM**: [npmjs.com/package/@imhammer/msm-node](https://www.npmjs.com/package/@imhammer/msm-node)
- **Reportar Problemas**: [github.com/imhammer/msm-node/issues](https://github.com/imhammer/msm-node/issues)

---

## 📜 Licença

Distribuído sob a licença [MIT](LICENSE).
