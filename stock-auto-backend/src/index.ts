import { start, registerShutdownHandlers } from './lifecycle';

registerShutdownHandlers();
start();
