import express, { type Request, type Response } from 'express';
import { db } from '../db/index.js';
import type { Batch } from '../db/index.js';
import { updateBatchStatusIfNeeded, checkBatchStatus } from '../services/batchStatus.js';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  const { status } = req.query;

  let query = 'SELECT * FROM batches';
  const params: unknown[] = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  const batches = db.prepare(query).all(...params) as Batch[];

  const batchesWithStatusInfo = batches.map((batch) => {
    const statusInfo = checkBatchStatus(batch.id);
    return {
      ...batch,
      ferment_days: statusInfo.fermentDays,
      status_message: statusInfo.message,
      last_elasticities: statusInfo.lastElasticities,
    };
  });

  res.json({
    success: true,
    data: batchesWithStatusInfo,
  });
});

router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(Number(id)) as Batch;
  if (!batch) {
    res.status(404).json({ success: false, error: '批次不存在' });
    return;
  }

  const statusInfo = checkBatchStatus(Number(id));

  const thRecords = db.prepare(`
    SELECT * FROM temperature_humidity 
    WHERE batch_id = ? 
    ORDER BY recorded_at DESC 
    LIMIT 168
  `).all(Number(id));

  const elasticityRecords = db.prepare(`
    SELECT * FROM elasticity_records 
    WHERE batch_id = ? 
    ORDER BY recorded_at DESC 
    LIMIT 50
  `).all(Number(id));

  const reviewRecords = db.prepare(`
    SELECT * FROM review_records 
    WHERE batch_id = ? 
    ORDER BY reviewed_at DESC
  `).all(Number(id));

  const shipment = db.prepare(`
    SELECT * FROM shipments 
    WHERE batch_id = ? 
    ORDER BY shipment_date DESC 
    LIMIT 1
  `).get(Number(id));

  res.json({
    success: true,
    data: {
      batch: {
        ...batch,
        ferment_days: statusInfo.fermentDays,
        status_message: statusInfo.message,
        last_elasticities: statusInfo.lastElasticities,
      },
      temperature_humidity: thRecords,
      elasticity_records: elasticityRecords,
      review_records: reviewRecords,
      shipment,
    },
  });
});

router.post('/', (req: Request, res: Response) => {
  const {
    batch_no,
    tobacco_type,
    origin,
    weight_kg,
    target_ferment_days,
    start_date,
    room_no,
    notes,
  } = req.body;

  if (
    !batch_no ||
    !tobacco_type ||
    !origin ||
    !weight_kg ||
    !target_ferment_days ||
    !start_date ||
    !room_no
  ) {
    res.status(400).json({ success: false, error: '缺少必要参数' });
    return;
  }

  const existing = db.prepare('SELECT id FROM batches WHERE batch_no = ?').get(batch_no);
  if (existing) {
    res.status(400).json({ success: false, error: '批次号已存在' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO batches (batch_no, tobacco_type, origin, weight_kg, target_ferment_days, start_date, room_no, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    batch_no,
    tobacco_type,
    origin,
    Number(weight_kg),
    Number(target_ferment_days),
    start_date,
    room_no,
    notes || null,
  );

  const newBatch = db.prepare('SELECT * FROM batches WHERE id = ?').get(
    Number(result.lastInsertRowid),
  ) as Batch;

  res.json({
    success: true,
    data: newBatch,
    message: '批次创建成功',
  });
});

router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    batch_no,
    tobacco_type,
    origin,
    weight_kg,
    target_ferment_days,
    start_date,
    room_no,
    notes,
  } = req.body;

  const existing = db.prepare('SELECT * FROM batches WHERE id = ?').get(Number(id)) as Batch;
  if (!existing) {
    res.status(404).json({ success: false, error: '批次不存在' });
    return;
  }

  if (batch_no && batch_no !== existing.batch_no) {
    const duplicate = db.prepare('SELECT id FROM batches WHERE batch_no = ? AND id != ?').get(
      batch_no,
      Number(id),
    );
    if (duplicate) {
      res.status(400).json({ success: false, error: '批次号已存在' });
      return;
    }
  }

  db.prepare(`
    UPDATE batches 
    SET batch_no = ?, tobacco_type = ?, origin = ?, weight_kg = ?, 
        target_ferment_days = ?, start_date = ?, room_no = ?, notes = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    batch_no || existing.batch_no,
    tobacco_type || existing.tobacco_type,
    origin || existing.origin,
    weight_kg !== undefined ? Number(weight_kg) : existing.weight_kg,
    target_ferment_days !== undefined
      ? Number(target_ferment_days)
      : existing.target_ferment_days,
    start_date || existing.start_date,
    room_no || existing.room_no,
    notes !== undefined ? notes : existing.notes,
    Number(id),
  );

  const updatedBatch = db.prepare('SELECT * FROM batches WHERE id = ?').get(Number(id)) as Batch;
  const newStatus = updateBatchStatusIfNeeded(Number(id));

  res.json({
    success: true,
    data: { ...updatedBatch, status: newStatus },
    message: '批次更新成功',
  });
});

router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM batches WHERE id = ?').get(Number(id));
  if (!existing) {
    res.status(404).json({ success: false, error: '批次不存在' });
    return;
  }

  db.prepare('DELETE FROM batches WHERE id = ?').run(Number(id));

  res.json({
    success: true,
    message: '批次删除成功',
  });
});

router.post('/:id/refresh-status', (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM batches WHERE id = ?').get(Number(id)) as Batch;
  if (!existing) {
    res.status(404).json({ success: false, error: '批次不存在' });
    return;
  }

  const newStatus = updateBatchStatusIfNeeded(Number(id));
  const statusInfo = checkBatchStatus(Number(id));

  res.json({
    success: true,
    data: {
      status: newStatus,
      status_message: statusInfo.message,
      ferment_days: statusInfo.fermentDays,
      last_elasticities: statusInfo.lastElasticities,
    },
    message: '状态刷新成功',
  });
});

router.post('/:id/shipment', (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM batches WHERE id = ?').get(Number(id)) as Batch;
  if (!existing) {
    res.status(404).json({ success: false, error: '批次不存在' });
    return;
  }

  if (existing.status !== 'approved') {
    res.status(400).json({ success: false, error: '该批次尚未放行，无法出库' });
    return;
  }

  const { shipment_date, destination, operator, notes } = req.body;

  if (!shipment_date || !destination || !operator) {
    res.status(400).json({ success: false, error: '缺少必要参数' });
    return;
  }

  db.prepare(`
    INSERT INTO shipments (batch_id, shipment_date, destination, operator, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(Number(id), shipment_date, destination, operator, notes || null);

  db.prepare(
    'UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
  ).run('shipped', Number(id));

  res.json({
    success: true,
    message: '出库登记成功',
  });
});

export default router;
