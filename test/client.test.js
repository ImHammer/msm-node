const { describe, it } = require('node:test');
const assert = require('node:assert');
const { MsmClient } = require('../dist/index');

describe('MsmClient Unit Tests', () => {
  it('deve instanciar o cliente corretamente com configurações padrão', () => {
    const client = new MsmClient({
      instanceId: 'test-service',
      instanceName: 'Test Service',
      token: 'msm_sdk_test_token'
    });

    assert.strictEqual(client.instanceId, 'test-service');
    assert.strictEqual(client.instanceName, 'Test Service');
    assert.strictEqual(client.token, 'msm_sdk_test_token');
    assert.ok(client.socketPath.includes('events.sock'));
  });

  it('deve lançar erro se instanceId não for fornecido', () => {
    assert.throws(() => {
      new MsmClient({});
    }, /instanceId/);
  });

  it('deve enfileirar eventos no buffer offline quando desconectado', () => {
    const client = new MsmClient({
      instanceId: 'offline-service',
      autoReconnect: false
    });

    // Envia dado direto
    client.pushDirect('cpu', 45, { valueType: 'PERCENTAGE' });

    // Envia dado via setor
    const sector = client.sector('orders');
    sector.count('total', 15);
    sector.currency('revenue', 250.0, 'BRL');
    sector.log('Pedido criado');

    // Verifica que o buffer tem 4 itens enfileirados
    assert.strictEqual(client.getBufferedCount ? client.getBufferedCount() : client['buffer'].length, 4);
  });

  it('deve criar helpers de setor com fluência correta', () => {
    const client = new MsmClient({
      instanceId: 'billing-app'
    });

    const tx = client.sector('tx', { name: 'Transações', category: 'BUSINESS' });
    assert.strictEqual(tx.id, 'tx');
    assert.strictEqual(tx.name, 'Transações');
    assert.strictEqual(tx.category, 'BUSINESS');
  });

  it('deve suportar o padrão Singleton global (init, getClient, sector)', () => {
    const { init, getClient, sector, log } = require('../dist/index');

    const instance = init({
      instanceId: 'singleton-app',
      instanceName: 'Singleton App',
      autoReconnect: false
    });

    assert.strictEqual(getClient(), instance);

    const sec = sector('orders');
    assert.strictEqual(sec.id, 'orders');

    log('Log do singleton');
    assert.strictEqual(instance.getBufferedCount(), 1);
  });
});
