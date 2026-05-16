/**
 * Distribui um valor (em centavos) em N parcelas inteiras de forma que a soma
 * bata exatamente com o total. A última parcela absorve o resto da divisão.
 */
export function splitAmountCents(totalCents: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  const arr = new Array(count).fill(base) as number[];
  arr[arr.length - 1] += remainder;
  return arr;
}
