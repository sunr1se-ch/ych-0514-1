import { create } from 'zustand';
import type { Batch, BatchDetail, PendingReviewBatch } from '../types';
import { batchApi, reviewApi } from '../api/client';

interface BatchState {
  batches: Batch[];
  pendingBatches: PendingReviewBatch[];
  currentBatch: BatchDetail | null;
  loading: boolean;
  error: string | null;
  fetchBatches: (status?: string) => Promise<void>;
  fetchPendingBatches: () => Promise<void>;
  fetchBatchDetail: (id: number) => Promise<void>;
  createBatch: (data: Partial<Batch>) => Promise<Batch>;
  updateBatch: (id: number, data: Partial<Batch>) => Promise<void>;
  deleteBatch: (id: number) => Promise<void>;
  refreshBatchStatus: (id: number) => Promise<void>;
  createShipment: (
    id: number,
    data: { shipment_date: string; destination: string; operator: string; notes?: string },
  ) => Promise<void>;
  clearCurrentBatch: () => void;
  clearError: () => void;
}

export const useBatchStore = create<BatchState>((set, get) => ({
  batches: [],
  pendingBatches: [],
  currentBatch: null,
  loading: false,
  error: null,

  fetchBatches: async (status?: string) => {
    set({ loading: true, error: null });
    try {
      const response = await batchApi.getAll(status);
      set({ batches: response.data || [], loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '获取批次列表失败',
        loading: false,
      });
    }
  },

  fetchPendingBatches: async () => {
    set({ loading: true, error: null });
    try {
      const response = await reviewApi.getPending();
      set({ pendingBatches: response.data || [], loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '获取待复核列表失败',
        loading: false,
      });
    }
  },

  fetchBatchDetail: async (id: number) => {
    set({ loading: true, error: null });
    try {
      const response = await batchApi.getById(id);
      set({ currentBatch: response.data || null, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '获取批次详情失败',
        loading: false,
      });
    }
  },

  createBatch: async (data: Partial<Batch>) => {
    set({ loading: true, error: null });
    try {
      const response = await batchApi.create(data);
      await get().fetchBatches();
      set({ loading: false });
      return response.data as Batch;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '创建批次失败',
        loading: false,
      });
      throw error;
    }
  },

  updateBatch: async (id: number, data: Partial<Batch>) => {
    set({ loading: true, error: null });
    try {
      await batchApi.update(id, data);
      await Promise.all([get().fetchBatches(), get().fetchBatchDetail(id)]);
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '更新批次失败',
        loading: false,
      });
      throw error;
    }
  },

  deleteBatch: async (id: number) => {
    set({ loading: true, error: null });
    try {
      await batchApi.delete(id);
      await get().fetchBatches();
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '删除批次失败',
        loading: false,
      });
      throw error;
    }
  },

  refreshBatchStatus: async (id: number) => {
    set({ loading: true, error: null });
    try {
      await batchApi.refreshStatus(id);
      await Promise.all([get().fetchBatches(), get().fetchBatchDetail(id)]);
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '刷新状态失败',
        loading: false,
      });
      throw error;
    }
  },

  createShipment: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await batchApi.createShipment(id, data);
      await Promise.all([get().fetchBatches(), get().fetchBatchDetail(id)]);
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '出库登记失败',
        loading: false,
      });
      throw error;
    }
  },

  clearCurrentBatch: () => {
    set({ currentBatch: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
