import type {
  Batch,
  BatchDetail,
  TemperatureHumidity,
  ElasticityRecord,
  ReviewRecord,
  PendingReviewBatch,
  ApiResponse,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || data.message || '请求失败');
  }

  return data;
}

export const batchApi = {
  getAll: (status?: string) =>
    request<ApiResponse<Batch[]>>(`/batches${status ? `?status=${status}` : ''}`),

  getById: (id: number) =>
    request<ApiResponse<BatchDetail>>(`/batches/${id}`),

  create: (data: Partial<Batch>) =>
    request<ApiResponse<Batch>>('/batches', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<Batch>) =>
    request<ApiResponse<Batch>>(`/batches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request<ApiResponse<void>>(`/batches/${id}`, {
      method: 'DELETE',
    }),

  refreshStatus: (id: number) =>
    request<ApiResponse<{ status: string; status_message: string }>>(`/batches/${id}/refresh-status`, {
      method: 'POST',
    }),

  createShipment: (id: number, data: { shipment_date: string; destination: string; operator: string; notes?: string }) =>
    request<ApiResponse<void>>(`/batches/${id}/shipment`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const temperatureApi = {
  getByBatch: (batchId: number, limit = 168) =>
    request<ApiResponse<TemperatureHumidity[]>>(`/temperature/batch/${batchId}?limit=${limit}`),

  create: (data: Partial<TemperatureHumidity>) =>
    request<ApiResponse<TemperatureHumidity>>('/temperature', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createBatch: (records: Partial<TemperatureHumidity>[]) =>
    request<ApiResponse<void>>('/temperature/batch', {
      method: 'POST',
      body: JSON.stringify({ records }),
    }),
};

export const elasticityApi = {
  getByBatch: (batchId: number, limit = 50) =>
    request<ApiResponse<ElasticityRecord[]>>(`/elasticity/batch/${batchId}?limit=${limit}`),

  create: (data: Partial<ElasticityRecord>) =>
    request<ApiResponse<{ record: ElasticityRecord; new_status: string }>>('/elasticity', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  reportFromDevice: (data: { device_id: string; batch_id: number; rebound_percent: number; recorded_at?: string }) =>
    request<ApiResponse<{ record: ElasticityRecord; recheck_result: unknown }>>('/elasticity/device', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createBatch: (records: Partial<ElasticityRecord>[]) =>
    request<ApiResponse<void>>('/elasticity/batch', {
      method: 'POST',
      body: JSON.stringify({ records }),
    }),
};

export const reviewApi = {
  getPending: () =>
    request<ApiResponse<PendingReviewBatch[]>>('/review/pending'),

  getByBatch: (batchId: number) =>
    request<ApiResponse<ReviewRecord[]>>(`/review/batch/${batchId}`),

  create: (data: { batch_id: number; reviewer: string; review_result: 'approved' | 'rejected'; comments?: string }) =>
    request<ApiResponse<{ record: ReviewRecord; new_status: string }>>('/review', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  recheck: (id: number) =>
    request<ApiResponse<{ status: string; message: string; last_elasticities: ElasticityRecord[] }>>(`/review/${id}/recheck`, {
      method: 'POST',
    }),
};
