import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  MapPin,
  Calendar,
  Thermometer,
  Activity,
  FileText,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Clock,
  Truck,
  Eye,
  Users,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
} from 'recharts';
import dayjs from 'dayjs';
import { useBatchStore } from '../store/useBatchStore';
import { statusLabels, statusColors, type BatchStatus } from '../types';
import { reviewApi, elasticityApi } from '../api/client';

const REBOUND_THRESHOLD = 62;

const statusIcons: Record<BatchStatus, React.ElementType | null> = {
  fermenting: Clock,
  pending_review: AlertTriangle,
  approved: CheckCircle,
  shipped: Truck,
};

export default function BatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    batches,
    currentBatch,
    loading,
    error,
    fetchBatches,
    fetchBatchDetail,
    clearCurrentBatch,
    refreshBatchStatus,
    createShipment,
  } = useBatchStore();

  const [showShipmentModal, setShowShipmentModal] = useState(false);
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
  const [shipmentForm, setShipmentForm] = useState({
    shipment_date: dayjs().format('YYYY-MM-DD'),
    destination: '',
    operator: '',
    notes: '',
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchBatchDetail(Number(id));
      fetchBatches();
    }
    return () => {
      clearCurrentBatch();
    };
  }, [id, fetchBatchDetail, fetchBatches, clearCurrentBatch]);

  const sameRoomBatches = currentBatch
    ? batches.filter(
        (b) =>
          b.room_no === currentBatch.batch.room_no &&
          b.id !== currentBatch.batch.id &&
          b.status !== 'shipped',
      )
    : [];

  if (loading && !currentBatch) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-green-600" />
        <span className="ml-2 text-gray-600">加载中...</span>
      </div>
    );
  }

  if (!currentBatch) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto" />
        <p className="mt-4 text-gray-500">批次不存在</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 text-green-600 hover:text-green-900"
        >
          返回列表
        </button>
      </div>
    );
  }

  const { batch, temperature_humidity, elasticity_records, review_records, shipment } =
    currentBatch;

  const thData = temperature_humidity
    .slice()
    .sort(
      (a, b) =>
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    )
    .slice(-168)
    .map((th) => ({
      time: dayjs(th.recorded_at).format('MM-DD HH:mm'),
      temperature: th.temperature,
      humidity: th.humidity,
    }));

  const elasticityData = elasticity_records
    .slice()
    .sort(
      (a, b) =>
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    )
    .map((er) => ({
      time: dayjs(er.recorded_at).format('MM-DD HH:mm'),
      rebound_percent: er.rebound_percent,
    }));

  const handleReview = async () => {
    if (reviewForm.reviewer.trim() === '') {
      setActionError('请输入复核员姓名');
      return;
    }

    setActionLoading(true);
    setActionError(null);

    try {
      await reviewApi.create({
        batch_id: batch.id,
        reviewer: reviewForm.reviewer,
        review_result: reviewForm.review_result,
        comments: reviewForm.comments || undefined,
      });
      await fetchBatchDetail(Number(id));
      setShowReviewModal(false);
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

    setActionLoading(true);
    setActionError(null);

    try {
      await elasticityApi.create({
        batch_id: batch.id,
        rebound_percent: Number(elasticityForm.rebound_percent),
        device_id: elasticityForm.device_id || undefined,
      });
      await fetchBatchDetail(Number(id));
      setShowElasticityModal(false);
      setElasticityForm({ rebound_percent: '', device_id: '' });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '添加弹性记录失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleShipment = async () => {
    if (
      shipmentForm.destination.trim() === '' ||
      shipmentForm.operator.trim() === ''
    ) {
      setActionError('请填写完整的出库信息');
      return;
    }

    setActionLoading(true);
    setActionError(null);

    try {
      await createShipment(Number(id), shipmentForm);
      setShowShipmentModal(false);
      setShipmentForm({
        shipment_date: dayjs().format('YYYY-MM-DD'),
        destination: '',
        operator: '',
        notes: '',
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '出库登记失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecheck = async () => {
    setActionLoading(true);
    setActionError(null);

    try {
      await reviewApi.recheck(Number(id));
      await fetchBatchDetail(Number(id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '重新检测失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    try {
      await refreshBatchStatus(Number(id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '刷新状态失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/')}
            className="mr-4 text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              批次详情 - {batch.batch_no}
            </h1>
            <p className="mt-1 text-sm text-gray-500">{batch.tobacco_type}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefreshStatus}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            刷新状态
          </button>
          {batch.status === 'approved' && !shipment && (
            <button
              onClick={() => setShowShipmentModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none"
            >
              <Truck className="h-4 w-4 mr-2" />
              登记出库
            </button>
          )}
          {batch.status === 'pending_review' && (
            <>
              <button
                onClick={() => setShowElasticityModal(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                <Activity className="h-4 w-4 mr-2" />
                新增弹性检测
              </button>
              <button
                onClick={handleRecheck}
                disabled={actionLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                重新检测
              </button>
              <button
                onClick={() => setShowReviewModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                复核
              </button>
            </>
          )}
        </div>
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

      {batch.status === 'pending_review' && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0" />
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-red-800">
                警告：待复核状态
              </h3>
              <p className="text-sm text-red-700 mt-1">
                {batch.status_message}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Package className="h-5 w-5 mr-2 text-gray-400" />
              批次信息
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">批次号</span>
                <span className="text-sm font-medium text-gray-900">
                  {batch.batch_no}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">状态</span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[batch.status]}`}
                >
                  {statusLabels[batch.status]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">烟叶类型</span>
                <span className="text-sm text-gray-900">
                  {batch.tobacco_type}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 flex items-center">
                  <MapPin className="h-4 w-4 mr-1" />
                  产地
                </span>
                <span className="text-sm text-gray-900">{batch.origin}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">重量</span>
                <span className="text-sm text-gray-900">{batch.weight_kg} kg</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  发酵房
                </span>
                <span className="text-sm text-gray-900">{batch.room_no}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  发酵天数
                </span>
                <span className="text-sm text-gray-900">
                  {batch.ferment_days}/{batch.target_ferment_days} 天
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">开始日期</span>
                <span className="text-sm text-gray-900">{batch.start_date}</span>
              </div>
            </div>
            {batch.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">备注</p>
                <p className="text-sm text-gray-900 mt-1">{batch.notes}</p>
              </div>
            )}
          </div>

          {batch.last_elasticities && batch.last_elasticities.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Activity className="h-5 w-5 mr-2 text-gray-400" />
                最近弹性检测
              </h2>
              <div className="space-y-2">
                {batch.last_elasticities.map((el, idx) => (
                  <div
                    key={idx}
                    className={`flex justify-between items-center p-2 rounded ${
                      el.rebound_percent < REBOUND_THRESHOLD
                        ? 'bg-red-50'
                        : 'bg-green-50'
                    }`}
                  >
                    <span className="text-sm text-gray-600">
                      {dayjs(el.recorded_at).format('MM-DD HH:mm')}
                    </span>
                    <span
                      className={`font-medium ${
                        el.rebound_percent < REBOUND_THRESHOLD
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}
                    >
                      {el.rebound_percent}%
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-500">
                合格阈值: ≥ {REBOUND_THRESHOLD}%
              </p>
            </div>
          )}

          {shipment && (
            <div className="bg-gray-50 shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Truck className="h-5 w-5 mr-2 text-gray-400" />
                出库信息
              </h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">出库日期</span>
                  <span className="text-sm text-gray-900">
                    {shipment.shipment_date}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">目的地</span>
                  <span className="text-sm text-gray-900">
                    {shipment.destination}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">经办人</span>
                  <span className="text-sm text-gray-900">
                    {shipment.operator}
                  </span>
                </div>
                {shipment.notes && (
                  <div>
                    <span className="text-sm text-gray-500">备注</span>
                    <p className="text-sm text-gray-900">{shipment.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {sameRoomBatches.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Users className="h-5 w-5 mr-2 text-gray-400" />
                {batch.room_no} 其他批次
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({sameRoomBatches.length} 个)
                </span>
              </h2>
              <p className="text-sm text-gray-500 mb-3">
                同发酵房、尚未出库的其他批次
              </p>
              <div className="space-y-2">
                {sameRoomBatches.map((b) => {
                  const StatusIcon = statusIcons[b.status];
                  return (
                    <button
                      key={b.id}
                      onClick={() => navigate(`/batch/${b.id}`)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-green-300 transition-colors text-left"
                    >
                      <div className="flex items-center">
                        <Package className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900">
                          {b.batch_no}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[b.status]}`}
                        >
                          {StatusIcon && (
                            <StatusIcon className="h-3 w-3 mr-1" />
                          )}
                          {statusLabels[b.status]}
                        </span>
                        <Eye className="h-4 w-4 text-gray-400" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Thermometer className="h-5 w-5 mr-2 text-gray-400" />
              温湿度记录（最近7天）
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={thData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="temperature"
                    stroke="#ef4444"
                    name="温度 (℃)"
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="humidity"
                    stroke="#3b82f6"
                    name="湿度 (%)"
                    dot={false}
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-gray-400" />
              回弹百分比记录
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={elasticityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                  <YAxis domain={[40, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine
                    y={REBOUND_THRESHOLD}
                    stroke="#ef4444"
                    strokeDasharray="5 5"
                    label={{
                      value: `合格线 ${REBOUND_THRESHOLD}%`,
                      position: 'right',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rebound_percent"
                    stroke="#10b981"
                    name="回弹 (%)"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {review_records.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-gray-400" />
                复核记录
              </h2>
              <div className="space-y-3">
                {review_records.map((record) => (
                  <div
                    key={record.id}
                    className={`border rounded-lg p-4 ${
                      record.review_result === 'approved'
                        ? 'border-green-200 bg-green-50'
                        : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center">
                        {record.review_result === 'approved' ? (
                          <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900">
                            {record.reviewer}
                          </p>
                          <p className="text-sm text-gray-500">
                            {dayjs(record.reviewed_at).format(
                              'YYYY-MM-DD HH:mm',
                            )}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          record.review_result === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {record.review_result === 'approved' ? '通过' : '不通过'}
                      </span>
                    </div>
                    {record.comments && (
                      <p className="mt-2 text-sm text-gray-600">
                        {record.comments}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showReviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              复核批次
            </h3>
            {actionError && (
              <div className="mb-4 text-sm text-red-600">{actionError}</div>
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
                    setReviewForm({ ...reviewForm, reviewer: e.target.value })
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
                      review_result: e.target.value as 'approved' | 'rejected',
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
                    setReviewForm({ ...reviewForm, comments: e.target.value })
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
              <div className="mb-4 text-sm text-red-600">{actionError}</div>
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

      {showShipmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              登记出库
            </h3>
            {actionError && (
              <div className="mb-4 text-sm text-red-600">{actionError}</div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  出库日期
                </label>
                <input
                  type="date"
                  value={shipmentForm.shipment_date}
                  onChange={(e) =>
                    setShipmentForm({
                      ...shipmentForm,
                      shipment_date: e.target.value,
                    })
                  }
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  目的地
                </label>
                <input
                  type="text"
                  value={shipmentForm.destination}
                  onChange={(e) =>
                    setShipmentForm({
                      ...shipmentForm,
                      destination: e.target.value,
                    })
                  }
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                  placeholder="请输入目的地"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  经办人
                </label>
                <input
                  type="text"
                  value={shipmentForm.operator}
                  onChange={(e) =>
                    setShipmentForm({
                      ...shipmentForm,
                      operator: e.target.value,
                    })
                  }
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                  placeholder="请输入经办人姓名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  备注
                </label>
                <textarea
                  value={shipmentForm.notes}
                  onChange={(e) =>
                    setShipmentForm({
                      ...shipmentForm,
                      notes: e.target.value,
                    })
                  }
                  rows={2}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                  placeholder="请输入备注（可选）"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowShipmentModal(false);
                  setActionError(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                取消
              </button>
              <button
                onClick={handleShipment}
                disabled={actionLoading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none disabled:opacity-50"
              >
                {actionLoading ? '提交中...' : '确认出库'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
