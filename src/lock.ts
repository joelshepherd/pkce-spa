type State = [key: string, id: number] | null;

export class Lock {
  #safetyTimeout: number;
  #send: Sender;
  #state: State;

  constructor(key: string, safetyTimeout: number) {
    this.#safetyTimeout = safetyTimeout;

    // Create messenge channel
    const create = "BroadcastChannel" in window ? broadcast : storage;
    this.#send = create(key, (state) => (this.#state = state));

    // After registration of the receiver
    this.#state = restoreState(key);
  }

  async acquire(key: string): Promise<boolean> {
    // Check for an existing lock
    if (this.#state !== null && this.#state[0] === key) return false;

    // Try and acquire the lock
    const id = Math.floor(Math.random() * 100_000_000);
    this.#send([key, id]);

    // Wait long enough that any other threads to receive the lock message
    await delay(this.#safetyTimeout);

    // Check we still control the lock
    return (
      this.#state !== null && this.#state[0] === key && this.#state[1] === id
    );
  }

  release(): void {
    this.#send(null);
  }
}

/** A channel to send and receive lock messages */
type Channel = (key: string, receiver: (state: State) => void) => Sender;

type Sender = (state: State) => void;

/** Send lock updates via a broadcast channel (most reliable) */
const broadcast: Channel = (key, receiver) => {
  const producer = new BroadcastChannel(key);
  const consumer = new BroadcastChannel(key);

  consumer.onmessage = (event) => {
    receiver(event.data);
  };

  return (state) => {
    producer.postMessage(state);
    persistState(key, state);
  };
};

/**
 * Send lock updates via localstorage (least reliable)
 * Used as a fallback for browsers that do not support broadcast channel
 */
const storage: Channel = (key, receiver) => {
  window.addEventListener("storage", (event) => {
    if (event.key !== key) return;
    receiver(restoreState(key));
  });

  return (state) => {
    receiver(state);
    persistState(key, state);
  };
};

function restoreState(key: string): State {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "");
    if (
      Array.isArray(parsed) &&
      typeof parsed[0] === "string" &&
      typeof parsed[1] === "number"
    ) {
      return parsed as State;
    }
  } catch {}
  return null;
}

function persistState(key: string, state: State): void {
  if (state === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, JSON.stringify(state));
}

function delay(timeout: number): Promise<void> {
  return new Promise((res) => setTimeout(res, timeout));
}
