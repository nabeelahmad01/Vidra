import { ConnectionOptions } from 'bullmq';
import { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_TLS } from '../config/constants';

export const queueConnection: ConnectionOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  username: 'default', // Required by Upstash Redis ACL
  maxRetriesPerRequest: null, // Required by BullMQ
  ...(REDIS_PASSWORD ? { password: REDIS_PASSWORD } : {}),
  ...(REDIS_TLS ? { tls: {} } : {})
};
