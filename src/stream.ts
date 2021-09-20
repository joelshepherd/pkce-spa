export type Sink<T> = (value: T) => void;

export type Unsubscribe = () => void;

const PENDING = Symbol("pending");

export class Stream<T> {
  #sinks: Set<Sink<T>> = new Set();
  #value: T | typeof PENDING = PENDING;

  subscribe(sink: Sink<T>): Unsubscribe {
    this.#sinks.add(sink);
    if (this.#value !== PENDING) sink(this.#value);
    return () => {
      this.#sinks.delete(sink);
    };
  }

  next(value: T): void {
    this.#sinks.forEach((sink) => sink(value));
    this.#value = value;
  }
}
