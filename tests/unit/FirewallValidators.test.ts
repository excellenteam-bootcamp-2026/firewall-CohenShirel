import {
  isValidIPv4,
  isValidPort,
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
  });
});
