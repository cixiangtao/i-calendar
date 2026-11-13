import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { httpsAddress, signedPlatform, updateConfiguration } from './update-release.mjs';

test('更新配置必须成对，拒绝私钥、文件路径和无效公钥', () => {
  const publicKey = Buffer.from(
    'untrusted comment: minisign public key: A49EF4746FA6E6D7\nRWTX5qZvdPSepDGWg2bz8n6ArQnBMwgQK1geVosorcbLzcunD+KJ+cYe',
  ).toString('base64');
  assert.equal(updateConfiguration({}), null);
  assert.equal(
    updateConfiguration({
      I_CALENDAR_UPDATE_ENDPOINT: 'https://example.com/latest.json',
      I_CALENDAR_UPDATE_PUBKEY: publicKey,
    }).publicKey,
    publicKey,
  );
  assert.throws(() => updateConfiguration({ I_CALENDAR_UPDATE_ENDPOINT: 'https://example.com' }));
  for (const key of ['/tmp/key.pub', 'invalid', 'untrusted comment: secret key'])
    assert.throws(() =>
      updateConfiguration({
        I_CALENDAR_UPDATE_ENDPOINT: 'https://example.com/latest.json',
        I_CALENDAR_UPDATE_PUBKEY: key,
      }),
    );
});

test('更新清单与包地址必须是无凭据无片段的 HTTPS 地址', () => {
  assert.equal(httpsAddress('https://example.com/latest.json'), 'https://example.com/latest.json');
  for (const url of [
    'http://example.com/update',
    'file:///tmp/update',
    'https://user:password@example.com/update',
    'https://example.com/update#fragment',
  ])
    assert.throws(() => httpsAddress(url));
});

test('签名产物必须为官方更新包且有非空签名', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'i-calendar-update-test-'));
  try {
    const archive = path.join(directory, 'update.app.tar.gz');
    await assert.rejects(signedPlatform(archive, 'https://example.com/update'));
    await writeFile(`${archive}.sig`, ' ');
    await assert.rejects(signedPlatform(archive, 'https://example.com/update'));
    await writeFile(`${archive}.sig`, 'signature');
    assert.equal(
      (await signedPlatform(archive, 'https://example.com/update')).signature,
      'signature',
    );
    await assert.rejects(signedPlatform('update.zip', 'https://example.com/update'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
