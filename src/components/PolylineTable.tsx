import { edgeKey, type ContourResult, type Polyline } from '../lib/contour'
import { fracToString } from '../lib/fraction'

function minEdgeKey(pl: Polyline): string {
  let min = pl.points[0]
  for (const p of pl.points) {
    if (p.id < min.id) min = p
  }
  return edgeKey(min.edge)
}

/** 与 SVG、下载 JSON 共用同一 result 的折线表 */
export function PolylineTable({ result }: { result: ContourResult }) {
  return (
    <table className="polyline-table">
      <thead>
        <tr>
          <th>#</th>
          <th>类型</th>
          <th>点数</th>
          <th>最小边标识</th>
          <th>点列（边 / 精确坐标）</th>
        </tr>
      </thead>
      <tbody>
        {result.polylines.map((pl, i) => (
          <tr key={i}>
            <td>{i + 1}</td>
            <td>
              <span className={pl.closed ? 'tag tag-closed' : 'tag tag-open'}>
                {pl.closed ? '闭环' : '开放'}
              </span>
            </td>
            <td>{pl.points.length}</td>
            <td>
              <code>{minEdgeKey(pl)}</code>
            </td>
            <td>
              <details>
                <summary>展开 {pl.points.length} 个点</summary>
                <table className="points-table">
                  <thead>
                    <tr>
                      <th>边</th>
                      <th>x</th>
                      <th>y</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pl.points.map((pt, j) => (
                      <tr key={j}>
                        <td>
                          <code>{edgeKey(pt.edge)}</code>
                        </td>
                        <td>{fracToString(pt.x)}</td>
                        <td>{fracToString(pt.y)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
