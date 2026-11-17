import { sunlightPlaces } from '@i-calendar/core/places';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { CalendarButton } from './CalendarButton.js';
import { CalendarInput } from './CalendarInput.js';
import type { ManualSunlightLocation } from './sunlight-location.js';

/** 离线地名搜索，只显示前 30 个结果，避免在菜单栏展开长列表。 */
export default function SunlightPlaceSearch({
  onSelect,
  onClose,
}: {
  onSelect: (place: ManualSunlightLocation) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const handleEscape = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };
  useEffect(() => {
    input.current?.focus();
  }, []);
  const keywords = query.trim().split(/\s+/).filter(Boolean);
  const common = new Set([
    '1816670',
    '1796236',
    '1809858',
    '1795565',
    '1815286',
    '1804651',
    '1819729',
    '1668341',
    '1821274',
  ]);
  const results = sunlightPlaces.filter((place) =>
    keywords.length
      ? keywords.every((word) => `${place.region}${place.name}`.includes(word))
      : common.has(place.id),
  );
  return (
    <div className="tw-mb-3 tw-min-w-0">
      <label
        htmlFor="sunlight-place-query"
        className="tw-mb-1 tw-block tw-text-[12px]"
      >
        搜索国内城市或区县
      </label>
      <div className="tw-flex">
        <CalendarInput
          id="sunlight-place-query"
          onKeyDown={handleEscape}
          ref={input}
          value={query}
          placeholder="例如：北京、成都、海淀"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <output className="tw-mb-1 tw-mt-1 tw-block tw-text-[12px] tw-leading-[1.8] tw-text-secondary">
        {results.length
          ? `找到 ${results.length} 个参考点${results.length > 30 ? '，显示前 30 个，请输入更具体的地名' : ''}`
          : '未收录此地名，请尝试附近城市或使用当前位置。'}
      </output>
      <ul
        aria-label="地点搜索结果"
        className="tw-m-0 tw-max-h-40 tw-list-none tw-overflow-y-auto tw-overscroll-contain tw-p-0"
      >
        {results.slice(0, 30).map((place) => (
          <li key={place.id}>
            <CalendarButton
              onKeyDown={handleEscape}
              className="tw-w-full tw-justify-start tw-text-left coarse:tw-min-h-11"
              appearance="text"
              onClick={() => onSelect(place)}
            >
              {place.region} · {place.name}
            </CalendarButton>
          </li>
        ))}
      </ul>
      <p className="!tw-mb-0 !tw-mt-1">
        GeoNames 国内城市及部分区县参考点，不是完整行政区划；手动选择按该参考点估算。
      </p>
    </div>
  );
}
