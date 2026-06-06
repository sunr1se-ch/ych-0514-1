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
  ferment_days?: number;
  status_message?: string;
  last_elasticities?: ElasticityRecord[];
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

export interface BatchDetail {
  batch: Batch;
  temperature_humidity: TemperatureHumidity[];
  elasticity_records: ElasticityRecord[];
  review_records: ReviewRecord[];
  shipment?: Shipment;
}

export interface PendingReviewBatch extends Batch {
  review_count: number;
  last_reviewed_at?: string;
  recent_elasticities: ElasticityRecord[];
  recent_temperature_humidity: TemperatureHumidity[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export const statusLabels: Record<BatchStatus, string> = {
  fermenting: '发酵中',
  pending_review: '待复核',
  approved: '已放行',
  shipped: '已出库',
};

export const statusColors: Record<BatchStatus, string> = {
  fermenting: 'bg-blue-100 text-blue-800',
  pending_review: 'bg-red-100 text-red-800',
  approved: 'bg-green-100 text-green-800',
  shipped: 'bg-gray-100 text-gray-800',
};
