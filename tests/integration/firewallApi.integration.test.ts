import request from 'supertest';
import { createApp } from '../../src/main/server';
import { firewallRepository } from '../../src/adapters/memory.db';
import { validAddIpPayload } from '../fixtures/firewall.fixture';

describe('Firewall API integration', () => {
  const app = createApp();

  beforeEach(() => {
    firewallRepository.reset();
  });

  it('POST /api/v1/firewall/rules stores data through use case into memory repository', async () => {
    const response = await request(app)
      .post('/api/v1/firewall/rules')
      .send(validAddIpPayload)
      .expect(201);

    expect(response.body.status).toBe('success');
    expect(response.body.type).toBe('ip');
    expect(response.body.mode).toBe('blacklist');
    expect(response.body.values).toHaveLength(2);

    const savedRules = firewallRepository.getAll();
    expect(savedRules).toHaveLength(2);
    expect(savedRules[0]).toMatchObject({
      id: 1,
      type: 'ip',
      mode: 'blacklist',
      value: '192.168.1.10',
      active: true,
    });
  });

  it('POST /api/v1/firewall/rules returns 400 for invalid payload', async () => {
    await request(app)
      .post('/api/v1/firewall/rules')
      .send({ type: 'port', mode: 'whitelist', values: [0] })
      .expect(400);

    expect(firewallRepository.getAll()).toHaveLength(0);
  });
});
