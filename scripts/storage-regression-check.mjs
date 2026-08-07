import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const helperSource = readFileSync(new URL('../lib/secure-storage-key.ts', import.meta.url), 'utf8');
const helperJs = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { toSecureStoreKey } = await import(`data:text/javascript;base64,${Buffer.from(helperJs).toString('base64')}`);

const logicalAppKey = '@tsudowa/app-data-v2/12345678-1234-1234-1234-123456789abc';
const encodedAppKey = toSecureStoreKey(logicalAppKey);
assert.match(encodedAppKey, /^[A-Za-z0-9._-]+$/, 'every native SecureStore key must use only supported characters');
assert.notEqual(encodedAppKey, logicalAppKey, 'unsafe app data keys must be encoded');
assert.equal(toSecureStoreKey(logicalAppKey), encodedAppKey, 'key encoding must be deterministic across launches');
assert.match(toSecureStoreKey('日本語/@'), /^[A-Za-z0-9._-]+$/, 'Unicode logical keys must also encode safely');

const supabaseKey = 'sb-jwgynxnkjjyoqiirqwus-auth-token';
assert.equal(toSecureStoreKey(supabaseKey), supabaseKey, 'existing valid Supabase keys must not move or sign the user out');

const storageSource = readFileSync(new URL('../lib/auth-storage.ts', import.meta.url), 'utf8');
assert.match(storageSource, /manifestKey = \(key: string\) => `\$\{toSecureStoreKey\(key\)\}\.manifest`/, 'manifest keys must be normalized');
assert.match(storageSource, /chunkKey = \(key: string, generation: string, index: number\) => `\$\{toSecureStoreKey\(key\)\}/, 'chunk keys must be normalized');
assert.match(storageSource, /AsyncStorage\.getItem\(key\)/, 'the original logical key must remain available for plaintext migration');

console.log('Secure storage regression checks passed.');
