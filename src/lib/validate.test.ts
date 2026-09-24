import { describe, expect, it } from 'vitest'
import { parseGridInput } from './validate'

const ok = (text: string) => parseGridInput(text).ok
const err = (text: string) => (parseGridInput(text) as { ok: false; error: string }).error

describe('输入整份校验', () => {
  const valid = JSON.stringify({
    grid: [
      [0, 1],
      [2, 3],
    ],
    levelTwice: 1,
  })

  it('合法输入通过', () => {
    expect(parseGridInput(valid)).toEqual({
      ok: true,
      value: { grid: [[0, 1], [2, 3]], levelTwice: 1 },
    })
  })

  it('合法的 60×60 网格通过', () => {
    const text = JSON.stringify({
      grid: Array.from({ length: 60 }, () => Array(60).fill(1)),
      levelTwice: -3,
    })
    expect(ok(text)).toBe(true)
  })

  it('坏维度整份拒绝', () => {
    expect(ok(JSON.stringify({ grid: [[0, 0]], levelTwice: 1 }))).toBe(false) // 1 行
    expect(ok(JSON.stringify({ grid: Array(61).fill([0, 0]), levelTwice: 1 }))).toBe(false) // 61 行
    expect(ok(JSON.stringify({ grid: [[0], [0]], levelTwice: 1 }))).toBe(false) // 1 列
    expect(
      ok(
        JSON.stringify({
          grid: [
            [0, 0],
            [0, 0, 0],
          ],
          levelTwice: 1,
        }),
      ),
    ).toBe(false) // 行宽不一致
  })

  it('非整数整份拒绝', () => {
    expect(
      ok(
        JSON.stringify({
          grid: [
            [0, 1.5],
            [2, 3],
          ],
          levelTwice: 1,
        }),
      ),
    ).toBe(false)
    expect(
      ok(
        JSON.stringify({
          grid: [
            ['0', 1],
            [2, 3],
          ],
          levelTwice: 1,
        }),
      ),
    ).toBe(false)
    expect(ok(JSON.stringify({ grid: [[0, 1], [2, 3]], levelTwice: 1.5 }))).toBe(false)
  })

  it('偶数 levelTwice 拒绝（否则阈值落在整数顶点上）', () => {
    expect(ok(JSON.stringify({ grid: [[0, 1], [2, 3]], levelTwice: 2 }))).toBe(false)
  })

  it('额外字段整份拒绝', () => {
    const parsed = parseGridInput(JSON.stringify({ grid: [[0, 1], [2, 3]], levelTwice: 1, note: 'x' }))
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.error).toContain('额外字段')
  })

  it('缺字段拒绝并指出字段名', () => {
    const parsed = parseGridInput(JSON.stringify({ grid: [[0, 1], [2, 3]] }))
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.error).toContain('levelTwice')
  })

  it('顶层为数组或非法 JSON 拒绝', () => {
    expect(ok('[[0,1],[2,3]]')).toBe(false)
    expect(err('{not json}')).toContain('JSON')
  })
})
