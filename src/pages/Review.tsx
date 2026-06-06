import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  Eye,
  RefreshCw,
  Package,
  MapPin,
  Clock,
  Activity,
  Thermometer,
  Droplets,
  FileText,
  User,
} from 'lucide-react';
import dayjs from 'dayjs';
import { useBatchStore } from '../store/useBatchStore';
import { reviewApi, elasticityApi } from '../api/client';
import { statusLabels, statusColors } from '../types';

const REBOUND_THRESHOLD = 62;

export default function Review() {
  const navigate = useNavigate();
  const { pendingBatches, loading, error, fetchPendingBatches } = useBatchStore();
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showElasticityModal, setShowElasticityModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    reviewer: '',
    review_result: 'approved' as 'approved' | 'rejected',
    comments: '',
  });
  const [elasticityForm, setElasticityForm] = useState({
    rebound_percent: '',
    device_id: '',
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingBatches();
  }, [fetchPendingBatches]);

  const handleReview = async () => {
    if (reviewForm.reviewer.trim() === '') {
      setActionError('请输入复核员姓名');
      return;
    }

    if (!selectedBatch) return;

    setActionLoading(true);
    setActionError(null);

    try {
      await reviewApi.create({
        batch_id: selectedBatch,
        reviewer: reviewForm.reviewer,
        review_result: reviewForm.review_result,
        comments: reviewForm.comments || undefined,
      });
      await fetchPendingBatches();
      setShowReviewModal(false);
      setSelectedBatch(null);
      setReviewForm({ reviewer: '', review_result: 'approved', comments: '' });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '复核失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddElasticity = async () => {
    if (!elasticityForm.rebound_percent) {
      setActionError('请输入回弹百分比');
      return;
    }

    if (!selectedBatch) return;

    setActionLoading(true);
    setActionError(null);

    try {
      await elasticityApi.create({
        batch_id: selectedBatch,
        rebound_percent: Number(elasticityForm.rebound_percent),
        device_id: elasticityForm.device_id || undefined,
      });
      await fetchPendingBatches();
      setShowElasticityModal(false);
      setElasticityForm({ rebound_percent: '', device_id: '' });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '添加弹性记录失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecheck = async (batchId: number) => {
    setActionLoading(true);
    setActionError(null);

    try {
      await reviewApi.recheck(batchId);
      await fetchPendingBatches();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '重新检测失败');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && pendingBatches.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-green-600" />
        <span className="ml-2 text-gray-600">加载中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">复核待办</h1>
          <p className="mt-1 text-sm text-gray-500">
            处理待复核批次，确认放行或要求继续发酵
          </p>
        </div>
        <button
          onClick={() => fetchPendingBatches()}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{actionError}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
            <h2 className="text-lg font-medium text-gray-900">
              待复核批次
              {pendingBatches.length > 0 && (
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  {pendingBatches.length} 条待处理
                </span>
              )}
            </h2>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            以下批次已达目标发酵天数，但连续 2 次回弹低于 {REBOUND_THRESHOLD}%，需复核员确认
          </p>
        </div>

        {pendingBatches.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <CheckCircle className="h-16 w-16 text-green-400 mx-auto" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              暂无待复核批次
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              所有批次状态正常，无需复核
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {pendingBatches.map((batch) => (
              <div
                key={batch.id}
                className="p-4 sm:p-6 bg-red-50 hover:bg-red-100 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between sm:items-start">
                      <div className="flex items-center">
                        <Package className="h-6 w-6 text-red-500 mr-3" />
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            {batch.batch_no}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {batch.tobacco_type}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[batch.status]}`}
                      >
                        {statusLabels[batch.status]}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white rounded-lg p-3">
                        <div className="flex items-center text-sm text-gray-500">
                          <MapPin className="h-4 w-4 mr-1" />
                          产地
                        </div>
                        <p className="mt-1 text-sm font-medium text-gray-900">
                          {batch.origin}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="flex items-center text-sm text-gray-500">
                          <Clock className="h-4 w-4 mr-1" />
                          发酵天数
                        </div>
                        <p className="mt-1 text-sm font-medium text-gray-900">
                          {batch.ferment_days}/{batch.target_ferment_days} 天
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="flex items-center text-sm text-gray-500">
                          <Package className="h-4 w-4 mr-1" />
                          重量
                        </div>
                        <p className="mt-1 text-sm font-medium text-gray-900">
                          {batch.weight_kg} kg
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="flex items-center text-sm text-gray-500">
                          <FileText className="h-4 w-4 mr-1" />
                          复核次数
                        </div>
                        <p className="mt-1 text-sm font-medium text-gray-900">
                          {batch.review_count} 次
                        </p>
                      </div>
                    </div>

                    {batch.recent_elasticities.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                          <Activity className="h-4 w-4 mr-1" />
                          最近弹性检测
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {batch.recent_elasticities.slice(0, 5).map((el, idx) => (
                            <div
                              key={idx}
                              className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${
                                el.rebound_percent < REBOUND_THRESHOLD
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              <span>{dayjs(el.recorded_at).format('MM-DD HH:mm')}</span>
                              <span className="ml-2 font-bold">
                                {el.rebound_percent}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {batch.recent_temperature_humidity.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                          <Thermometer className="h-4 w-4 mr-1" />
                          最近温湿度（最近24小时）
                        </h4>
                        <div className="bg-white rounded-lg p-3">
                          <div className="flex flex-wrap gap-4 text-sm">
                            <div className="flex items-center">
                              <Thermometer className="h-4 w-4 text-red-500 mr-1" />
                              <span className="text-gray-500">温度范围:</span>
                              <span className="ml-1 font-medium text-gray-900">
                                {Math.min(
                                  ...batch.recent_temperature_humidity.map(
                                    (t) => t.temperature,
                                  ),
                                ).toFixed(1)}
                                ℃ ~{' '}
                                {Math.max(
                                  ...batch.recent_temperature_humidity.map(
                                    (t) => t.temperature,
                                  ),
                                ).toFixed(1)}
                                ℃
                              </span>
                            </div>
                            <div className="flex items-center">
                              <Droplets className="h-4 w-4 text-blue-500 mr-1" />
                              <span className="text-gray-500">湿度范围:</span>
                              <span className="ml-1 font-medium text-gray-900">
                                {Math.min(
                                  ...batch.recent_temperature_humidity.map(
                                    (t) => t.humidity,
                                  ),
                                ).toFixed(1)}
                                % ~{' '}
                                {Math.max(
                                  ...batch.recent_temperature_humidity.map(
                                    (t) => t.humidity,
                                  ),
                                ).toFixed(1)}
                                %
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2 lg:min-w-[200px]">
                    <button
                      onClick={() => navigate(`/batch/${batch.id}`)}
                      className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      查看详情
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBatch(batch.id);
                        setShowElasticityModal(true);
                      }}
                      className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                    >
                      <Activity className="h-4 w-4 mr-2" />
                      新增检测
                    </button>
                    <button
                      onClick={() => handleRecheck(batch.id)}
                      disabled={actionLoading}
                      className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      重新检测
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBatch(batch.id);
                        setShowReviewModal(true);
                      }}
                      className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      复核放行
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showReviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              复核批次
            </h3>
            {actionError && (
              <div className="mb-4 text-sm text-red-600">
                {actionError}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  复核员
                </label>
                <input
                  type="text"
                  value={reviewForm.reviewer}
                  onChange={(e) =>
                    setReviewForm({
                      ...reviewForm,
                      reviewer: e.target.value,
                    })
                  }
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                  placeholder="请输入复核员姓名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  复核结果
                </label>
                <select
                  value={reviewForm.review_result}
                  onChange={(e) =>
                    setReviewForm({
                      ...reviewForm,
                      review_result: e.target.value as
                        | 'approved'
                        | 'rejected',
                    })
                  }
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                >
                  <option value="approved">通过 - 准予放行</option>
                  <option value="rejected">不通过 - 需继续发酵</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  复核意见
                </label>
                <textarea
                  value={reviewForm.comments}
                  onChange={(e) =>
                    setReviewForm({
                      ...reviewForm,
                      comments: e.target.value,
                    })
                  }
                  rows={3}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                  placeholder="请输入复核意见（可选）"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setSelectedBatch(null);
                  setActionError(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                取消
              </button>
              <button
                onClick={handleReview}
                disabled={actionLoading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none disabled:opacity-50"
              >
                {actionLoading ? '提交中...' : '确认复核'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showElasticityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              新增弹性检测
            </h3>
            {actionError && (
              <div className="mb-4 text-sm text-red-600">
                {actionError}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  回弹百分比
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={elasticityForm.rebound_percent}
                  onChange={(e) =>
                    setElasticityForm({
                      ...elasticityForm,
                      rebound_percent: e.target.value,
                    })
                  }
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                  placeholder="请输入回弹百分比"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  设备编号
                </label>
                <input
                  type="text"
                  value={elasticityForm.device_id}
                  onChange={(e) =>
                    setElasticityForm({
                      ...elasticityForm,
                      device_id: e.target.value,
                    })
                  }
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                  placeholder="请输入设备编号（可选）"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowElasticityModal(false);
                  setSelectedBatch(null);
                  setActionError(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                取消
              </button>
              <button
                onClick={handleAddElasticity}
                disabled={actionLoading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none disabled:opacity-50"
              >
                {actionLoading ? '提交中...' : '确认提交'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
