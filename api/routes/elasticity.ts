import express, { type Request, type Response } from 'express';
import { db } from '../db/index.js';
import type { ElasticityRecord, Batch } from '../db/index.js';
import { updateBatchStatusIfNeeded, recheckPendingReviewBatch } from '../services/batchStatus.js';

const router = express.Router();

router.get('/batch/:batchId', (req: Request, res: Response) => {
  const { batchId } = req.params;
  const { limit = '50' } = req.query;

  const existing = db.prepare('SELECT id FROM batches WHERE id = ?').get(Number(batchId));
  if (!existing) {
    res.status(404).json({ success: false, error: '批次不存在' });
    return;
  }

  const records = db.prepare(`
    SELECT * FROM elasticity_records 
    WHERE batch_id = ? 
    ORDER BY recorded_at DESC 
    LIMIT ?
  `).all(Number(batchId), Number(limit)) as ElasticityRecord[];

  res.json({
    success: true,
    data: records,
  });
});

router.post('/', (req: Request, res: Response) => {
  const { batch_id, rebound_percent, recorded_at, device_id } = req.body;

  if (!batch_id || rebound_percent === undefined) {
    res.status(400).json({ success: false, error: '缺少必要参数' });
    return;
  }

  const existing = db.prepare('SELECT * FROM batches WHERE id = ?').get(Number(batch_id)) as Batch;
  if (!existing) {
    res.status(404).json({ success: false, error: '批次不存在' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO elasticity_records (batch_id, rebound_percent, recorded_at, device_id)
    VALUES (?, ?, ?, ?)
  `).run(
    Number(batch_id),
    Number(rebound_percent),
    recorded_at || new Date().toISOString().replace('T', ' ').substring(0, 19),
    device_id || null,
  );

  const newRecord = db.prepare('SELECT * FROM elasticity_records WHERE id = ?').get(
    Number(result.lastInsertRowid),
  );

  const newStatus = updateBatchStatusIfNeeded(Number(batch_id));

  res.json({
    success: true,
    data: {
      record: newRecord,
      new_status: newStatus,
    },
    message: '弹性记录添加成功',
  });
});

router.post('/device', (req: Request, res: Response) => {
  const { device_id, batch_id, rebound_percent, recorded_at } = req.body;

  if (!device_id || !batch_id || rebound_percent === undefined) {
    res.status(400).json({ success: false, error: '缺少必要参数' });
    return;
  }

  const existing = db.prepare('SELECT * FROM batches WHERE id = ?').get(Number(batch_id)) as Batch;
  if (!existing) {
    res.status(404).json({ success: false, error: '批次不存在' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO elasticity_records (batch_id, rebound_percent, recorded_at, device_id)
    VALUES (?, ?, ?, ?)
  `).run(
    Number(batch_id),
    Number(rebound_percent),
    recorded_at || new Date().toISOString().replace('T', ' ').substring(0, 19),
    device_id,
  );

  const newRecord = db.prepare('SELECT * FROM elasticity_records WHERE id = ?').get(
    Number(result.lastInsertRowid),
  );

  let recheckResult = null;
  if (existing.status === 'pending_review') {
    recheckResult = recheckPendingReviewBatch(Number(batch_id));
  } else {
    const newStatus = updateBatchStatusIfNeeded(Number(batch_id));
    recheckResult = { status: newStatus };
  }

  res.json({
    success: true,
    data: {
      record: newRecord,
      recheck_result: recheckResult,
    },
    message: '弹性仪数据上报成功',
  });
});

router.post('/batch', (req: Request, res: Response) => {
  const { records } = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    res.status(400).json({ success: false, error: '请提供记录数组' });
    return;
  }

  const insertStmt = db.prepare(`
    INSERT INTO elasticity_records (batch_id, rebound_percent, recorded_at, device_id)
    VALUES (?, ?, ?, ?)
  `);

  const transaction = db.transaction((recs) => {
    for (const rec of recs) {
      const existing = db.prepare('SELECT id FROM batches WHERE id = ?').get(Number(rec.batch_id));
      if (!existing) {
        throw new Error(`批次 ${rec.batch_id} 不存在`);
      }
      insertStmt.run(
        Number(rec.batch_id),
        Number(rec.rebound_percent),
        rec.recorded_at || new Date().toISOString().replace('T', ' ').substring(0, 19),
        rec.device_id || null,
      );
    }
    return recs.length;
  });

  try {
    const count = transaction(records);

    const affectedBatchIds = [...new Set(records.map((r: { batch_id: number }) => r.batch_id))];
    affectedBatchIds.forEach((batchId) => {
      updateBatchStatusIfNeeded(Number(batchId));
    });

    res.json({
      success: true,
      message: `批量添加了 ${count} 条弹性记录`,
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : '批量插入失败' });
  }
});

export default router;
