/**
 * Type declarations for playwright when not installed
 * This allows TypeScript compilation to succeed when playwright is an optional dependency
 */

declare module 'playwright' {
  export interface Browser {
    newContext(options?: any): Promise<BrowserContext>;
    close(): Promise<void>;
  }
  
  export interface BrowserContext {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }
  
  export interface Page {
    setContent(html: string, options?: any): Promise<void>;
    on(event: string, handler: Function): void;
    waitForFunction(fn: Function, options?: any): Promise<any>;
    waitForTimeout(ms: number): Promise<void>;
    pdf(options?: any): Promise<Buffer>;
    close(): Promise<void>;
  }
  
  export const chromium: {
    launch(options?: any): Promise<Browser>;
  };
}
