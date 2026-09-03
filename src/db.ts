import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Raíz del proyecto, calculada de forma robusta tanto si este módulo se
 * ejecuta desde `src/db.ts` (vía tsx) como desde `dist/db.js` (compilado):
 * en ambos casos la raíz es el directorio padre del archivo actual.
 */
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(projectRoot, 'data');
const dbPath = join(dataDir, 'tareas.db');

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS tareas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    fecha_limite TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'hecha')),
    creada_en TEXT NOT NULL
  );
`);

export interface Tarea {
  id: number;
  titulo: string;
  descripcion: string | null;
  fecha_limite: string | null;
  estado: 'pendiente' | 'hecha';
  creada_en: string;
}
