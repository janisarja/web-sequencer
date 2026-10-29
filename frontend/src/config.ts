const requireEnv = (name: keyof ImportMetaEnv): string => {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Missing required frontend environment variable: ${name}`);
  }
  return value;
};

const apiUrl = requireEnv('VITE_API_URL');
const websocketUrl = requireEnv('VITE_WEBSOCKET_URL');

export const config = {
  stateUrl: `${apiUrl.replace(/\/$/, '')}/state`,
  websocketUrl,
};
