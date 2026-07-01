import { ConnectionOptions } from 'bullmq';
import { REDIS_HOST, REDIS_PORT } from '../config/constants';

export const queueConnection: ConnectionOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null // Required by BullMQ
};
