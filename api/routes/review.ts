import express, { type Request, type Response } from 'express';
import { db } from '../db/index.js';
import type { ReviewRecord, Batch } from '../db/index.js';
import { checkBatchStatus, recheckPendingReviewBatch } from '../services/batchStatus.js';

const router = express.Router();

router.get('/pending', (req: Request, res: Response) => {
  const pendingBatches = db.prepare(`
    SELECT b.*, 
           (SELECT COUNT(*) FROM review_records r WHERE r.batch_id = b.id) as review_count,
           (SELECT MAX(reviewed_at) FROM review_records r WHERE r.batch_id = b.id) as last_reviewed_at
    FROM batches b 
    WHERE b.status = 'pending_review'
    ORDER BY b.updated_at DESC
  `).all();

  const batchesWithDetails = pendingBatches.map((batch) => {
    const typedBatch = batch as Batch;
    const statusInfo = checkBatchStatus(typedBatch.id);
    const elasticities = db.prepare(`
      SELECT * FROM elasticity_records 
      WHERE batch_id = ? 
      ORDER BY recorded_at DESC 
      LIMIT 5
    `).all(typedBatch.id);

    const thRecords = db.prepare(`
      SELECT * FROM temperature_humidity 
      WHERE batch_id = ? 
      ORDER BY recorded_at DESC 
      LIMIT 24
    `).all(typedBatch.id);

    return {
      ...typedBatch,
      ferment_days: statusInfo.fermentDays,
      status_message: statusInfo.message,
      last_elasticities: statusInfo.lastElasticities,
      recent_elasticities: elasticities,
      recent_temperature_humidity: thRecords,
    };
  });

  res.json({
    success: true,
    data: batchesWithDetails,
  });
});

router.get('/batch/:batchId', (req: Request, res: Response) => {
  const { batchId } = req.params;

  const existing = db.prepare('SELECT id FROM batches WHERE id = ?').get(Number(batchId));
  if (!existing) {
    res.status(404).json({ success: false, error: '批次不存在' });
    return;
  }

  const records = db.prepare(`
    SELECT * FROM review_records 
    WHERE batch_id = ? 
    ORDER BY reviewed_at DESC
  `).all(Number(batchId)) as ReviewRecord[];

  res.json({
    success: true,
    data: records,
  });
});

router.post('/', (req: Request, res: Response) => {
  const { batch_id, reviewer, review_result, comments } = req.body;

  if (!batch_id || !reviewer || !review_result) {
    res.status(400).json({ success: false, error: '缺少必要参数' });
    return;
  }

  if (!['approved', 'rejected'].includes(review_result)) {
    res.status(400).json({ success: false, error: '复核结果只能是 approved 或 rejected' });
    return;
  }

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(Number(batch_id));
  if (!batch) {
    res.status(404).json({ success: false, error: '批次不存在' });
    return;
  }

  if ((batch as { status: string }).status === 'shipped') {
    res.status(400).json({ success: false, error: '该批次已出库，无法复核' });
    return;
  }

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const result = db.prepare(`
    INSERT INTO review_records (batch_id, reviewer, review_result, comments, reviewed_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    Number(batch_id),
    reviewer,
    review_result,
    comments || null,
    now,
  );

  if (review_result === 'approved') {
    db.prepare(
      'UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ).run('approved', Number(batch_id));
  }

  const newRecord = db.prepare('SELECT * FROM review_records WHERE id = ?').get(
    Number(result.lastInsertRowid),
  );

  res.json({
    success: true,
    data: {
      record: newRecord,
      new_status: review_result === 'approved' ? 'approved' : (batch as { status: string }).status,
    },
    message: review_result === 'approved' ? '复核通过，批次已放行' : '复核不通过',
  });
});

router.post('/:id/recheck', (req: Request, res: Response) => {
  const { id } = req.params;

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(Number(id));
  if (!batch) {
    res.status(404).json({ success: false, error: '批次不存在' });
    return;
  }

  if ((batch as { status: string }).status !== 'pending_review') {
    res.status(400).json({ success: false, error: '该批次不处于待复核状态' });
    return;
  }

  const result = recheckPendingReviewBatch(Number(id));

  res.json({
    success: true,
    data: {
      status: result.status,
      message: result.message,
      last_elasticities: result.lastElasticities,
    },
  });
});

export default router;
