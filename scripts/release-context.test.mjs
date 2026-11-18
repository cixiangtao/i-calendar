import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { releaseMetadata } from './release-context.mjs';

const config = JSON.parse(await readFile(new URL('../release/config.json', import.meta.url)));

test('发布入口只接受正式版本及匹配的仓库和标签', () => {
  const actual = releaseMetadata('1.0.0', 'v1.0.0', config.repository, config);
  assert.equal(actual.version, '1.0.0');
  assert.equal(actual.endpoint, config.updateEndpoint);
  for (const [version, tag, repository] of [
    ['0.1.0', 'v0.1.0', config.repository],
    ['1.0.0-rc.1', 'v1.0.0-rc.1', config.repository],
    ['1.01.0', 'v1.01.0', config.repository],
    ['1.0.01', 'v1.0.01', config.repository],
    ['1.0.0+build', 'v1.0.0+build', config.repository],
    ['1.0.0', 'main', config.repository],
    ['1.0.0', 'v1.0.1', config.repository],
    ['1.0.0', 'v1.0.0', 'someone/another-repo'],
  ])
    assert.throws(() => releaseMetadata(version, tag, repository, config));
});

test('发布上下文拒绝缺失公钥和不安全更新地址', () => {
  assert.throws(() =>
    releaseMetadata('1.0.0', 'v1.0.0', config.repository, { ...config, publicKey: '' }),
  );
  assert.throws(() =>
    releaseMetadata('1.0.0', 'v1.0.0', config.repository, {
      ...config,
      updateEndpoint: 'http://example.com/latest.json',
    }),
  );
});
