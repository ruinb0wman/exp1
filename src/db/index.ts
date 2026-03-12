import Dexie from 'dexie';
import type { DB } from './types';
import { migration } from './migrations';

const state: { db: null | ReturnType<typeof createDB> } = {
  db: null
};

//@ts-ignore
window.dbstate = state;

function getDB() {
  if (state.db) {
    return state.db;
  } else {
    state.db = createDB();
    return state.db;
  }
}

export { getDB };

const createDB = () => {
  const db = new Dexie('exp-v3') as DB;
  migration(db);

  return db;
};
