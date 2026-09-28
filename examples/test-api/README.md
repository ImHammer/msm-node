# MSM Node.js SDK - API Demo de Testes

Esta é uma API em Node.js projetada especialmente para testar a comunicação completa com o **MSM Agent** via Unix Domain Socket, demonstrando:

1. **Autenticação com Token do SDK** (`AUTH`)
2. **Registro de Catálogo e Mapeamento de Setores** (`REGISTER_INSTANCE`)
3. **Métricas Diretas da Instância** (`status`, `uptime`, `requests_total`)
4. **Setores Modulares** (`auth`, `orders`, `errors`)
5. **Logs de Transação, Acesso e Falhas** (`LOG_LINE` com `details` JSON/Stack trace)
6. **Resiliência e Buffer Offline** (caso o Agent seja parado/reiniciado)

---

## 🚀 Como Executar

### 1. Iniciar o MSM Agent
Em um terminal (na raiz do repositório):
```bash
./gradlew run
# ou em produção na VPS:
# sudo systemctl start msm
```

### 2. Iniciar a API Demo
Em outro terminal:
```bash
cd packages/msm-node
npm run api
```
*(Ou direto da raiz: `node packages/msm-node/examples/test-api/server.js`)*

A API iniciará por padrão em `http://localhost:3333`.

---

## 📡 Endpoints de Teste

### 1. Visão Geral e Painel de Status
```bash
curl http://localhost:3333/
```
Retorna os contadores atuais da API e os eventos acumulados no buffer do SDK.

---

### 2. Disparar Simulação em Lote (Tráfego Automático)
Gera automaticamente 3 pedidos fictícios, 2 eventos de login e 1 log de erro:
```bash
curl http://localhost:3333/api/simulate
```
*Abra o console do MSM Agent e digite `instances` ou `instance node-ecommerce-api` para ver os dados atualizados instantaneamente!*

---

### 3. Criar Pedido (Testa Métricas de Negócio e Logs de Venda)
```bash
curl -X POST http://localhost:3333/api/orders \
  -H "Content-Type: application/json" \
  -d '{"amount": 149.90, "customer": "Carlos Eduardo"}'
```
- Incrementa `total_orders`
- Incrementa `revenue` em R$ (BRL)
- Emite um log no setor `orders` com os detalhes da transação.

---

### 4. Simular Login (Testa Métricas de Segurança e Logs de Acesso)
**Login com Sucesso:**
```bash
curl -X POST http://localhost:3333/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "joao_dev", "success": true}'
```

**Falha de Login (Gera alerta no setor `auth`):**
```bash
curl -X POST http://localhost:3333/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "hacker_tentativa", "success": false}'
```

---

### 5. Simular Erro de Aplicação (Testa Stack Traces e Alertas de Status)
```bash
curl -X POST http://localhost:3333/api/errors \
  -H "Content-Type: application/json" \
  -d '{"message": "Falha de conexão com Redis Sentinel", "level": "CRITICAL"}'
```
- Incrementa `error_count`
- Altera o status do setor `errors` para `WARNING` ou `CRITICAL`
- Envia o stack trace completo no campo `details` do log.

---

### 6. Enviar Log Customizado Arbitrário
Permite testar qualquer mensagem de log em qualquer setor ou direto na instância:
```bash
curl -X POST http://localhost:3333/api/logs \
  -H "Content-Type: application/json" \
  -d '{
    "sector": "orders",
    "message": "Gateway de Pagamento acionado para estorno",
    "details": "Chargeback solicitado pelo cliente #4012"
  }'
```

---

### 7. Consultar os Últimos Logs Emitidos Localmente
```bash
curl http://localhost:3333/api/logs
```

---

### 8. Health Check
```bash
curl http://localhost:3333/health
```
Testa o `msm.ping()` via socket e exibe a quantidade de itens no buffer de reconexão.
