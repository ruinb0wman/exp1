import Dexie from 'dexie';
import type { DB } from './types';
import { migration } from './migrations';

const state: { db: null | ReturnType<typeof createDB> } = {
  db: null
};

export function useDB() {
  const getDB = () => {
    if (state.db) {
      return state.db;
    } else {
      state.db = createDB()
      return state.db;
    }
  }

  return { getDB }
}

const createDB = () => {
  const db = new Dexie('exp') as DB;
  migration(db);

  return db;
};
