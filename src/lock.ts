/**
 * Try and aquire a lock.
 *
 * Warning: not perfectly thread safe. Concurrent writes can break cross-tab sync of localstorage.
 */
export function acquire(
  key: string,
  timeout = 5000,
  safetyTimeout = 1000
): Promise<boolean> {
  // Check for existing lock
  if (readLock(key)) return Promise.resolve(false);

  const id = Math.floor(Math.random() * 1000000);
  const expires = Date.now() + timeout;

  // Randomly delay the write to try and avoid simultaneous writes from different tabs
  const randomWait = Math.floor(Math.random() * safetyTimeout);

  // Seems clear, try and acquire
  return new Promise((resolve) => {
    setTimeout(() => {
      // Check for existing lock
      if (readLock(key)) {
        resolve(false);
      } else {
        // Try and acquire the lock
        writeLock(key, [id, expires]);

        // Check we still control the lock after the safetly timeout
        setTimeout(() => {
          const currentLock = readLock(key);

          const stillHasLock =
            currentLock !== null &&
            id === currentLock[0] &&
            expires === currentLock[1];
          resolve(stillHasLock);
        }, safetyTimeout);
      }
    }, randomWait);
  });
}

/**
 * Release a lock.
 */
export function release(key: string): void {
  localStorage.removeItem(key);
}

type Lock = [id: number, expires: number];

function readLock(key: string): Lock | null {
  try {
    const stored = localStorage.getItem(key) ?? "";
    const lock = JSON.parse(stored);
    // Validate lock
    if (
      Array.isArray(lock) &&
      typeof lock[0] === "number" &&
      typeof lock[1] === "number" &&
      Date.now() < lock[1]
    ) {
      // Valid lock exists
      return lock as Lock;
    }
  } catch {}
  return null;
}

function writeLock(key: string, lock: Lock): void {
  localStorage.setItem(key, JSON.stringify(lock));
}
