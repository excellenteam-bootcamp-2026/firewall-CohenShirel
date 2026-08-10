export const validAddIpPayload = {
  type: 'ip',
  mode: 'blacklist',
  values: ['192.168.1.10', '8.8.8.8'],
};

export const invalidPortPayload = {
  type: 'port',
  mode: 'whitelist',
  values: [0, 70000, 3.14],
};
