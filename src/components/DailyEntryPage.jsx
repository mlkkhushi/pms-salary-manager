import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Typography, Form, DatePicker, Radio, InputNumber, Checkbox, Button, Card, Divider, Row, Col, message, Table, Spin } from 'antd';
import { SaveOutlined, TeamOutlined, ProfileOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Content } = Layout;
const { Title } = Typography;

// --- Modern Styles ---
const pageStyles = {
  padding: '12px',
};

const contentStyles = {
  maxWidth: '900px',
  margin: '0 auto',
  width: '100%',
};

const cardStyles = {
  borderRadius: '8px',
};

const DailyEntryPage = ({ user }) => {
  const [form] = Form.useForm();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailedEntries, setDetailedEntries] = useState([]);
  const [isTableLoading, setIsTableLoading] = useState(true);
  const [isWagonSystemEnabled, setIsWagonSystemEnabled] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const fetchDetailedEntries = useCallback(async () => {
    setIsTableLoading(true);
    try {
      const today = dayjs();
      const currentPayPeriodStart = today.date() <= 15 ? today.date(1) : today.date(16);
      const { data: entries, error: entriesError } = await supabase.from('daily_entries').select('*').eq('user_id', user.id).gte('entry_date', currentPayPeriodStart.format('YYYY-MM-DD')).lte('entry_date', today.format('YYYY-MM-DD')).order('entry_date', { ascending: true });
      if (entriesError) throw entriesError;
      const entryIds = entries.map(e => e.id);
      if (entryIds.length === 0) { setDetailedEntries([]); setIsTableLoading(false); return; }
      const { data: earnings, error: earningsError } = await supabase.from('daily_earnings').select('*').in('entry_id', entryIds);
      if (earningsError) throw earningsError;
      const formattedData = entries.map(entry => {
        const earningsForThisEntry = earnings.filter(e => e.entry_id === entry.id);
        const absentWorkers = earningsForThisEntry.filter(e => e.attendance_status === 'Absent').map(e => e.worker_name).join(', ');
        const presentWorkerEarning = earningsForThisEntry.find(e => e.attendance_status === 'Present')?.earning;
        const absentWorkerEarning = earningsForThisEntry.find(e => e.attendance_status === 'Absent')?.earning;
        const payPerWorker = presentWorkerEarning !== undefined ? presentWorkerEarning : (absentWorkerEarning || 0);
        return {
          key: entry.id,
          date: entry.entry_date,
          tonnage: entry.day_type === 'Rest Day' ? 'Rest Day' : entry.tonnage,
          absent: absentWorkers || 'None',
          pay_per_worker: payPerWorker.toFixed(2),
        };
      });
      setDetailedEntries(formattedData);
    } catch (error) { messageApi.error("Failed to load detailed entries."); }
    finally { setIsTableLoading(false); }
  }, [user.id, messageApi]);

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: settings } = await supabase.from('settings').select('is_wagon_system_enabled').eq('user_id', user.id).single();
      if (settings) setIsWagonSystemEnabled(settings.is_wagon_system_enabled);
      const { data: workersData, error } = await supabase.from('workers').select('worker_name').eq('user_id', user.id);
      if (error) { messageApi.error("Could not fetch workers list."); }
      else {
        const workerNames = workersData.map(w => w.worker_name);
        setWorkers(workerNames);
        form.setFieldsValue({ present_workers: workerNames });
      }
      fetchDetailedEntries();
    };
    fetchInitialData();
  }, [user.id, form, messageApi, fetchDetailedEntries]);

  const onFinish = async (values) => {
    // ... (onFinish logic bilkul wesa hi rahega) ...
    setLoading(true);
    const { entry_date, day_type, tonnage, wagons, present_workers } = values;
    const formattedDate = entry_date.format('YYYY-MM-DD');
    try {
      await supabase.from('daily_entries').delete().match({ user_id: user.id, entry_date: formattedDate });
      const { data: agreement, error: agreementError } = await supabase.from('agreements').select('ton_rate, layoff_rate, rest_rate, wagon_rate').eq('user_id', user.id).eq('agreement_name', 'Current Agreement').single();
      if (agreementError) throw new Error('Could not fetch agreement rates.');
      const absentWorkers = workers.filter(w => !present_workers.includes(w));
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
      const { data: newEntry, error: entryError } = await supabase.from('daily_entries').insert({ user_id: user.id, entry_date: formattedDate, day_type: day_type, tonnage: day_type !== 'Rest Day' ? tonnage : null }).select('id').single();
      if (entryError) throw entryError;
      const earningsToInsert = earningsData.map(e => ({ entry_id: newEntry.id, user_id: user.id, ...e }));
      await supabase.from('daily_earnings').insert(earningsToInsert);
      messageApi.success('Entry saved successfully!');
      form.resetFields(['tonnage', 'wagons']);
      fetchDetailedEntries();
    } catch (error) { messageApi.error(error.message); }
    finally { setLoading(false); }
  };

  const detailedColumns = [
    { title: 'Date', dataIndex: 'date', key: 'date', fixed: 'left', width: 110 },
    { title: 'Tonnage', dataIndex: 'tonnage', key: 'tonnage', width: 100 },
    { title: 'Absent', dataIndex: 'absent', key: 'absent' },
    { title: 'Pay/Worker (Rs)', dataIndex: 'pay_per_worker', key: 'pay_per_worker', width: 150 },
  ];

  return (
    <Layout style={pageStyles}>
      {contextHolder}
      <Content style={contentStyles}>
        <Title level={2} style={{ marginBottom: '16px' }}>Daily Work Entry</Title>

        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ entry_date: dayjs(), day_type: 'Work Day' }}>
          <Card style={cardStyles}>
            <Row gutter={[16, 0]}>
              <Col xs={24} sm={12}>
                <Form.Item label="Select Date" name="entry_date" rules={[{ required: true }]}>
                  <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label="Day Type" name="day_type" rules={[{ required: true }]}>
                  <Radio.Group buttonStyle="solid" style={{ width: '100%' }}>
                    <Radio.Button value="Work Day" style={{ width: '33.33%' }}>Work</Radio.Button>
                    <Radio.Button value="Rest Day" style={{ width: '33.33%' }}>Rest</Radio.Button>
                    <Radio.Button value="Special Overtime" style={{ width: '33.33%' }}>Overtime</Radio.Button>
                  </Radio.Group>
                </Form.Item>
              </Col>

              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.day_type !== curr.day_type}>
                {({ getFieldValue }) => getFieldValue('day_type') !== 'Rest Day' ? (
                  <>
                    <Col xs={24} sm={12}>
                      <Form.Item label="Tonnage" name="tonnage" rules={[{ required: true, message: 'Please enter tonnage!' }]}>
                        <InputNumber min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    {isWagonSystemEnabled && (
                      <Col xs={24} sm={12}>
                        <Form.Item label="Total Wagons" name="wagons">
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    )}
                  </>
                ) : null}
              </Form.Item>
            </Row>
          </Card>

          <Card style={{ ...cardStyles, marginTop: '16px' }} title={<><TeamOutlined />&nbsp; Workers Attendance</>}>
            <Form.Item name="present_workers" noStyle>
              <Checkbox.Group style={{ width: '100%' }}>
                <Row gutter={[8, 8]}>
                  {workers.map(worker => (
                    <Col xs={12} sm={8} key={worker}>
                      <Checkbox value={worker}>{worker}</Checkbox>
                    </Col>
                  ))}
                </Row>
              </Checkbox.Group>
            </Form.Item>
          </Card>

          <Form.Item style={{ marginTop: '16px' }}>
            <Button type="primary" htmlType="submit" loading={loading} block size="large" icon={<SaveOutlined />}>
              Save Entry
            </Button>
          </Form.Item>
        </Form>

        <Divider />

        <Card style={cardStyles} title={<><ProfileOutlined />&nbsp; Detailed Entries (Current Pay Period)</>}>
          <Spin spinning={isTableLoading}>
            <Table columns={detailedColumns} dataSource={detailedEntries} pagination={false} scroll={{ x: true }} />
          </Spin>
        </Card>
      </Content>
    </Layout>
  );
};

export default DailyEntryPage;