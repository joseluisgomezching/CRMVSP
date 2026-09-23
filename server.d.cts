import type { Express } from 'express';

declare const server: {
  createApp(): Promise<Express>;
};

export = server;
