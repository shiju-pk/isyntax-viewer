/**
 * Abstract parser interface for binary protocol parsing.
 */
export interface IParser<T> {
  parse(data: Uint8Array): T;
}
