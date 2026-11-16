import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { createDraftRelease, preparePublication, selectRelease } from './github-release.mjs';

test('新草稿直接采用创建响应，中文多行说明原样传递，响应身份异常时拒绝继续', async () => {
  const metadata = {
    tag: 'v1.0.4',
    commit: 'a'.repeat(40),
    version: '1.0.4',
    notes: '# 版本说明\n\n八主色与主题包\n',
  };
  const response = { id: 42, tag_name: 'v1.0.4', draft: true, prerelease: false, assets: [] };
  const created = await createDraftRelease(async (body) => {
    assert.equal(body.tag_name, metadata.tag);
    assert.equal(body.target_commitish, metadata.commit);
    assert.equal(body.body, metadata.notes);
    assert.equal(body.draft, true);
    assert.equal(body.prerelease, false);
    assert.equal(body.generate_release_notes, false);
    return response;
  }, metadata);
  assert.equal(created, response);
  for (const invalid of [
    { ...response, id: 0 },
    { ...response, tag_name: 'v1.0.3' },
    { ...response, draft: false },
    { ...response, prerelease: true },
    { ...response, assets: null },
  ])
    await assert.rejects(createDraftRelease(async () => invalid, metadata));
});

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
