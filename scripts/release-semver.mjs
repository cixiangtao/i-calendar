import assert from 'node:assert/strict';

/** 正式发布的 SemVer 核心版本，三段以整数比较。 */
export function parseStableVersion(version) {
  assert.ok(
    typeof version === 'string' &&
      version.trim() === version &&
      /^[1-9]\d*\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(version),
    '只允许无前导零的 1.0.0 起正式版本',
  );
  return version.split('.').map(BigInt);
}

/** 校验递增及低位归零。校验同一正式版的恢复时可允许版本相等。 */
export function assertVersionAdvance(current, target, { allowSame = false } = {}) {
  const previous = parseStableVersion(current);
  const next = parseStableVersion(target);
  const changed = next.findIndex((part, index) => part !== previous[index]);
  if (allowSame && changed === -1) return;
  assert.ok(changed >= 0 && next[changed] > previous[changed], '新版本必须高于当前版本');
  assert.ok(
    next.slice(changed + 1).every((part) => part === 0n),
    '主版本递增时次版本与修订号须归零，次版本递增时修订号须归零',
  );
}
