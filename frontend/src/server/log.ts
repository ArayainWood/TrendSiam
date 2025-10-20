export function log(tag: string, msg: string, extra?: Record<string, any>) {
  // Keep simple console logs; Render shows them
  console.log(`[${tag}] ${msg}`, extra ?? '');
}
