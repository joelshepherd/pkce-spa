type Sink<T> = (value: T) => void;
type Unsubscribe = () => void;

const PENDING = Symbol("pending");

export class Stream<T> {
  #sinks: Sink<T>[] = [];
  #value: T | typeof PENDING = PENDING;

  subscribe(sink: Sink<T>): Unsubscribe {
    this.#sinks.push(sink);
    if (this.#value !== PENDING) sink(this.#value);
    return () => {
      this.#sinks = this.#sinks.filter((filter) => filter !== sink);
    };
  }

  next(value: T): void {
    this.#sinks.forEach((sink) => sink(value));
    this.#value = value;
  }
}
