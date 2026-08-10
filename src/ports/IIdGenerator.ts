/**
 * Outbound port for rule IDs. Injected rather than delegated to the database driver so the
 * use case can build complete rules before any write, and tests get predictable IDs.
 *
 * Batch-shaped and asynchronous by necessity: the use case always creates IDs for a whole
 * validated batch, and the only generator that cannot desynchronise from a serial column is
 * the column's own sequence — which costs a round trip. One call reserves the whole batch.
 */
export interface IIdGenerator {
  /**
   * Reserves `count` IDs, in ascending order, that no other caller will receive.
   *
   * @param count Number of IDs to reserve; `0` yields an empty array.
   */
  nextIds(count: number): Promise<number[]>;
}
