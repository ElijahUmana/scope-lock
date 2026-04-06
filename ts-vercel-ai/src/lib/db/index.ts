import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  // DB is optional — document features disabled without it
  console.warn('DATABASE_URL is not defined — document features disabled');
}

const dbClientPropertyName = `__prevent-name-collision__db`;
type GlobalThisWithDbClient = typeof globalThis & {
  [dbClientPropertyName]: any;
};

const getDbClient = () => {
  if (!process.env.DATABASE_URL) return null;
  if (process.env.NODE_ENV === 'production') {
    const client = postgres(process.env.DATABASE_URL!);
    return drizzle(client);
  } else {
    const newGlobalThis = globalThis as GlobalThisWithDbClient;
    if (!newGlobalThis[dbClientPropertyName]) {
      const client = postgres(process.env.DATABASE_URL!);
      newGlobalThis[dbClientPropertyName] = drizzle(client);
    }
    return newGlobalThis[dbClientPropertyName];
  }
};

export const db = getDbClient();
