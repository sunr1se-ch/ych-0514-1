import dayjs from 'dayjs';
import { db } from '../db/index.js';
import type { Batch, ElasticityRecord, BatchStatus } from '../db/index.js';

export const REBOUND_THRESHOLD = 62;
export const CONSECUTIVE_LOW_COUNT = 2;

export function checkBatchStatus(batchId: number): {
  shouldReview: boolean;
  canAutoApprove: boolean;
  fermentDays: number;
  lastElasticities: ElasticityRecord[];
  message: string;
} {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId) as Batch;
  if (!batch) {
    throw new Error('批次不存在');
  }

  const startDate = dayjs(batch.start_date);
  const now = dayjs();
  const fermentDays = now.diff(startDate, 'day');

  const elasticities = db.prepare(`
    SELECT * FROM elasticity_records 
    WHERE batch_id = ? 
    ORDER BY recorded_at DESC, id DESC
    LIMIT ?
  `).all(batchId, CONSECUTIVE_LOW_COUNT) as ElasticityRecord[];

  if (fermentDays < batch.target_ferment_days) {
    return {
      shouldReview: false,
      canAutoApprove: false,
      fermentDays,
      lastElasticities: elasticities,
      message: `发酵进行中，已发酵 ${fermentDays}/${batch.target_ferment_days} 天`,
    };
  }

  if (elasticities.length < CONSECUTIVE_LOW_COUNT) {
    return {
      shouldReview: false,
      canAutoApprove: false,
      fermentDays,
      lastElasticities: elasticities,
      message: `已达目标发酵天数（${fermentDays}天），但弹性检测数据不足${CONSECUTIVE_LOW_COUNT}次`,
    };
  }

  const allAboveOrEqual = elasticities.every((e) => e.rebound_percent >= REBOUND_THRESHOLD);
  const allBelowThreshold = elasticities.every((e) => e.rebound_percent < REBOUND_THRESHOLD);

  if (allAboveOrEqual) {
    return {
      shouldReview: false,
      canAutoApprove: true,
      fermentDays,
      lastElasticities: elasticities,
      message: `已达目标发酵天数（${fermentDays}天），连续${CONSECUTIVE_LOW_COUNT}次回弹均≥${REBOUND_THRESHOLD}%，可正常放行`,
    };
  }

  if (allBelowThreshold) {
    return {
      shouldReview: true,
      canAutoApprove: false,
      fermentDays,
      lastElasticities: elasticities,
      message: `已达目标发酵天数（${fermentDays}天），连续${CONSECUTIVE_LOW_COUNT}次回弹低于${REBOUND_THRESHOLD}%，需复核`,
    };
  }

  return {
    shouldReview: true,
    canAutoApprove: false,
    fermentDays,
    lastElasticities: elasticities,
    message: `已达目标发酵天数（${fermentDays}天），最近${CONSECUTIVE_LOW_COUNT}次回弹未全部达标，需复核`,
  };
}

export function updateBatchStatusIfNeeded(batchId: number): string {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId) as Batch;
  if (!batch) {
    throw new Error('批次不存在');
  }

  if (batch.status === 'approved' || batch.status === 'shipped') {
    return batch.status;
  }

  const statusCheck = checkBatchStatus(batchId);

  let newStatus: BatchStatus = batch.status;

  if (statusCheck.canAutoApprove) {
    newStatus = 'approved';
  } else if (statusCheck.shouldReview) {
    newStatus = 'pending_review';
  }

  if (newStatus !== batch.status) {
    db.prepare(
      'UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ).run(newStatus, batchId);
  }

  return newStatus;
}

export function recheckPendingReviewBatch(batchId: number): {
  status: string;
  message: string;
  lastElasticities: ElasticityRecord[];
} {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId) as Batch;
  if (!batch) {
    throw new Error('批次不存在');
  }

  if (batch.status !== 'pending_review') {
    return {
      status: batch.status,
      message: '批次不处于待复核状态',
      lastElasticities: [],
    };
  }

  const statusCheck = checkBatchStatus(batchId);

  if (statusCheck.canAutoApprove) {
    db.prepare(
      'UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ).run('approved', batchId);

    return {
      status: 'approved',
      message: '重新检测后弹性合格，自动转为已放行状态',
      lastElasticities: statusCheck.lastElasticities,
    };
  }

  if (statusCheck.shouldReview) {
    return {
      status: 'pending_review',
      message: statusCheck.message + '，仍需复核',
      lastElasticities: statusCheck.lastElasticities,
    };
  }

  return {
    status: batch.status,
    message: statusCheck.message,
    lastElasticities: statusCheck.lastElasticities,
  };
}
