import express, { type Request, type Response } from 'express';
import { db } from '../db/index.js';
import type { TemperatureHumidity } from '../db/index.js';
import { updateBatchStatusIfNeeded } from '../services/batchStatus.js';

const router = express.Router();

router.get('/batch/:batchId', (req: Request, res: Response) => {
  const { batchId } = req.params;
  const { limit = '168' } = req.query;

  const existing = db.prepare('SELECT id FROM batches WHERE id = ?').get(Number(batchId));
  if (!existing) {
    res.status(404).json({ success: false, error: '批次不存在' });
    return;
  }

  const records = db.prepare(`
    SELECT * FROM temperature_humidity 
    WHERE batch_id = ? 
    ORDER BY recorded_at DESC 
    LIMIT ?
  `).all(Number(batchId), Number(limit)) as TemperatureHumidity[];

  res.json({
    success: true,
    data: records,
  });
});

router.post('/', (req: Request, res: Response) => {
  const { batch_id, temperature, humidity, recorded_at } = req.body;

  if (!batch_id || temperature === undefined || humidity === undefined) {
    res.status(400).json({ success: false, error: '缺少必要参数' });
    return;
  }

  const existing = db.prepare('SELECT id FROM batches WHERE id = ?').get(Number(batch_id));
  if (!existing) {
    res.status(404).json({ success: false, error: '批次不存在' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO temperature_humidity (batch_id, temperature, humidity, recorded_at)
    VALUES (?, ?, ?, ?)
  `).run(
    Number(batch_id),
    Number(temperature),
    Number(humidity),
    recorded_at || new Date().toISOString().replace('T', ' ').substring(0, 19),
  );

  const newRecord = db.prepare('SELECT * FROM temperature_humidity WHERE id = ?').get(
    Number(result.lastInsertRowid),
  );

  res.json({
    success: true,
    data: newRecord,
    message: '温湿度记录添加成功',
  });
});

router.post('/batch', (req: Request, res: Response) => {
  const { records } = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    res.status(400).json({ success: false, error: '请提供记录数组' });
    return;
  }

  const insertStmt = db.prepare(`
    INSERT INTO temperature_humidity (batch_id, temperature, humidity, recorded_at)
    VALUES (?, ?, ?, ?)
  `);

  const transaction = db.transaction((recs) => {
    for (const rec of recs) {
      const existing = db.prepare('SELECT id FROM batches WHERE id = ?').get(Number(rec.batch_id));
      if (!existing) {
        throw new Error('批次 ' + rec.batch_id + ' 不存在');
      }
      insertStmt.run(
        Number(rec.batch_id),
        Number(rec.temperature),
        Number(rec.humidity),
        rec.recorded_at || new Date().toISOString().replace('T', ' ').substring(0, 19),
      );
    }
    return recs.length;
  });

  try {
    const count = transaction(records);
    res.json({
      success: true,
      message: '批量添加了 ' + count + ' 条温湿度记录',
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : '批量插入失败' });
  }
});

export default router;
