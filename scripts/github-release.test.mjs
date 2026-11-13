import assert from 'node:assert/strict';
import { test } from 'node:test';

import { selectRelease } from './github-release.mjs';

test('Release 查询保留同标签草稿，其他版本的已发布记录不影响选择', () => {
  const draft = { id: 1, tag_name: 'v1.0.0', draft: true };
  const published = { id: 2, tag_name: 'v0.9.0', draft: false };
  assert.equal(selectRelease([published, draft], 'v1.0.0'), draft);
  assert.equal(selectRelease([published], 'v1.0.0'), null);
  assert.equal(selectRelease([{ ...draft, draft: false }], 'v1.0.0').draft, false);
  assert.throws(() => selectRelease([draft, { ...draft, id: 3 }], 'v1.0.0'));
});
