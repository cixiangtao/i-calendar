import './daily-sign.css';

/** 签筒和抽出的那支竹签有独立动画，始终在同一块区域内。 */
export function DailySignCup({ drawing, onDrawn }: { drawing: boolean; onDrawn: () => void }) {
  return (
    <svg
      viewBox="28 13 64 95"
      className="daily-sign-cup tw-block tw-h-[90px] tw-w-[62px] tw-overflow-visible"
      data-drawing={drawing}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && drawing) onDrawn();
      }}
      aria-hidden="true"
    >
      <ellipse
        cx="60"
        cy="103"
        rx="31"
        ry="4"
        fill="currentColor"
        opacity=".12"
      />
      <ellipse
        cx="60"
        cy="49"
        rx="28"
        ry="8.5"
        fill="#694329"
      />
      <path
        d="m43 48-9-22m17 22-4-31m19 31 5-29m4 31 9-21"
        fill="none"
        stroke="#795132"
        strokeWidth="7.5"
        strokeLinecap="round"
      />
      <path
        d="m43 48-9-22m17 22-4-31m19 31 5-29m4 31 9-21"
        fill="none"
        stroke="#d6a05f"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <g className="daily-sign-stick">
        <path
          d="M55 50 56 24q0-2 2-2h3q2 0 2 2l1 26Z"
          fill="#f2d192"
          stroke="#8a5632"
          strokeWidth="1.3"
        />
        <path
          d="M58 26h3m-3 3h3"
          stroke="#a94331"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </g>
      <path
        d="M32 49c0 4.7 12.5 8.5 28 8.5s28-3.8 28-8.5l-4 45c-.4 6-11 9.5-24 9.5S36.4 100 36 94Z"
        fill="#aa693c"
        stroke="#704327"
        strokeWidth="1.4"
      />
      <path
        d="M34 53c8 7 40 8.5 52 0l-4 39c-8.7 7-35.3 7-44 0Z"
        fill="#d19a58"
      />
      <path
        d="M42 59l3 32m4-31 2 35m27-36-3 32m-4-31-2 35"
        stroke="#f7d099"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity=".65"
      />
      <path
        d="M33 51c4.4 9 49.6 9 54 0M38 95c8.5 7.1 35.5 7.1 44 0"
        fill="none"
        stroke="#f0c68e"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="m60 64 13 12.5L60 89 47 76.5Z"
        fill="#9c3f32"
      />
      <text
        x="60"
        y="80.5"
        textAnchor="middle"
        fill="#fff0d9"
        fontSize="11"
        fontWeight="600"
      >
        签
      </text>
    </svg>
  );
}
