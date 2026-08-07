const SAFE_SECURE_STORE_KEY = /^[A-Za-z0-9._-]+$/;

export const toSecureStoreKey = (logicalKey: string) => {
  if (SAFE_SECURE_STORE_KEY.test(logicalKey)) return logicalKey;

  const bytes = new TextEncoder().encode(logicalKey);
  const encoded = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `tsudowa.${encoded}`;
};
