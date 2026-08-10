import request from 'supertest';
import { createApp } from '../../src/main/server';
import { firewallRepository } from '../../src/adapters/out/memory.db';
import { FIREWALL_RULES_PATH } from '../../src/adapters/in/routes';
import { validAddIpPayload } from '../fixtures/firewall.fixture';

describe('Firewall API integration', () => {
  const app = createApp();

  beforeEach(() => {
    firewallRepository.reset();
  });

  it(`POST ${FIREWALL_RULES_PATH} stores data through use case into memory repository`, async () => {
    const response = await request(app)
      .post(FIREWALL_RULES_PATH)
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

  it(`POST ${FIREWALL_RULES_PATH} returns 400 for invalid payload`, async () => {
    await request(app)
      .post(FIREWALL_RULES_PATH)
      .send({ type: 'port', mode: 'whitelist', values: [0] })
      .expect(400);

    expect(firewallRepository.getAll()).toHaveLength(0);
  });

  it(`POST ${FIREWALL_RULES_PATH} returns a JSON error for malformed bodies`, async () => {
    const response = await request(app)
      .post(FIREWALL_RULES_PATH)
      .set('Content-Type', 'application/json')
      .send('{"type":"ip"')
      .expect(400);

    expect(response.body).toEqual({
      status: 'error',
      code: 'INVALID_JSON_PAYLOAD',
      message: 'Malformed JSON request body.',
    });
    expect(firewallRepository.getAll()).toHaveLength(0);
  });
});
