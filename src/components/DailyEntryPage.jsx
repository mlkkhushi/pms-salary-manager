import React, { useState, useEffect } from 'react';
import { useSync } from '../contexts/SyncContext';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Layout, Typography, Form, DatePicker, Radio, InputNumber, Checkbox, Button, Card, Divider, Row, Col, message, Table, Spin, Tag } from 'antd';
import { SaveOutlined, TeamOutlined, ProfileOutlined, CloudUploadOutlined, CloudOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Content } = Layout;
const { Title } = Typography;

const pageStyles = { padding: '12px' };
const contentStyles = { maxWidth: '900px', margin: '0 auto', width: '100%' };
const cardStyles = { borderRadius: '8px' };

const DailyEntryPage = ({ user }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const { isOnline, triggerSync } = useSync();

  const workers = useLiveQuery(() => db.workers.where('user_id').equals(user.id).toArray(), [user.id]) || [];
  const agreement = useLiveQuery(() => db.agreements.where('[user_id+agreement_name]').equals([user.id, 'Current Agreement']).first(), [user.id]);
  const settings = useLiveQuery(() => db.settings.where('user_id').equals(user.id).first(), [user.id]);
  const isWagonSystemEnabled = settings?.is_wagon_system_enabled || false;

  const detailedEntries = useLiveQuery(async () => {
    const today = dayjs();
    const currentPayPeriodStart = today.date() <= 15 ? today.date(1) : today.date(16);
    const entries = await db.daily_entries.where('user_id').equals(user.id).and(entry => dayjs(entry.entry_date).isAfter(currentPayPeriodStart.subtract(1, 'day'))).toArray();
    const earnings = await db.daily_earnings.where('user_id').equals(user.id).toArray();
    return entries.map(entry => {
      const earningsForThisEntry = earnings.filter(e => e.entry_local_id === entry.local_id);
      const absentWorkers = earningsForThisEntry.filter(e => e.attendance_status === 'Absent').map(e => e.worker_name).join(', ');
      const presentWorkerEarning = earningsForThisEntry.find(e => e.attendance_status === 'Present')?.earning;
      const payPerWorker = presentWorkerEarning !== undefined ? presentWorkerEarning : 0;
      return {
        key: entry.local_id, date: entry.entry_date, tonnage: entry.day_type === 'Rest Day' ? 'Rest Day' : entry.tonnage,
        absent: absentWorkers || 'None', pay_per_worker: payPerWorker.toFixed(2), synced: entry.synced,
      };
    }).sort((a, b) => dayjs(b.date).diff(dayjs(a.date)));
  }, [user.id]);

  useEffect(() => {
    if (workers.length > 0) {
        const currentPresentWorkers = form.getFieldValue('present_workers');
        if(!currentPresentWorkers || currentPresentWorkers.length === 0) {
            form.setFieldsValue({ present_workers: workers.map(w => w.worker_name) });
        }
    }
  }, [workers, form]);

  const onFinish = async (values) => {
    setLoading(true);
    const { entry_date, day_type, tonnage, wagons, present_workers } = values;
    const formattedDate = entry_date.format('YYYY-MM-DD');
    
    try {
      if (!agreement) {
        throw new Error('Agreement rates not found locally. Please go online once to sync.');
      }
      
      const workerNames = workers.map(w => w.worker_name);
      const absentWorkers = workerNames.filter(w => !present_workers.includes(w));
      const earningsData = [];
      let wagonEarningPerWorker = 0;
      if (isWagonSystemEnabled && wagons > 0 && present_workers.length > 0) {
        wagonEarningPerWorker = (wagons * (agreement.wagon_rate || 0)) / present_workers.length;
      }
      if (day_type === 'Work Day' || day_type === 'Special Overtime') {
        let tonnageEarning = (present_workers.length > 0) ? (tonnage * agreement.ton_rate) / present_workers.length : 0;
        if (day_type === 'Special Overtime') {
          tonnageEarning = (tonnageEarning * 2) + agreement.layoff_rate;
          const guarantee = agreement.layoff_rate * 3;
          tonnageEarning = Math.max(tonnageEarning, guarantee);
        }
        const finalTonnageEarning = Math.max(tonnageEarning, agreement.layoff_rate);
        const finalEarning = finalTonnageEarning + wagonEarningPerWorker;
        present_workers.forEach(worker => earningsData.push({ worker_name: worker, earning: finalEarning, attendance_status: 'Present' }));
      } else {
        present_workers.forEach(worker => earningsData.push({ worker_name: worker, earning: agreement.rest_rate, attendance_status: 'Present' }));
      }
      absentWorkers.forEach(worker => earningsData.push({ worker_name: worker, earning: agreement.layoff_rate, attendance_status: 'Absent' }));

      // --- YEH HAI ASAL TABDEELI ---
      const entryPayload = { 
        user_id: user.id, 
        entry_date: formattedDate, 
        day_type: day_type, 
        tonnage: day_type !== 'Rest Day' ? tonnage : null,
        wagons: day_type !== 'Rest Day' ? wagons || 0 : 0, // Wagons ko yahan save karein
      };
      const earningsPayload = earningsData.map(e => ({ user_id: user.id, ...e }));

      await db.transaction('rw', db.daily_entries, db.daily_earnings, async () => {
          const existing = await db.daily_entries.where({user_id: user.id, entry_date: formattedDate}).first();
          if(existing) {
            await db.daily_earnings.where('entry_local_id').equals(existing.local_id).delete();
            await db.daily_entries.delete(existing.local_id);
          }
          const tempEntryId = await db.daily_entries.add({...entryPayload, synced: false});
          await db.daily_earnings.bulkAdd(earningsPayload.map(e => ({...e, entry_local_id: tempEntryId})));
      });

      await db.sync_queue.add({
        type: 'create_daily_entry',
        data: { entry: entryPayload, earnings: earningsPayload },
        timestamp: new Date(),
      });
      
      messageApi.success('Entry saved locally. Sync will start shortly.');
      
      if(isOnline) {
        triggerSync();
      }

      form.resetFields(['tonnage', 'wagons']);

    } catch (error) {
      messageApi.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const detailedColumns = [
    { title: 'Date', dataIndex: 'date', key: 'date', fixed: 'left', width: 110 },
    { title: 'Tonnage', dataIndex: 'tonnage', key: 'tonnage', width: 100 },
    { title: 'Absent', dataIndex: 'absent', key: 'absent' },
    { title: 'Pay/Worker (Rs)', dataIndex: 'pay_per_worker', key: 'pay_per_worker', width: 150 },
    { title: 'Status', dataIndex: 'synced', key: 'synced', fixed: 'right', width: 90, render: (synced) => (
        synced ? <Tag icon={<CloudUploadOutlined />} color="success">Synced</Tag> : <Tag icon={<CloudOutlined />} color="warning">Local</Tag>
    )},
  ];

  return (
    <Layout style={pageStyles}>
      {contextHolder}
      <Content style={contentStyles}>
        <Title level={2} style={{ marginBottom: '16px' }}>Daily Work Entry</Title>
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ entry_date: dayjs(), day_type: 'Work Day' }}>
          <Card style={cardStyles}>
            <Row gutter={[16, 0]}>
              <Col xs={24} sm={12}><Form.Item label="Select Date" name="entry_date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" /></Form.Item></Col>
              <Col xs={24} sm={12}><Form.Item label="Day Type" name="day_type" rules={[{ required: true }]}><Radio.Group buttonStyle="solid" style={{ width: '100%' }}><Radio.Button value="Work Day" style={{ width: '33.33%' }}>Work</Radio.Button><Radio.Button value="Rest Day" style={{ width: '33.33%' }}>Rest</Radio.Button><Radio.Button value="Special Overtime" style={{ width: '33.33%' }}>Overtime</Radio.Button></Radio.Group></Form.Item></Col>
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.day_type !== curr.day_type}>
                {({ getFieldValue }) => getFieldValue('day_type') !== 'Rest Day' ? (<>
                    <Col xs={24} sm={12}><Form.Item label="Tonnage" name="tonnage" rules={[{ required: true, message: 'Please enter tonnage!' }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                    {isWagonSystemEnabled && (<Col xs={24} sm={12}><Form.Item label="Total Wagons" name="wagons"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>)}
                </>) : null}
              </Form.Item>
            </Row>
          </Card>
          <Card style={{ ...cardStyles, marginTop: '16px' }} title={<><TeamOutlined />&nbsp; Workers Attendance</>}>
            <Form.Item name="present_workers" noStyle>
              <Checkbox.Group style={{ width: '100%' }}>
                <Row gutter={[8, 8]}>
                  {workers.map(worker => (<Col xs={12} sm={8} key={worker.worker_name}><Checkbox value={worker.worker_name}>{worker.worker_name}</Checkbox></Col>))}
                </Row>
              </Checkbox.Group>
            </Form.Item>
          </Card>
          <Form.Item style={{ marginTop: '16px' }}><Button type="primary" htmlType="submit" loading={loading} block size="large" icon={<SaveOutlined />}>Save Entry</Button></Form.Item>
        </Form>
        <Divider />
        <Card style={cardStyles} title={<><ProfileOutlined />&nbsp; Detailed Entries (Current Pay Period)</>}>
          <Spin spinning={!detailedEntries}><Table columns={detailedColumns} dataSource={detailedEntries} pagination={false} scroll={{ x: true }} /></Spin>
        </Card>
      </Content>
    </Layout>
  );
};

export default DailyEntryPage;