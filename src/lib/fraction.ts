/**
 * 精确整数分数：交点坐标全部以 { n, d } 形式记录，避免浮点误差。
 * 规范化不变量：d > 0，gcd(|n|, d) = 1。
 */
export interface Frac {
  n: number
  d: number
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    const t = x % y
    x = y
    y = t
  }
  return x === 0 ? 1 : x
}

export function frac(n: number, d: number): Frac {
  if (d === 0) throw new Error('分数分母不能为 0')
  let num = n
  let den = d
  if (den < 0) {
    num = -num
    den = -den
  }
  const g = gcd(num, den)
  return { n: num / g, d: den / g }
}

export function fracFromInt(k: number): Frac {
  return { n: k, d: 1 }
}

export function fracAddInt(f: Frac, k: number): Frac {
  return frac(f.n + k * f.d, f.d)
}

export function fracToString(f: Frac): string {
  return f.d === 1 ? String(f.n) : `${f.n}/${f.d}`
}

export function fracToNumber(f: Frac): number {
  return f.n / f.d
}
