import { type ContourResult } from '../lib/contour'
import { fracToNumber } from '../lib/fraction'

interface Props {
  result: ContourResult
  grid: number[][]
  showLabels: boolean
}

const PAD = 0.6
export const CLOSED_COLOR = '#0d9488'
export const OPEN_COLOR = '#ea580c'

/** 与折线表、下载 JSON 共用同一 result 的 SVG 描线视图 */
export function ContourSvg({ result, grid, showLabels }: Props) {
  const { rows, cols, levelTwice, polylines } = result
  const width = cols - 1 + PAD * 2
  const height = rows - 1 + PAD * 2

  const verticals: number[] = Array.from({ length: cols }, (_, c) => c)
  const horizontals: number[] = Array.from({ length: rows }, (_, r) => r)

  const pathD = (pl: ContourResult['polylines'][number]): string => {
    const d = pl.points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${fracToNumber(p.x).toFixed(6)} ${fracToNumber(p.y).toFixed(6)}`)
      .join('')
    return pl.closed ? `${d}Z` : d
  }

  const dots = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const above = 2 * grid[r][c] > levelTwice
      dots.push(
        <g key={`${r}-${c}`}>
          <circle cx={c} cy={r} r={0.055} className={above ? 'vertex-above' : 'vertex-below'} />
          {showLabels && (
            <text x={c + 0.09} y={r - 0.09} className="vertex-label">
              {grid[r][c]}
            </text>
          )}
        </g>,
      )
    }
  }

  return (
    <svg
      viewBox={`${-PAD} ${-PAD} ${width} ${height}`}
      className="contour-svg"
      role="img"
      aria-label="等高线 SVG 描线"
    >
      {verticals.map((c) => (
        <line key={`v${c}`} x1={c} y1={0} x2={c} y2={rows - 1} className="grid-line" />
      ))}
      {horizontals.map((r) => (
        <line key={`h${r}`} x1={0} y1={r} x2={cols - 1} y2={r} className="grid-line" />
      ))}
      {dots}
      {polylines.map((pl, i) => (
        <path
          key={i}
          d={pathD(pl)}
          fill="none"
          stroke={pl.closed ? CLOSED_COLOR : OPEN_COLOR}
          strokeWidth={0.06}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}
