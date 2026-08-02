import {
  isValidDomain,
  isValidIPv4,
  isValidPort,
  isValidValueForType,
  validateAddRulesInput,
} from '../../src/domain/firewall/FirewallValidators';

describe('FirewallValidators (unit)', () => {
  describe('isValidIPv4', () => {
    it('returns true for valid IPv4 values', () => {
      expect(isValidIPv4('192.168.0.1')).toBe(true);
      expect(isValidIPv4('8.8.8.8')).toBe(true);
    });

    it('returns false for invalid IPv4 values', () => {
      expect(isValidIPv4('999.1.1.1')).toBe(false);
      expect(isValidIPv4('abc.def.ghi.jkl')).toBe(false);
      expect(isValidIPv4(1234)).toBe(false);
    });
  });

  describe('isValidPort', () => {
    it('accepts integer ports in range 1..65535', () => {
      expect(isValidPort(1)).toBe(true);
      expect(isValidPort(443)).toBe(true);
      expect(isValidPort(65535)).toBe(true);
    });

    it('rejects invalid port values', () => {
      expect(isValidPort(0)).toBe(false);
      expect(isValidPort(65536)).toBe(false);
      expect(isValidPort(3.14)).toBe(false);
      expect(isValidPort('443')).toBe(false);
    });
  });

  describe('isValidDomain', () => {
    it('accepts host-like domain values', () => {
      expect(isValidDomain('example.com')).toBe(true);
      expect(isValidDomain('api.example.co')).toBe(true);
      expect(isValidDomain('foo-bar.example.com')).toBe(true);
    });

    it('rejects domains with protocol, path, or port', () => {
      expect(isValidDomain('https://example.com')).toBe(false);
      expect(isValidDomain('example.com/path')).toBe(false);
      expect(isValidDomain('example.com:443')).toBe(false);
    });

    it('rejects malformed domain labels', () => {
      expect(isValidDomain('.example.com')).toBe(false);
      expect(isValidDomain('example..com')).toBe(false);
      expect(isValidDomain('-foo.example')).toBe(false);
      expect(isValidDomain('foo-.example')).toBe(false);
      expect(isValidDomain('exa_mple.com')).toBe(false);
      expect(isValidDomain('example.c0m')).toBe(false);
    });
  });

  describe('isValidValueForType', () => {
    it('dispatches to the correct validator by type', () => {
      expect(isValidValueForType('ip', '10.0.0.1')).toBe(true);
      expect(isValidValueForType('domain', 'example.com')).toBe(true);
      expect(isValidValueForType('port', 443)).toBe(true);

      expect(isValidValueForType('ip', 'example.com')).toBe(false);
      expect(isValidValueForType('domain', 'http://example.com')).toBe(false);
      expect(isValidValueForType('port', 70000)).toBe(false);
    });
  });

  describe('validateAddRulesInput', () => {
    it('returns success for a valid payload', () => {
      const result = validateAddRulesInput({
        type: 'ip',
        mode: 'blacklist',
        values: ['10.0.0.1'],
      });

      expect(result).toEqual({ ok: true });
    });

    it('returns INVALID_PORT for invalid port payload', () => {
      const result = validateAddRulesInput({
        type: 'port',
        mode: 'whitelist',
        values: [80, 70000],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_PORT');
      }
    });

    it('returns INVALID_DOMAIN for invalid domain payload', () => {
      const result = validateAddRulesInput({
        type: 'domain',
        mode: 'whitelist',
        values: ['https://example.com'],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_DOMAIN');
      }
    });

    it('returns INVALID_DOMAIN for malformed domain labels', () => {
      const result = validateAddRulesInput({
        type: 'domain',
        mode: 'whitelist',
        values: ['example..com'],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_DOMAIN');
      }
    });

    it('returns INVALID_IP for invalid ip payload', () => {
      const result = validateAddRulesInput({
        type: 'ip',
        mode: 'blacklist',
        values: ['999.1.1.1'],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_IP');
      }
    });
  });
});
