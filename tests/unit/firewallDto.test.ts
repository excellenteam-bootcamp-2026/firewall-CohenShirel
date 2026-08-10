import { toAddRulesInput } from '../../src/adapters/in/dto/firewall.dto';

describe('firewall HTTP DTO mapper', () => {
  it('maps known fields from object body', () => {
    const input = toAddRulesInput({
      type: 'ip',
      mode: 'blacklist',
      values: ['10.0.0.1'],
      ignored: true,
    });

    expect(input).toEqual({
      type: 'ip',
      mode: 'blacklist',
      values: ['10.0.0.1'],
    });
  });

  it('returns undefined fields for non-object body', () => {
    const input = toAddRulesInput('invalid-body');

    expect(input).toEqual({
      type: undefined,
      mode: undefined,
      values: undefined,
    });
  });
});
