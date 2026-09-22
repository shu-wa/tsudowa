import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

// Resolve through Expo, not by importing whichever file we assume it uses.
// A fresh child process avoids config-module caching across environments.
const check = function () {
  const assert = require('node:assert/strict');
  const { getConfig } = require('expo/config');
  const { basename } = require('node:path');
  const { exp, dynamicConfigPath } = getConfig(process.cwd());
  const configured = process.env.TSUDOWA_CONFIG_TEST === 'configured';
  assert.equal(basename(dynamicConfigPath), 'app.config.ts');
  assert.equal(exp.android.package, 'com.shuwa.tsudowa');
  assert.equal(exp.ios.bundleIdentifier, 'com.shuwa.tsudowa');
  assert.equal(exp.android.googleServicesFile, configured ? 'C:/test-fixture/google-services.json' : undefined);
  assert.equal(exp.android.config?.googleMaps?.apiKey, configured ? 'test-only-not-a-real-key' : undefined);
};

for (const configured of [true, false]) {
  const env = { ...process.env, TSUDOWA_CONFIG_TEST: configured ? 'configured' : 'empty' };
  delete env.GOOGLE_SERVICES_JSON;
  delete env.GOOGLE_MAPS_API_KEY;
  if (configured) {
    env.GOOGLE_SERVICES_JSON = '  C:/test-fixture/google-services.json  ';
    env.GOOGLE_MAPS_API_KEY = '  test-only-not-a-real-key  ';
  }
  const result = spawnSync(process.execPath, ['-e', '(' + check.toString() + ')()'], {
    cwd: root, env, encoding: 'utf8', timeout: 30_000,
  });
  assert.equal(result.status, 0, result.error?.message || result.stderr || 'Expo config check failed');
}

console.log('Build config regression checks passed (with and without EAS variables).');
