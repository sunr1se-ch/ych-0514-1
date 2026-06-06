# 雪茄烟叶发酵弹性与放行批次管理系统

烟叶分级站单机系统，用于管理雪茄烟叶发酵过程的质量监控与批次放行。

## 功能特性

- **批次管理**：登记每批烟叶的目标发酵天数，支持发酵进度跟踪
- **温湿度记录**：发酵房每小时记录温度和湿度数据，支持批量导入
- **弹性检测**：弹性仪上报叶脉回弹百分比，记录检测历史和设备信息
- **智能预警**：达到目标发酵天数后，自动检查连续 2 次回弹数据
  - 若连续 2 次回弹均 ≥ 62%，自动转为「已放行」
  - 若连续 2 次回弹均 < 62%，自动转为「待复核」
- **复核管理**：待复核批次醒目提示，支持复核员人工放行
- **出库登记**：仅已放行批次可登记出库
- **数据可视化**：温湿度趋势图（双Y轴）、回弹趋势图（含62%合格线）
- **演示数据**：系统启动时自动生成演示数据，快速体验系统功能

## 核心业务规则

### 待复核触发条件

批次达到目标发酵天数后，系统自动检查最近 2 次回弹检测：

- **连续 2 次均 ≥ 62%** → 自动转为「已放行」状态
- **连续 2 次均 < 62%** → 自动转为「待复核」状态，不得发货

### 待复核期间再次检测的处理方式

> **重要说明**：待复核状态下可继续进行回弹检测，系统会自动重新评估状态：

1. **新增检测后重新评估**：每次新增回弹检测后，系统自动检查最新的连续 2 次检测数据

2. **自动转为已放行**：若最新连续 2 次检测**均 ≥ 62%**，批次自动从「待复核」转为「已放行」状态

3. **保持待复核**：若最新连续 2 次检测**仍有 < 62% 的数据**，批次保持「待复核」状态

4. **人工复核优先**：复核员可在任何时候对「待复核」批次进行人工处理（放行），无需等待自动评估

5. **操作入口**：
   - 批次详情页：「重新检测」按钮 - 系统自动根据最新数据评估状态
   - 批次详情页：「新增弹性检测」按钮 - 手动录入新的检测数据后自动重评
   - 复核待办页：快捷操作按钮，支持批量处理

### 状态流转

```
发酵中 (fermenting)
    ↓
达到目标天数 + 检查最近2次回弹
    ├─ 连续2次≥62% → 已放行 (approved) → 已出库 (shipped)
    └─ 连续2次<62%  → 待复核 (pending_review)
                        ├─ 复核员放行 → 已放行 (approved) → 已出库 (shipped)
                        └─ 期间新增检测 → 若连续2次≥62% → 已放行 (approved)
```

## 技术栈

- **前端**：React 18 + TypeScript + Vite + Tailwind CSS + Zustand + Recharts + Lucide React
- **后端**：Express 4 + TypeScript + better-sqlite3
- **数据库**：SQLite（文件型数据库，无需额外服务）
- **部署**：Docker Compose 单机部署（Nginx + Node.js）

## 快速开始

### 方式一：开发模式

```bash
# 安装依赖
npm install

# 启动前后端开发服务器
npm run dev

# 前端地址: http://localhost:5173
# 后端地址: http://localhost:3001
```

系统首次启动时会自动初始化数据库并生成演示数据。

### 方式二：Docker Compose 部署

```bash
# 先构建前端
npm run build

# 构建并启动服务
docker-compose up -d --build

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

启动后访问：http://localhost

### 重置演示数据

如需重新生成演示数据，删除数据库文件后重启服务即可：

```bash
rm -f data/tobacco.db data/tobacco.db-shm data/tobacco.db-wal
npm run dev
```

演示数据包含 5 个批次，覆盖各种状态：

- 1 个待复核批次（连续回弹低于 62%）
- 2 个发酵中批次
- 1 个已放行批次
- 1 个已出库批次

每个批次包含：

- 完整的小时级温湿度记录（覆盖整个发酵周期）
- 每 3 天一次的弹性检测记录
- 对应的复核和出库记录

## 页面说明

### 1. 批次列表页 (`/`)

- 顶部统计卡片：待复核、发酵中、已放行、已出库数量统计
- 待复核批次醒目红色警示区，突出显示待处理批次
- 批次列表表格，支持按状态筛选
- 待复核批次红色背景高亮显示
- 显示批次基本信息、发酵进度、最近回弹数据
- 点击「查看」进入批次详情页

### 2. 批次详情页 (`/batch/:id`)

- 批次基本信息与发酵进度
- 状态警示条：待复核批次红色醒目提示
- 最近弹性检测结果，低于 62% 红色高亮
- **温湿度折线图**（最近7天，双Y轴显示温度和湿度）
- **回弹趋势图**（含 62% 合格线参考，低于阈值的数据点高亮）
- 复核记录时间线
- 出库信息（如已出库）
- 操作按钮：
  - 刷新状态
  - 新增弹性检测
  - 重新检测（待复核批次）
  - 复核（待复核批次）
  - 登记出库（已放行批次）

### 3. 复核待办页 (`/review`)

- 集中展示所有待复核批次，红色背景高亮
- 批次卡片详细信息：
  - 批次号、烟叶类型、产地
  - 发酵进度、重量、复核次数
  - 最近 5 次弹性检测结果
  - 最近 24 小时温湿度范围
- 快捷操作按钮：
  - 查看详情
  - 新增检测
  - 重新检测（自动重评状态）
  - 复核放行

## 目录结构

```
project/
├── src/                          # 前端源码
│   ├── components/              # 组件
│   │   └── Layout.tsx          # 布局组件
│   ├── pages/                  # 页面
│   │   ├── Home.tsx           # 批次列表页
│   │   ├── BatchDetail.tsx    # 批次详情页
│   │   └── Review.tsx         # 复核待办页
│   ├── store/useBatchStore.ts  # 状态管理
│   ├── api/client.ts           # API 客户端
│   └── types/index.ts          # 类型定义
├── api/                          # 后端源码
│   ├── db/                     # 数据库
│   │   ├── index.ts           # 数据库连接和表结构
│   │   └── seed.ts            # 演示数据脚本
│   ├── services/               # 业务逻辑
│   │   └── batchStatus.ts     # 批次状态判断逻辑
│   ├── routes/                 # API 路由
│   │   ├── batches.ts         # 批次管理
│   │   ├── temperature.ts     # 温湿度记录
│   │   ├── elasticity.ts      # 弹性记录
│   │   └── review.ts          # 复核管理
│   ├── app.ts                  # Express 应用
│   └── server.ts               # 服务器入口
├── data/                        # 数据库文件目录
├── dist/                        # 前端构建产物
├── docker-compose.yml
├── Dockerfile
├── nginx.conf
└── README.md
```

## API 接口

### 批次管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/batches` | 获取批次列表，支持 `?status=pending_review` 筛选 |
| POST | `/api/batches` | 创建批次 |
| GET | `/api/batches/:id` | 获取批次详情（含所有关联数据） |
| PUT | `/api/batches/:id` | 更新批次信息 |
| DELETE | `/api/batches/:id` | 删除批次 |
| POST | `/api/batches/:id/refresh-status` | 刷新批次状态 |
| POST | `/api/batches/:id/shipment` | 批次出库登记 |

### 温湿度记录

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/temperature/batch/:batchId` | 获取批次温湿度记录 |
| POST | `/api/temperature` | 新增温湿度记录 |
| POST | `/api/temperature/batch` | 批量新增温湿度记录 |

### 弹性记录

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/elasticity/batch/:batchId` | 获取批次弹性记录 |
| POST | `/api/elasticity` | 新增弹性记录（自动重评状态） |
| POST | `/api/elasticity/device` | 弹性仪设备上报接口 |
| POST | `/api/elasticity/batch` | 批量新增弹性记录 |

### 复核管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/review/pending` | 获取待复核批次列表 |
| GET | `/api/review/batch/:batchId` | 获取批次复核记录 |
| POST | `/api/review` | 提交复核结果 |
| POST | `/api/review/:id/recheck` | 重新检测评估状态 |

## 数据库表结构

### batches 批次表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| batch_no | TEXT | 批次号（唯一） |
| tobacco_type | TEXT | 烟叶类型 |
| origin | TEXT | 产地 |
| weight_kg | REAL | 重量(kg) |
| target_ferment_days | INTEGER | 目标发酵天数 |
| start_date | TEXT | 开始日期 |
| room_no | TEXT | 发酵房号 |
| status | TEXT | 状态：fermenting/pending_review/approved/shipped |
| notes | TEXT | 备注 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### temperature_humidity 温湿度表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| batch_id | INTEGER | 批次ID（外键） |
| temperature | REAL | 温度(℃) |
| humidity | REAL | 湿度(%) |
| recorded_at | TEXT | 记录时间 |
| created_at | TEXT | 创建时间 |

### elasticity_records 弹性记录表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| batch_id | INTEGER | 批次ID（外键） |
| rebound_percent | REAL | 回弹百分比 |
| device_id | TEXT | 弹性仪设备编号 |
| recorded_at | TEXT | 记录时间 |
| created_at | TEXT | 创建时间 |

### review_records 复核记录表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| batch_id | INTEGER | 批次ID（外键） |
| reviewer | TEXT | 复核员 |
| review_result | TEXT | 复核结果：approved/rejected |
| comments | TEXT | 复核意见 |
| reviewed_at | TEXT | 复核时间 |
| created_at | TEXT | 创建时间 |

### shipments 出库记录表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| batch_id | INTEGER | 批次ID（外键） |
| shipment_date | TEXT | 出库日期 |
| destination | TEXT | 目的地 |
| operator | TEXT | 经办人 |
| notes | TEXT | 备注 |
| created_at | TEXT | 创建时间 |

## 配置说明

### 回弹阈值和检测次数

在 `api/services/batchStatus.ts` 中定义：

```typescript
export const REBOUND_THRESHOLD = 62;        // 回弹合格线百分比
export const CONSECUTIVE_LOW_COUNT = 2;     // 连续低于阈值的检测次数
```

### 端口配置

| 环境 | 前端端口 | 后端端口 | 访问地址 |
|------|----------|----------|----------|
| 开发 | 5173 | 3001 | http://localhost:5173 |
| Docker | 80 (Nginx) | 3001 | http://localhost |

### 数据持久化

SQLite 数据库文件存储在 `data/tobacco.db`，Docker 部署时通过 volume 挂载，确保数据持久化。

## 待复核期间再次检测的处理流程详解

### 场景说明

某批次目标发酵天数 30 天，第 30 天检查最近 2 次回弹：59% 和 60%，均低于 62%，批次转为「待复核」。

### 处理方式

#### 方式一：新增弹性检测

1. 在批次详情页点击「新增弹性检测」
2. 输入新的回弹百分比（例如 65%），提交
3. 系统自动检查最新连续 2 次：60% 和 65%
4. 由于 65% ≥ 62%，但 60% < 62%，不满足连续 2 次 ≥ 62%
5. 批次保持「待复核」状态
6. 再次新增检测，输入 64%
7. 系统检查最新连续 2 次：65% 和 64%，均 ≥ 62%
8. 批次自动转为「已放行」状态

#### 方式二：重新检测

1. 在批次详情页或复核待办页点击「重新检测」
2. 系统自动查询最新的 2 次弹性检测记录
3. 若均 ≥ 62%，自动转为「已放行」
4. 否则保持「待复核」

#### 方式三：人工复核

1. 在批次详情页或复核待办页点击「复核」
2. 输入复核员姓名，选择复核结果
3. 选择「通过 - 准予放行」，提交
4. 批次立即转为「已放行」状态，无需等待自动评估

## 常见问题

### Q: 待复核期间新增检测后状态如何变化？
A: 每次新增回弹检测后，系统自动检查最新的连续 2 次检测。若连续 2 次均 ≥ 62%，批次自动转为「已放行」；否则保持「待复核」状态。

### Q: 复核员可以不等待自动评估直接处理吗？
A: 可以。复核员可随时对「待复核」批次进行人工放行处理。

### Q: 如何批量录入温湿度数据？
A: 调用 `/api/temperature/batch` 接口，支持一次性传入多条记录。支持从发酵房监控系统批量导入。

### Q: 弹性仪设备如何对接？
A: 使用 `/api/elasticity/device` 接口，传入设备编号、批次ID和回弹百分比。系统会自动更新批次状态。

### Q: 数据如何备份？
A: SQLite 为文件型数据库，直接复制 `data/tobacco.db` 文件即可完成备份。建议定期备份。

### Q: 如何修改回弹阈值？
A: 修改 `api/services/batchStatus.ts` 中的 `REBOUND_THRESHOLD` 常量，然后重启服务。

## License

MIT
