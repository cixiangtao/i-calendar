import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { preparePublication, selectRelease } from './github-release.mjs';

test('Release 查询保留同标签草稿，其他版本的已发布记录不影响选择', () => {
  const draft = { id: 1, tag_name: 'v1.0.0', draft: true };
  const published = { id: 2, tag_name: 'v0.9.0', draft: false };
  assert.equal(selectRelease([published, draft], 'v1.0.0'), draft);
  assert.equal(selectRelease([published], 'v1.0.0'), null);
  assert.equal(selectRelease([{ ...draft, draft: false }], 'v1.0.0').draft, false);
  assert.throws(() => selectRelease([draft, { ...draft, id: 3 }], 'v1.0.0'));
});

test('公开附件使用 ASCII 名称，签名载荷保持原字节，清单和校验值同步', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'i-calendar-assets-'));
  try {
    for (const suffix of ['zip', 'app.tar.gz', 'app.tar.gz.sig'])
      await writeFile(path.join(folder, `i日历-1.0.0-mac-arm64.${suffix}`), `original-${suffix}`);
    const original = {
      version: '1.0.0',
      notes: '版本说明',
      platforms: { 'darwin-aarch64': { url: 'https://example.com/旧包', signature: '原签名' } },
    };
    await writeFile(path.join(folder, 'latest.json'), JSON.stringify(original));
    await writeFile(path.join(folder, 'SHA256SUMS.txt'), 'old checksums');
    const files = await preparePublication(folder, '1.0.0', 'cixiangtao/i-calendar');
    assert.equal(files.length, 5);
    for (const suffix of ['zip', 'app.tar.gz', 'app.tar.gz.sig'])
      assert.equal(
        await readFile(
          path.join(folder, 'publication', `i-calendar-1.0.0-mac-arm64.${suffix}`),
          'utf8',
        ),
        `original-${suffix}`,
      );
    const published = JSON.parse(await readFile(path.join(folder, 'publication/latest.json')));
    assert.equal(published.platforms['darwin-aarch64'].signature, '原签名');
    assert.equal(
      published.platforms['darwin-aarch64'].url,
      'https://github.com/cixiangtao/i-calendar/releases/download/v1.0.0/i-calendar-1.0.0-mac-arm64.app.tar.gz',
    );
    assert.equal(
      JSON.parse(await readFile(path.join(folder, 'latest.json'))).platforms['darwin-aarch64'].url,
      original.platforms['darwin-aarch64'].url,
    );
    for (const line of (await readFile(path.join(folder, 'publication/SHA256SUMS.txt'), 'utf8'))
      .trim()
      .split('\n')) {
      const [hash, name] = line.split('  ');
      assert.equal(
        createHash('sha256')
          .update(await readFile(path.join(folder, 'publication', name)))
          .digest('hex'),
        hash,
      );
    }
    await writeFile(
      path.join(folder, 'latest.json'),
      JSON.stringify({ ...original, version: '2.0.0' }),
    );
    await assert.rejects(
      preparePublication(folder, '1.0.0', 'cixiangtao/i-calendar'),
      /清单版本不一致/,
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
