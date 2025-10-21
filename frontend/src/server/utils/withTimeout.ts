export async function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  onTimeout?: () => void
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => {
      onTimeout?.();
      rej(new Error(`timeout after ${ms}ms`));
    }, ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
