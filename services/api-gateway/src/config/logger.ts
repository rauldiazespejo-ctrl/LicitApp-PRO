import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from './env';

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: config.NODE_ENV === 'production' ? prodFormat : devFormat,
  }),
];

if (config.NODE_ENV === 'production') {
  transports.push(
    new DailyRotateFile({
      filename: 'logs/api-gateway-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: prodFormat,
    })
  );
}

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  transports,
  exitOnError: false,
});
