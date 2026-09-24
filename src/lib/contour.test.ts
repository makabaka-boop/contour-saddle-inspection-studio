import { describe, expect, it } from 'vitest'
import { computeContours, edgeKey, type Polyline } from './contour'
import { fracToString } from './fraction'

const keys = (pl: Polyline): string[] => pl.points.map((p) => edgeKey(p.edge))
const coords = (pl: Polyline): [string, string][] =>
  pl.points.map((p) => [fracToString(p.x), fracToString(p.y)])

describe('边界开线：单格一角高于阈值', () => {
  // 阈值 0.5：仅右下角 (1,1)=2 高于阈值，交点落在右边界与下边界两条边
  const result = computeContours({ grid: [[0, 0], [0, 2]], levelTwice: 1 })

  it('生成一条开放折线', () => {
    expect(result.polylines).toHaveLength(1)
    expect(result.polylines[0].closed).toBe(false)
  })

  it('按较小边标识定向，两个端点分别在底、右边界', () => {
    expect(keys(result.polylines[0])).toEqual(['h:1:0', 'v:0:1'])
  })

  it('交点坐标为精确分数', () => {
    expect(coords(result.polylines[0])).toEqual([
      ['1/4', '1'],
      ['1', '1/4'],
    ])
  })
})

describe('闭环：孤立高顶点', () => {
  // 3×3 顶点，仅中心 (1,1)=2 高于阈值 0.5，四格各出一段，首尾相接成环
  const result = computeContours({
    grid: [
      [0, 0, 0],
      [0, 2, 0],
      [0, 0, 0],
    ],
    levelTwice: 1,
  })

  it('恰好一条闭环、四个交点', () => {
    expect(result.polylines).toHaveLength(1)
    const loop = result.polylines[0]
    expect(loop.closed).toBe(true)
    expect(loop.points).toHaveLength(4)
  })

  it('以最小边标识 h:1:0 为起点规范排序', () => {
    expect(keys(result.polylines[0])).toEqual(['h:1:0', 'v:0:1', 'h:1:1', 'v:1:1'])
  })

  it('沿高角反方向的交点参数为 3/4，分数仍精确', () => {
    expect(coords(result.polylines[0])).toEqual([
      ['1/4', '1'],
      ['1', '1/4'],
      ['7/4', '1'],
      ['1', '7/4'],
    ])
  })
})

describe('四交点鞍格裁决（2×2 单格，阈值 3/2）', () => {
  it('四角均值高于阈值：连接低角（右上、左下）周围交点', () => {
    // [[4,0],[0,4]]：高角为 TL、BR，均值 2 > 1.5
    const result = computeContours({ grid: [[4, 0], [0, 4]], levelTwice: 3 })
    expect(result.polylines).toHaveLength(2)
    expect(keys(result.polylines[0])).toEqual(['h:0:0', 'v:0:1']) // 上-右，环绕右上低角
    expect(keys(result.polylines[1])).toEqual(['h:1:0', 'v:0:0']) // 下-左，环绕左下低角
  })

  it('四角均值低于阈值：连接高角（左上、右下）周围交点', () => {
    // [[2,0],[0,2]]：高角为 TL、BR，均值 1 < 1.5
    const result = computeContours({ grid: [[2, 0], [0, 2]], levelTwice: 3 })
    expect(result.polylines).toHaveLength(2)
    expect(keys(result.polylines[0])).toEqual(['h:0:0', 'v:0:0']) // 上-左，环绕左上高角
    expect(keys(result.polylines[1])).toEqual(['h:1:0', 'v:0:1']) // 下-右，环绕右下高角
  })

  it('均值恰等（高角在 TL、BR）：固定连接左上、右下角周围', () => {
    // [[4,0],[0,2]]：均值恰为 1.5
    const result = computeContours({ grid: [[4, 0], [0, 2]], levelTwice: 3 })
    expect(keys(result.polylines[0])).toEqual(['h:0:0', 'v:0:0'])
    expect(keys(result.polylines[1])).toEqual(['h:1:0', 'v:0:1'])
  })

  it('均值恰等（高角在 TR、BL）：仍固定连接左上、右下角，不随高角翻转', () => {
    // [[0,4],[2,0]]：高角为 TR、BL，均值恰为 1.5；
    // 若误用“低于”规则会变成连接 TR、BL，固定规则必须给 TL、BR
    const tie = computeContours({ grid: [[0, 4], [2, 0]], levelTwice: 3 })
    expect(keys(tie.polylines[0])).toEqual(['h:0:0', 'v:0:0'])
    expect(keys(tie.polylines[1])).toEqual(['h:1:0', 'v:0:1'])

    // 对照组：同分布但均值高于阈值时连接低角（恰好是 TL、BR），结果与固定规则一致
    const above = computeContours({ grid: [[0, 4], [3, 0]], levelTwice: 3 })
    expect(keys(above.polylines[0])).toEqual(['h:0:0', 'v:0:0'])

    // 对照组：均值低于阈值时连接高角（TR、BL），与固定规则相反
    const below = computeContours({ grid: [[0, 2], [2, 0]], levelTwice: 3 })
    expect(keys(below.polylines[0])).toEqual(['h:0:0', 'v:0:1'])
    expect(keys(below.polylines[1])).toEqual(['h:1:0', 'v:0:0'])
  })
})

describe('相邻格共享交点拼接', () => {
  // 3×3 顶点，右下角 2×2 高区：
  //   0 0 0
  //   0 2 2
  //   0 2 2
  // 共享边 h:1:0（上下格）、v:0:1（左右格）各被两格同时引用，
  // 三段格内线段必须借同一交点拼成一条连续开放折线。
  const result = computeContours({
    grid: [
      [0, 0, 0],
      [0, 2, 2],
      [0, 2, 2],
    ],
    levelTwice: 1,
  })

  it('只有一条开放折线，共享交点在点列中恰好出现一次', () => {
    expect(result.polylines).toHaveLength(1)
    const line = result.polylines[0]
    expect(line.closed).toBe(false)
    expect(keys(line)).toEqual(['h:2:0', 'h:1:0', 'v:0:1', 'v:0:2'])
    const ids = line.points.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('共享边上的交点为同一精确坐标', () => {
    expect(coords(result.polylines[0])).toEqual([
      ['1/4', '2'],
      ['1/4', '1'], // h:1:0：cell(0,0) 与 cell(1,0) 共享
      ['1', '1/4'], // v:0:1：cell(0,0) 与 cell(0,1) 共享
      ['2', '1/4'],
    ])
  })
})

describe('无跨阈值边', () => {
  it('全部顶点同侧时没有折线', () => {
    const below = computeContours({ grid: [[0, 0], [0, 0]], levelTwice: 3 })
    const above = computeContours({ grid: [[9, 9], [9, 9]], levelTwice: 3 })
    expect(below.polylines).toHaveLength(0)
    expect(above.polylines).toHaveLength(0)
  })
})
