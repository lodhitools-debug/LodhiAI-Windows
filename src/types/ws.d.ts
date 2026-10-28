declare module 'ws' {
  import { EventEmitter } from 'events';
  import { Server as HttpServer, IncomingMessage } from 'http';
  import { Duplex } from 'stream';

  export class WebSocket extends EventEmitter {
    constructor(address: string | URL, protocols?: string | string[], options?: any);
    constructor(address: string | URL, options?: any);
    static readonly CONNECTING: 0;
    static readonly OPEN: 1;
    static readonly CLOSING: 2;
    static readonly CLOSED: 3;
    readonly readyState: number;
    send(data: any, cb?: (err?: Error) => void): void;
    close(code?: number, reason?: string): void;
    terminate(): void;
    ping(data?: any): void;
    on(event: 'open', listener: () => void): this;
    on(event: 'message', listener: (data: any, isBinary: boolean) => void): this;
    on(event: 'close', listener: (code: number, reason: Buffer) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
  }

  export interface ServerOptions {
    server?: HttpServer;
    port?: number;
    noServer?: boolean;
    path?: string;
  }

  export class WebSocketServer extends EventEmitter {
    constructor(options?: ServerOptions);
    clients: Set<WebSocket>;
    close(cb?: (err?: Error) => void): void;
    handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer, callback: (ws: WebSocket) => void): void;
    on(event: 'connection', listener: (socket: WebSocket, request: IncomingMessage) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
  }

  export default WebSocket;
}
