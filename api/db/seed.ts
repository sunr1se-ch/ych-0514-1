import dayjs from 'dayjs';
import { db, initDatabase } from './index.js';

export function seedDemoData() {
  const existingBatch = db.prepare('SELECT COUNT(*) as count FROM batches').get() as { count: number };
  if (existingBatch.count > 0) {
    console.log('数据已存在，跳过演示数据插入');
    return;
  }

  console.log('开始插入演示数据...');

  const insertBatch = db.prepare(`
    INSERT INTO batches (batch_no, tobacco_type, origin, weight_kg, target_ferment_days, start_date, room_no, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTH = db.prepare(`
    INSERT INTO temperature_humidity (batch_id, temperature, humidity, recorded_at)
    VALUES (?, ?, ?, ?)
  `);

  const insertElasticity = db.prepare(`
    INSERT INTO elasticity_records (batch_id, rebound_percent, recorded_at, device_id)
    VALUES (?, ?, ?, ?)
  `);

  const insertReview = db.prepare(`
    INSERT INTO review_records (batch_id, reviewer, review_result, comments, reviewed_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertShipment = db.prepare(`
    INSERT INTO shipments (batch_id, shipment_date, destination, operator, notes)
    VALUES (?, ?, ?, ?, ?)
  `);

  const now = dayjs();

  const batches = [
    {
      batch_no: 'YC20260501001',
      tobacco_type: '古巴雪茄烟叶',
      origin: '古巴比那尔德里奥',
      weight_kg: 500,
      target_ferment_days: 30,
      start_date: now.subtract(35, 'day').format('YYYY-MM-DD'),
      room_no: 'A-01',
      status: 'pending_review' as const,
      notes: '上等烟叶，发酵温度控制在26-28℃',
    },
    {
      batch_no: 'YC20260501002',
      tobacco_type: '多米尼加雪茄烟叶',
      origin: '多米尼加圣地亚哥',
      weight_kg: 450,
      target_ferment_days: 25,
      start_date: now.subtract(20, 'day').format('YYYY-MM-DD'),
      room_no: 'A-02',
      status: 'fermenting' as const,
      notes: '中等烟叶，湿度控制在70-75%',
    },
    {
      batch_no: 'YC20260401001',
      tobacco_type: '尼加拉瓜雪茄烟叶',
      origin: '尼加拉瓜埃斯特利',
      weight_kg: 600,
      target_ferment_days: 30,
      start_date: now.subtract(60, 'day').format('YYYY-MM-DD'),
      room_no: 'B-01',
      status: 'shipped' as const,
      notes: '已发往上海仓库',
    },
    {
      batch_no: 'YC20260415001',
      tobacco_type: '洪都拉斯雪茄烟叶',
      origin: '洪都拉斯丹利',
      weight_kg: 380,
      target_ferment_days: 28,
      start_date: now.subtract(45, 'day').format('YYYY-MM-DD'),
      room_no: 'B-02',
      status: 'approved' as const,
      notes: '复核通过，等待出库',
    },
    {
      batch_no: 'YC20260515001',
      tobacco_type: '巴西雪茄烟叶',
      origin: '巴西南里奥格兰德',
      weight_kg: 520,
      target_ferment_days: 35,
      start_date: now.subtract(10, 'day').format('YYYY-MM-DD'),
      room_no: 'A-03',
      status: 'fermenting' as const,
      notes: '长期发酵批次，需密切监控温度',
    },
  ];

  const batchIds: number[] = [];

  batches.forEach((batch) => {
    const result = insertBatch.run(
      batch.batch_no,
      batch.tobacco_type,
      batch.origin,
      batch.weight_kg,
      batch.target_ferment_days,
      batch.start_date,
      batch.room_no,
      batch.status,
      batch.notes,
    );
    batchIds.push(Number(result.lastInsertRowid));
  });

  batchIds.forEach((batchId, index) => {
    const batch = batches[index];
    const startDate = dayjs(batch.start_date);
    const daysToGenerate = Math.min(
      now.diff(startDate, 'day'),
      batch.target_ferment_days + 10,
    );

    for (let day = 0; day < daysToGenerate; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const recordedAt = startDate
          .add(day, 'day')
          .add(hour, 'hour')
          .format('YYYY-MM-DD HH:mm:ss');

        const baseTemp = 26 + Math.sin(day / 5) * 2;
        const tempVariation = Math.sin(hour / 6) * 1.5;
        const temperature = Math.round((baseTemp + tempVariation + (Math.random() - 0.5)) * 10) / 10;

        const baseHumidity = 72 + Math.cos(day / 7) * 3;
        const humidity = Math.round((baseHumidity + (Math.random() - 0.5) * 2) * 10) / 10;

        insertTH.run(batchId, temperature, humidity, recordedAt);
      }
    }

    const elasticityDays = Math.floor(daysToGenerate / 3);
    for (let i = 0; i < elasticityDays; i++) {
      const dayOffset = Math.floor((i + 1) * 3);
      if (dayOffset > daysToGenerate) break;

      const recordedAt = startDate
        .add(dayOffset, 'day')
        .hour(14)
        .minute(0)
        .second(0)
        .format('YYYY-MM-DD HH:mm:ss');

      let reboundPercent: number;

      if (batch.status === 'pending_review') {
        if (i >= elasticityDays - 2) {
          reboundPercent = 58 + Math.random() * 3;
        } else {
          reboundPercent = 65 + Math.random() * 10;
        }
      } else if (batch.status === 'fermenting') {
        reboundPercent = 55 + i * 0.5 + Math.random() * 5;
      } else {
        reboundPercent = 68 + Math.random() * 12;
      }

      reboundPercent = Math.min(95, Math.max(50, Math.round(reboundPercent * 10) / 10));

      insertElasticity.run(
        batchId,
        reboundPercent,
        recordedAt,
        `ELAST-${String((batchId % 3) + 1).padStart(3, '0')}`,
      );
    }

    if (batch.status === 'approved') {
      const reviewDate = startDate.add(batch.target_ferment_days + 3, 'day');
      insertReview.run(
        batchId,
        '张复核员',
        'approved',
        '弹性指标符合要求，发酵充分，准予放行',
        reviewDate.format('YYYY-MM-DD HH:mm:ss'),
      );
    } else if (batch.status === 'shipped') {
      const reviewDate = startDate.add(batch.target_ferment_days + 1, 'day');
      insertReview.run(
        batchId,
        '李复核员',
        'approved',
        '各项指标正常，质量优良',
        reviewDate.format('YYYY-MM-DD HH:mm:ss'),
      );

      const shipDate = reviewDate.add(2, 'day');
      insertShipment.run(
        batchId,
        shipDate.format('YYYY-MM-DD'),
        '上海烟草仓库',
        '王管理员',
        '冷链运输，温度控制在20-22℃',
      );
    } else if (batch.status === 'pending_review') {
      const reviewDate = startDate.add(batch.target_ferment_days + 2, 'day');
      insertReview.run(
        batchId,
        '张复核员',
        'rejected',
        '连续两次回弹低于62%，需延长发酵时间并重新检测',
        reviewDate.format('YYYY-MM-DD HH:mm:ss'),
      );
    }
  });

  console.log('演示数据插入完成');
  console.log(`  - 批次: ${batches.length} 条`);
  console.log(`  - 待复核批次: ${batches.filter((b) => b.status === 'pending_review').length} 条`);
  console.log(`  - 发酵中批次: ${batches.filter((b) => b.status === 'fermenting').length} 条`);
  console.log(`  - 已放行批次: ${batches.filter((b) => b.status === 'approved').length} 条`);
  console.log(`  - 已出库批次: ${batches.filter((b) => b.status === 'shipped').length} 条`);
}

export function initAndSeed() {
  initDatabase();
  seedDemoData();
}

if (process.argv[1]?.includes('seed.ts')) {
  initAndSeed();
}
