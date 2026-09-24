import { useMemo, useState } from 'react'
import { computeContours, edgeKey, type ContourResult, type GridData } from './lib/contour'
import { fracToString } from './lib/fraction'
import { parseGridInput } from './lib/validate'
import { ContourSvg } from './components/ContourSvg'
import { PolylineTable } from './components/PolylineTable'
import { SAMPLE_TEXT } from './sample'

const initialParse = parseGridInput(SAMPLE_TEXT)

/** 下载 JSON 与 SVG、折线表共用同一 result，坐标以精确分数字符串导出 */
function toDownloadJson(result: ContourResult): string {
  return JSON.stringify(
    {
      levelTwice: result.levelTwice,
      threshold: `${result.levelTwice}/2`,
      rows: result.rows,
      cols: result.cols,
      polylines: result.polylines.map((pl) => ({
        type: pl.closed ? 'closed' : 'open',
        minEdge: edgeKey(
          pl.points.reduce((a, b) => (a.id <= b.id ? a : b)).edge,
        ),
        points: pl.points.map((p) => ({
          edge: edgeKey(p.edge),
          x: fracToString(p.x),
          y: fracToString(p.y),
        })),
      })),
    },
    null,
    2,
  )
}

export default function App() {
  const [text, setText] = useState(SAMPLE_TEXT)
  const [data, setData] = useState<GridData | null>(initialParse.ok ? initialParse.value : null)
  const [error, setError] = useState<string | null>(initialParse.ok ? null : initialParse.error)
  const [showLabels, setShowLabels] = useState(false)

  // 编辑即校验：新输入合法则立即撤销旧描线并整体替换；非法则整份拒绝、保留上次有效网格
  const onEdit = (next: string) => {
    setText(next)
    const parsed = parseGridInput(next)
    if (parsed.ok) {
      setData(parsed.value)
      setError(null)
    } else {
      setError(parsed.error)
    }
  }

  const result = useMemo(() => (data ? computeContours(data) : null), [data])

  const closedCount = result ? result.polylines.filter((p) => p.closed).length : 0
  const openCount = result ? result.polylines.length - closedCount : 0

  const download = () => {
    if (!result) return
    const blob = new Blob([toDownloadJson(result)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'contours.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app">
      <header>
        <h1>等高线描线工作台</h1>
        <p className="subtitle">
          整数高程网格（2–60 行 × 2–60 列）+ 奇数 levelTwice，阈值 = levelTwice/2，鞍点按四角均值裁决
        </p>
      </header>

      <main>
        <section className="pane pane-input">
          <h2>输入（JSON）</h2>
          <textarea
            value={text}
            onChange={(e) => onEdit(e.target.value)}
            spellCheck={false}
            rows={18}
            aria-label="高程网格 JSON 输入"
          />
          {error && (
            <div className="error" role="alert">
              输入无效，已保留上次有效网格：{error}
            </div>
          )}
          <div className="toolbar">
            <button onClick={() => onEdit(SAMPLE_TEXT)}>载入示例</button>
            <button onClick={download} disabled={!result}>
              下载 JSON
            </button>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
              />
              显示顶点数值
            </label>
          </div>
          {result && (
            <p className="stats">
              网格 {result.rows}×{result.cols} · 阈值 {result.levelTwice}/2 · 折线{' '}
              {result.polylines.length} 条（闭环 {closedCount} / 开放 {openCount}）
            </p>
          )}
        </section>

        <section className="pane pane-canvas">
          <h2>SVG 描线</h2>
          {result && data ? (
            <>
              <ContourSvg result={result} grid={data.grid} showLabels={showLabels} />
              <p className="legend">
                <span className="legend-swatch swatch-closed" /> 闭环
                <span className="legend-swatch swatch-open" /> 开放折线
                <span className="legend-dot dot-above" /> 高于阈值
                <span className="legend-dot dot-below" /> 低于阈值
              </p>
            </>
          ) : (
            <p className="empty">暂无有效网格。</p>
          )}
        </section>

        <section className="pane pane-table">
          <h2>折线表</h2>
          {result && result.polylines.length > 0 ? (
            <PolylineTable result={result} />
          ) : (
            <p className="empty">当前阈值下没有等高线。</p>
          )}
        </section>
      </main>
    </div>
  )
}
