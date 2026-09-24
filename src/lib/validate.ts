import type { GridData } from './contour'

export const MIN_DIM = 2
export const MAX_DIM = 60

export type ParseResult = { ok: true; value: GridData } | { ok: false; error: string }

/**
 * 解析并整份校验输入：
 *  - 顶层必须恰好含 grid 与 levelTwice 两个字段（额外字段整份拒绝）；
 *  - grid 为 2..60 行 × 2..60 列的整数矩阵，行宽一致；
 *  - levelTwice 为奇数整数（阈值 levelTwice/2 因此不与整数顶点重合）。
 * 校验失败时返回错误信息，由调用方保留上次有效网格。
 */
export function parseGridInput(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: '输入不是合法的 JSON。' }
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: '顶层必须是包含 grid 与 levelTwice 的对象。' }
  }

  const obj = raw as Record<string, unknown>
  const present = Object.keys(obj)
  const required = ['grid', 'levelTwice']
  const missing = required.filter((k) => !present.includes(k))
  const extra = present.filter((k) => !required.includes(k))
  if (missing.length > 0 || extra.length > 0) {
    const parts: string[] = []
    if (missing.length > 0) parts.push(`缺少字段：${missing.join('、')}`)
    if (extra.length > 0) parts.push(`存在额外字段：${extra.join('、')}`)
    return { ok: false, error: parts.join('；') + '。' }
  }

  const { levelTwice, grid } = obj

  if (typeof levelTwice !== 'number' || !Number.isInteger(levelTwice)) {
    return { ok: false, error: 'levelTwice 必须是整数。' }
  }
  if (levelTwice % 2 === 0) {
    return { ok: false, error: 'levelTwice 必须是奇数，这样阈值 levelTwice/2 才不会与整数顶点重合。' }
  }

  if (!Array.isArray(grid)) {
    return { ok: false, error: 'grid 必须是二维整数数组。' }
  }
  if (grid.length < MIN_DIM || grid.length > MAX_DIM) {
    return { ok: false, error: `行数必须在 ${MIN_DIM}–${MAX_DIM} 之间，当前为 ${grid.length}。` }
  }

  let cols = -1
  for (let i = 0; i < grid.length; i++) {
    const row: unknown = grid[i]
    if (!Array.isArray(row)) {
      return { ok: false, error: `第 ${i + 1} 行不是数组。` }
    }
    if (cols === -1) {
      cols = row.length
      if (cols < MIN_DIM || cols > MAX_DIM) {
        return { ok: false, error: `列数必须在 ${MIN_DIM}–${MAX_DIM} 之间，当前为 ${cols}。` }
      }
    } else if (row.length !== cols) {
      return { ok: false, error: `第 ${i + 1} 行有 ${row.length} 列，与首行的 ${cols} 列不一致。` }
    }
    for (let j = 0; j < row.length; j++) {
      if (typeof row[j] !== 'number' || !Number.isInteger(row[j])) {
        return { ok: false, error: `第 ${i + 1} 行第 ${j + 1} 列的值不是整数。` }
      }
    }
  }

  return { ok: true, value: { grid: grid as number[][], levelTwice: levelTwice as number } }
}
