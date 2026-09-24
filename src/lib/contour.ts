import { frac, fracAddInt, fracFromInt, type Frac } from './fraction'

/** 已通过校验的高程网格输入 */
export interface GridData {
  grid: number[][]
  /** 奇数整数；真实阈值 = levelTwice / 2，因此不与整数顶点重合 */
  levelTwice: number
}

/** 网格边引用：h = 水平边（连接 (r,c) 与 (r,c+1)），v = 竖直边（连接 (r,c) 与 (r+1,c)） */
export interface EdgeRef {
  kind: 'h' | 'v'
  r: number
  c: number
}

/** 一条格内线段，两个端点都以跨阈值网格边标识 */
interface RawSegment {
  a: EdgeRef
  b: EdgeRef
}

export interface ContourPoint {
  edge: EdgeRef
  /** 全局数字边标识，用于拼接与规范排序 */
  id: number
  /** 精确分数坐标（x 为列方向，y 为行方向，向下为正） */
  x: Frac
  y: Frac
}

export interface Polyline {
  closed: boolean
  points: ContourPoint[]
}

export interface ContourResult {
  rows: number
  cols: number
  levelTwice: number
  polylines: Polyline[]
}

export function edgeKey(e: EdgeRef): string {
  return `${e.kind}:${e.r}:${e.c}`
}

/**
 * 边的全局数字标识：
 *   h 边 r∈[0,rows), c∈[0,cols-2)  → r*(cols-1) + c
 *   v 边 r∈[0,rows-2), c∈[0,cols)  → rows*(cols-1) + r*cols + c
 * 相邻格共享同一条边，故共享同一标识。
 */
export function edgeId(e: EdgeRef, rows: number, cols: number): number {
  return e.kind === 'h'
    ? e.r * (cols - 1) + e.c
    : rows * (cols - 1) + e.r * cols + e.c
}

export function edgeFromId(id: number, rows: number, cols: number): EdgeRef {
  const hCount = rows * (cols - 1)
  if (id < hCount) {
    return { kind: 'h', r: Math.floor(id / (cols - 1)), c: id % (cols - 1) }
  }
  const vi = id - hCount
  return { kind: 'v', r: Math.floor(vi / cols), c: vi % cols }
}

/** 阈值在边上的参数 t：t = (levelTwice - 2*h0) / (2*(h1 - h0))，全部为整数分数 */
function crossingT(h0: number, h1: number, levelTwice: number): Frac {
  return frac(levelTwice - 2 * h0, 2 * (h1 - h0))
}

export function pointOnEdge(e: EdgeRef, grid: number[][], levelTwice: number): { x: Frac; y: Frac } {
  if (e.kind === 'h') {
    const t = crossingT(grid[e.r][e.c], grid[e.r][e.c + 1], levelTwice)
    return { x: fracAddInt(t, e.c), y: fracFromInt(e.r) }
  }
  const t = crossingT(grid[e.r][e.c], grid[e.r + 1][e.c], levelTwice)
  return { x: fracFromInt(e.c), y: fracAddInt(t, e.r) }
}

/**
 * 逐格生成线段。
 * 四交点（鞍）格按四角均值与阈值比较裁决：
 *   均值 > 阈值：连接两个低角周围的交点；
 *   均值 < 阈值：连接两个高角周围的交点；
 *   恰等：固定连接左上、右下角周围的交点。
 */
function cellSegments(grid: number[][], levelTwice: number, r: number, c: number): RawSegment[] {
  const tl = grid[r][c]
  const tr = grid[r][c + 1]
  const bl = grid[r + 1][c]
  const br = grid[r + 1][c + 1]

  const aTl = 2 * tl > levelTwice
  const aTr = 2 * tr > levelTwice
  const aBl = 2 * bl > levelTwice
  const aBr = 2 * br > levelTwice

  const top: EdgeRef = { kind: 'h', r, c }
  const right: EdgeRef = { kind: 'v', r, c: c + 1 }
  const bottom: EdgeRef = { kind: 'h', r: r + 1, c }
  const left: EdgeRef = { kind: 'v', r, c }

  const crossings: EdgeRef[] = []
  if (aTl !== aTr) crossings.push(top)
  if (aTr !== aBr) crossings.push(right)
  if (aBl !== aBr) crossings.push(bottom)
  if (aTl !== aBl) crossings.push(left)

  if (crossings.length === 2) {
    return [{ a: crossings[0], b: crossings[1] }]
  }

  if (crossings.length === 4) {
    // sum/4 与 levelTwice/2 比较，等价于 sum 与 2*levelTwice 比较
    const cmp = tl + tr + bl + br - 2 * levelTwice
    // 是否围绕左上(TL)、右下(BR)两角接线；否则围绕右上(TR)、左下(BL)两角
    let aroundTlBr: boolean
    if (cmp === 0) {
      aroundTlBr = true // 恰等：固定连接左上与右下角周围
    } else if (cmp > 0) {
      aroundTlBr = !aTl // 均值高于阈值 → 连接低角周围
    } else {
      aroundTlBr = aTl // 均值低于阈值 → 连接高角周围
    }
    return aroundTlBr
      ? [
          { a: top, b: left },
          { a: right, b: bottom },
        ]
      : [
          { a: top, b: right },
          { a: bottom, b: left },
        ]
  }

  return []
}

interface StitchedPath {
  pointIds: number[]
  closed: boolean
}

/**
 * 以共享边标识拼接所有格内线段。
 * 内部跨阈值边恒有两个相邻格贡献端点（度数 2），边界边仅一个（度数 1），
 * 故每个连通分支必为开放折线（两端在边界）或闭环。
 */
function stitch(
  segments: { a: number; b: number }[],
  isBoundary: (edgeId: number) => boolean,
): StitchedPath[] {
  const adjacency = new Map<number, number[]>()
  const link = (edge: number, seg: number) => {
    const list = adjacency.get(edge)
    if (list) list.push(seg)
    else adjacency.set(edge, [seg])
  }
  segments.forEach((s, i) => {
    link(s.a, i)
    link(s.b, i)
  })

  const visited = new Array<boolean>(segments.length).fill(false)

  const walk = (startEdge: number, startSeg: number): { pointIds: number[]; closed: boolean } => {
    const pointIds: number[] = [startEdge]
    let seg = startSeg
    let at = startEdge
    for (;;) {
      visited[seg] = true
      const cur = segments[seg]
      const next = cur.a === at ? cur.b : cur.a
      pointIds.push(next)
      const onward = (adjacency.get(next) ?? []).filter((s) => s !== seg)
      if (onward.length === 0) return { pointIds, closed: false }
      const nextSeg = onward[0]
      if (visited[nextSeg]) return { pointIds, closed: true }
      seg = nextSeg
      at = next
    }
  }

  const paths: StitchedPath[] = []

  // 先从边界端点出发收集开放折线
  const boundaryEdges = [...adjacency.keys()]
    .filter((id) => isBoundary(id) && (adjacency.get(id)?.length ?? 0) === 1)
    .sort((x, y) => x - y)
  for (const edge of boundaryEdges) {
    const seg = adjacency.get(edge)![0]
    if (visited[seg]) continue
    paths.push(walk(edge, seg))
  }

  // 剩余全部是闭环
  for (let i = 0; i < segments.length; i++) {
    if (visited[i]) continue
    const walked = walk(segments[i].a, i)
    walked.pointIds.pop() // 闭环行走会回到起点，去掉重复终点
    paths.push({ pointIds: walked.pointIds, closed: true })
  }

  return paths
}

/** 规范朝向：开线从小端点起；闭环把最小边标识转到首位，并选次点较小的方向 */
function canonicalOrder(pointIds: number[], closed: boolean): number[] {
  let ids = pointIds
  if (closed) {
    let mi = 0
    for (let i = 1; i < ids.length; i++) {
      if (ids[i] < ids[mi]) mi = i
    }
    ids = ids.slice(mi).concat(ids.slice(0, mi))
    if (ids.length > 2 && ids[1] > ids[ids.length - 1]) {
      ids = [ids[0], ...ids.slice(1).reverse()]
    }
    return ids
  }
  if (ids.length > 1 && ids[0] > ids[ids.length - 1]) ids.reverse()
  return ids
}

export function computeContours(input: GridData): ContourResult {
  const { grid, levelTwice } = input
  const rows = grid.length
  const cols = grid[0].length

  const raw: RawSegment[] = []
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      raw.push(...cellSegments(grid, levelTwice, r, c))
    }
  }

  const segments = raw.map((s) => ({
    a: edgeId(s.a, rows, cols),
    b: edgeId(s.b, rows, cols),
  }))

  const hCount = rows * (cols - 1)
  const isBoundary = (id: number): boolean => {
    if (id < hCount) {
      // 水平边：首行或末行
      const r = Math.floor(id / (cols - 1))
      return r === 0 || r === rows - 1
    }
    // 竖直边：首列或末列
    const c = (id - hCount) % cols
    return c === 0 || c === cols - 1
  }

  const stitched = stitch(segments, isBoundary).map((p) => ({
    closed: p.closed,
    ids: canonicalOrder(p.pointIds, p.closed),
  }))

  stitched.sort((x, y) => Math.min(...x.ids) - Math.min(...y.ids))

  const polylines: Polyline[] = stitched.map((p) => ({
    closed: p.closed,
    points: p.ids.map((id) => {
      const ref = edgeFromId(id, rows, cols)
      const { x, y } = pointOnEdge(ref, grid, levelTwice)
      return { edge: ref, id, x, y }
    }),
  }))

  return { rows, cols, levelTwice, polylines }
}
