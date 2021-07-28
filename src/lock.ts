type State = [key: string, id: number] | null;

export class Lock {
  #state: State | null;
  #sender: Sender;

  constructor(key: string) {
    // Select messenger type
    const messenger = "BroadcastChannel" in window ? channel : storage;
    this.#sender = messenger(key, (state) => (this.#state = state));

    // After registration of the receiver
    this.#state = restoreState(key);
  }

  async acquire(key: string): Promise<boolean> {
    // Check for existing lock of this key
    if (this.#state && this.#state[0] === key) return false;

    // Try and acquire the lock
    const id = Math.floor(Math.random() * 100_000_000);
    await this.#sender([key, id]);

    // Check we still control the lock after the safety timeout
    await delay(100);

    const stillHasLock =
      this.#state !== null && this.#state[0] === key && this.#state[1] === id;

    return stillHasLock;
  }

  release(): void {
    this.#sender(null);
  }
}

function restoreState(key: string): State {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "");
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

type Sender = (state: State) => Promise<void>;
type Receiver = (state: State) => void;

type Channel = (key: string, receiver: Receiver) => Sender;

// Send lock updates via a broadcast channel (most reliable)
const channel: Channel = function (key, receiver) {
  const producer = new BroadcastChannel(key);
  const consumer = new BroadcastChannel(key);

  consumer.onmessage = (event) => {
    receiver(event.data);
  };

  return async (state) => {
    producer.postMessage(state);
    persistState(key, state);
  };
};

// Send lock updates via localstorage (least reliable)
// Used as a fallback for browsers that do not support broadcast channel
const storage: Channel = function (key, receiver) {
  window.addEventListener("storage", (event) => {
    if (event.key !== key) return;
    receiver(restoreState(key));
  });

  return async (state) => {
    // Random wait to protect against concurrent writes that can otherwise break localstorage
    await delay(Math.random() * 10);

    receiver(state);
    persistState(key, state);
  };
};
