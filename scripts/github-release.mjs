import assert from 'node:assert/strict';

/** 按标签从完整 Release 列表选择，草稿不能通过 published-by-tag 接口可靠读取。 */
export function selectRelease(releases, tag) {
  const matches = releases.filter((release) => release.tag_name === tag);
  assert.ok(matches.length <= 1, '同一标签存在多个 Release，拒绝猜测发布对象');
  return matches[0] ?? null;
}
