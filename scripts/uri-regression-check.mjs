import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const routerRequire = createRequire(require.resolve('expo-router/package.json'));
const queryPath = routerRequire.resolve('query-string');
const query = routerRequire('query-string');
const decodePath = createRequire(queryPath).resolve('decode-uri-component');
const decode = require(decodePath);
for (const [input, expected] of [
  ['hello+world', 'hello world'], ['a%2Bb', 'a+b'],
  ['%E6%97%A5%E6%9C%AC', '日本'], ['%F0%9F%98%80', '😀'],
  ['%E6%97%A5%FF%E6%9C%AC', '日%FF本'], ['%C2%B5%C2', 'µ�'],
  ['%FE%FF', '��'], ['%ED%A0%80', '%ED%A0%80'], ['%G0%', '%G0%'],
]) assert.equal(decode(input), expected);
assert.throws(() => decode(null), TypeError);
assert.equal(query.parse('code=abc%2B123&name=%E6%97%A5%E6%9C%AC').name, '日本');
assert.equal(query.parse('code=abc%2B123').code, 'abc+123');
const adversarial = spawnSync(process.execPath, ['-e', `
  const assert = require('node:assert/strict');
  const decode = require(${JSON.stringify(decodePath)});
  const input = '%FF'.repeat(20000);
  assert.equal(decode(input), input);
  assert.equal(decode('%41%FF'.repeat(10000)), 'A%FF'.repeat(10000));
`], { timeout: 5000, encoding: 'utf8' });
assert.equal(adversarial.status, 0, adversarial.error?.message || adversarial.stderr);
console.log('URI decoding regression checks passed (CommonJS, deep links, malformed input).');
