import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  Truck,
  Activity,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { useBatchStore } from '../store/useBatchStore';
import { statusLabels, statusColors, type BatchStatus } from '../types';

const statusIcons: Record<BatchStatus, React.ElementType> = {
  fermenting: Clock,
  pending_review: AlertTriangle,
  approved: CheckCircle,
  shipped: Truck,
};

export default function Home() {
  const navigate = useNavigate();
  const { batches, loading, error, fetchBatches } = useBatchStore();
  const [statusFilter, setStatusFilter] = useState<BatchStatus | 'all'>('all');
  const [roomFilter, setRoomFilter] = useState<string>('all');

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const filteredBatches = batches.filter((b) => {
    const statusMatch = statusFilter === 'all' || b.status === statusFilter;
    const roomMatch = roomFilter === 'all' || b.room_no === roomFilter;
    return statusMatch && roomMatch;
  });

  const rooms = Array.from(new Set(batches.map((b) => b.room_no))).sort();

  const roomStats = rooms.map((room) => {
    const roomBatches = batches.filter((b) => b.room_no === room);
    return {
      room_no: room,
      fermenting: roomBatches.filter((b) => b.status === 'fermenting').length,
      pending_review: roomBatches.filter((b) => b.status === 'pending_review').length,
    };
  });

  const pendingBatches = batches.filter((b) => b.status === 'pending_review');
  const fermentingBatches = batches.filter((b) => b.status === 'fermenting');
  const approvedBatches = batches.filter((b) => b.status === 'approved');
  const shippedBatches = batches.filter((b) => b.status === 'shipped');

  const stats = [
    {
      label: '待复核',
      count: pendingBatches.length,
      color: 'bg-red-50 border-red-200',
      textColor: 'text-red-600',
      icon: AlertTriangle,
    },
    {
      label: '发酵中',
      count: fermentingBatches.length,
      color: 'bg-blue-50 border-blue-200',
      textColor: 'text-blue-600',
      icon: Clock,
    },
    {
      label: '已放行',
      count: approvedBatches.length,
      color: 'bg-green-50 border-green-200',
      textColor: 'text-green-600',
      icon: CheckCircle,
    },
    {
      label: '已出库',
      count: shippedBatches.length,
      color: 'bg-gray-50 border-gray-200',
      textColor: 'text-gray-600',
      icon: Truck,
    },
  ];

  if (loading && batches.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">批次列表</h1>
          <p className="mt-1 text-sm text-gray-500">
            管理所有烟叶发酵批次，监控温湿度和弹性指标
          </p>
        </div>
        <button
          onClick={() => fetchBatches()}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`border rounded-lg p-4 ${stat.color}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${stat.textColor}`}>
                    {stat.count}
                  </p>
                </div>
                <Icon className={`h-10 w-10 ${stat.textColor} opacity-50`} />
              </div>
            </div>
          );
        })}
      </div>

      {roomStats.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <div className="flex items-center">
              <Package className="h-5 w-5 text-gray-400 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">发酵房概览</h2>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              点击发酵房卡片可快速筛选该房批次
            </p>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {roomStats.map((stat) => {
              const isActive = roomFilter === stat.room_no;
              return (
                <button
                  key={stat.room_no}
                  onClick={() =>
                    setRoomFilter(isActive ? 'all' : stat.room_no)
                  }
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    isActive
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-gray-50 hover:border-green-300 hover:bg-green-50'
                  }`}
                >
                  <div className="text-lg font-bold text-gray-900">
                    {stat.room_no}
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-600 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        发酵中
                      </span>
                      <span className="font-medium text-blue-600">
                        {stat.fermenting}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-red-600 flex items-center">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        待复核
                      </span>
                      <span className="font-medium text-red-600">
                        {stat.pending_review}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {pendingBatches.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="ml-3 flex-1">
              <h3 className="text-lg font-semibold text-red-800">
                ⚠️ 待复核批次提醒
              </h3>
              <p className="text-sm text-red-700 mt-1">
                以下批次已达目标发酵天数，但连续 2 次回弹低于 62%，需复核员确认后方可放行
              </p>
              <div className="mt-3 space-y-2">
                {pendingBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className="bg-white rounded-lg p-3 border border-red-200 flex items-center justify-between"
                  >
                    <div className="flex items-center">
                      <Package className="h-5 w-5 text-red-500 mr-2" />
                      <div>
                        <span className="font-medium text-gray-900">
                          {batch.batch_no}
                        </span>
                        <span className="text-sm text-gray-500 ml-2">
                          {batch.tobacco_type}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-sm text-gray-500">
                          已发酵 {batch.ferment_days}/{batch.target_ferment_days} 天
                        </div>
                        <div className="text-sm text-red-600 font-medium">
                          最近回弹:{' '}
                          {batch.last_elasticities?.map((e) => `${e.rebound_percent}%`).join(', ')}
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/batch/${batch.id}`)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        详情
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center">
              <Package className="h-5 w-5 text-gray-400 mr-2" />
              <h2 className="text-lg font-medium text-gray-900">所有批次</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center">
                <Filter className="h-4 w-4 text-gray-400 mr-2" />
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as BatchStatus | 'all')
                  }
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
                >
                  <option value="all">全部状态</option>
                  <option value="pending_review">待复核</option>
                  <option value="fermenting">发酵中</option>
                  <option value="approved">已放行</option>
                  <option value="shipped">已出库</option>
                </select>
              </div>
              <div className="flex items-center">
                <Package className="h-4 w-4 text-gray-400 mr-2" />
                <select
                  value={roomFilter}
                  onChange={(e) => setRoomFilter(e.target.value)}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
                >
                  <option value="all">全部发酵房</option>
                  {rooms.map((room) => (
                    <option key={room} value={room}>
                      {room}
                    </option>
                  ))}
                </select>
              </div>
              {roomFilter !== 'all' && (
                <button
                  onClick={() => setRoomFilter('all')}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                >
                  清除发酵房筛选
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  批次号
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  烟叶类型
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  产地
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  发酵进度
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  发酵房
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <Package className="h-12 w-12 mx-auto text-gray-300" />
                    <p className="mt-2">暂无批次数据</p>
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch) => {
                  const StatusIcon = statusIcons[batch.status];
                  return (
                    <tr
                      key={batch.id}
                      className={
                        batch.status === 'pending_review'
                          ? 'bg-red-50 hover:bg-red-100'
                          : 'hover:bg-gray-50'
                      }
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {batch.status === 'pending_review' && (
                            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {batch.batch_no}
                            </div>
                            <div className="text-sm text-gray-500">
                              {batch.weight_kg} kg
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {batch.tobacco_type}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {batch.origin}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {batch.ferment_days !== undefined
                            ? `${batch.ferment_days} / ${batch.target_ferment_days} 天`
                            : `${batch.target_ferment_days} 天`}
                        </div>
                        {batch.last_elasticities &&
                          batch.last_elasticities.length > 0 && (
                            <div className="flex items-center mt-1">
                              <Activity className="h-3 w-3 text-gray-400 mr-1" />
                              <span className="text-xs text-gray-500">
                                回弹:{' '}
                                {batch.last_elasticities
                                  .map((e) => `${e.rebound_percent}%`)
                                  .join(', ')}
                              </span>
                            </div>
                          )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {batch.room_no}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[batch.status]}`}
                        >
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusLabels[batch.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => navigate(`/batch/${batch.id}`)}
                          className="text-green-600 hover:text-green-900 inline-flex items-center"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          查看
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
