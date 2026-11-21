// Personal offline bookshelf: imported book files live in IndexedDB on this device.
import type { LocalBook } from './types';

const DB = 'pawsage-local';
const STORE = 'books';
let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

const tx = async <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export const allBooks = () => tx<LocalBook[]>('readonly', s => s.getAll() as IDBRequest<LocalBook[]>);
export const getBook = (id: string) => tx<LocalBook | undefined>('readonly', s => s.get(id) as IDBRequest<LocalBook | undefined>);
export const putBook = (b: LocalBook) => tx<IDBValidKey>('readwrite', s => s.put(b));
export const deleteBook = (id: string) => tx<undefined>('readwrite', s => s.delete(id) as IDBRequest<undefined>);

export async function updateProgress(id: string, progress: number, location: string) {
  const b = await getBook(id);
  if (!b) return;
  b.progress = progress; b.location = location; b.lastOpened = Date.now();
  await putBook(b);
}

export function kindOf(name: string): LocalBook['type'] {
  const ext = name.split('.').pop()?.toLowerCase();
  return ext === 'epub' ? 'epub' : ext === 'txt' ? 'txt' : 'pdf';
}

export const prettyTitle = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
