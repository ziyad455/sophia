export function PdfReadingMoodFilters() {
  return (
    <svg
      className="pointer-events-none absolute h-0 w-0 overflow-hidden"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id="sophia-pdf-printed-ink" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="
              0.193424 0.650692 0.065688 0 0.027451
              0.174249 0.586184 0.059176 0 0.062745
              0.145068 0.488019 0.049266 0 0.098039
              0 0 0 1 0
            "
          />
        </filter>
        <filter id="sophia-pdf-warm-paper" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="
              0.176750 0.594598 0.060025 0 0.168627
              0.179251 0.603012 0.060875 0 0.129412
              0.177584 0.597402 0.060308 0 0.094118
              0 0 0 1 0
            "
          />
        </filter>
        <filter id="sophia-pdf-night-study" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="
              -0.170914 -0.574965 -0.058043 0 0.929412
              -0.165911 -0.558136 -0.056344 0 0.905882
              -0.157574 -0.530089 -0.053513 0 0.866667
              0 0 0 1 0
            "
          />
        </filter>
      </defs>
    </svg>
  )
}
