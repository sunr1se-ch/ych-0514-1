import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', '..', 'data', 'tobacco.db');

export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT UNIQUE NOT NULL,
      tobacco_type TEXT NOT NULL,
      origin TEXT NOT NULL,
      weight_kg REAL NOT NULL,
      target_ferment_days INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      room_no TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'fermenting',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS temperature_humidity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      temperature REAL NOT NULL,
      humidity REAL NOT NULL,
      recorded_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS elasticity_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      rebound_percent REAL NOT NULL,
      recorded_at TEXT NOT NULL,
      device_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS review_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      reviewer TEXT NOT NULL,
      review_result TEXT NOT NULL,
      comments TEXT,
      reviewed_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      shipment_date TEXT NOT NULL,
      destination TEXT NOT NULL,
      operator TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_th_batch ON temperature_humidity(batch_id);
    CREATE INDEX IF NOT EXISTS idx_th_recorded ON temperature_humidity(recorded_at);
    CREATE INDEX IF NOT EXISTS idx_elasticity_batch ON elasticity_records(batch_id);
    CREATE INDEX IF NOT EXISTS idx_elasticity_recorded ON elasticity_records(recorded_at);
    CREATE INDEX IF NOT EXISTS idx_review_batch ON review_records(batch_id);
    CREATE INDEX IF NOT EXISTS idx_batch_status ON batches(status);
  `);
}

export type BatchStatus = 'fermenting' | 'pending_review' | 'approved' | 'shipped';

export interface Batch {
  id: number;
  batch_no: string;
  tobacco_type: string;
  origin: string;
  weight_kg: number;
  target_ferment_days: number;
  start_date: string;
  room_no: string;
  status: BatchStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TemperatureHumidity {
  id: number;
  batch_id: number;
  temperature: number;
  humidity: number;
  recorded_at: string;
  created_at: string;
}

export interface ElasticityRecord {
  id: number;
  batch_id: number;
  rebound_percent: number;
  recorded_at: string;
  device_id?: string;
  created_at: string;
}

export interface ReviewRecord {
  id: number;
  batch_id: number;
  reviewer: string;
  review_result: 'approved' | 'rejected';
  comments?: string;
  reviewed_at: string;
  created_at: string;
}

export interface Shipment {
  id: number;
  batch_id: number;
  shipment_date: string;
  destination: string;
  operator: string;
  notes?: string;
  created_at: string;
}
