declare module 'node-ipc' {
  export interface IPCConfig {
    id: string;
    retry: number;
    silent: boolean;
  }

  export interface IPCSocket {
    on(event: string, callback: (...args: any[]) => void): void;
    emit(event: string, data: any): void;
  }

  export interface IPCServer {
    on(event: string, callback: (data: any, socket: any) => void): void;
    emit(socket: any, event: string, data: any): void;
    start(): void;
    stop(): void;
  }

  export interface IPC {
    config: IPCConfig;
    of: Record<string, IPCSocket>;
    server: IPCServer;
    connectTo(id: string, callback: () => void): void;
    serve(callback: () => void): void;
  }

  const ipc: IPC;
  export default ipc;
}
