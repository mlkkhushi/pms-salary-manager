import React, { useState, useEffect } from 'react';
import { db } from '../db'; // Supabase ke bajaye Dexie DB ko import karein
import { useLiveQuery } from 'dexie-react-hooks'; // Live data ke liye hook
import { Layout, Typography, Select, Button, Card, Table, message, Spin } from 'antd';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween'; // Date range ke liye plugin
dayjs.extend(isBetween);

const { Content } = Layout;
const { Title } = Typography;

const SalaryReportPage = ({ user }) => {
  const [payPeriods, setPayPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const settings = useLiveQuery(() => db.settings.where('user_id').equals(user.id).first(), [user.id]);

  useEffect(() => {
    const generatePayPeriods = (startDateStr) => {
      if (!startDateStr) return;
      const startDate = dayjs(startDateStr);
      const periods = [];
      let current = startDate;
      const today = dayjs();

      while (current.isBefore(today) || current.isSame(today, 'day')) {
        let periodEnd;
        const anniversaryDay = startDate.date();
        const dayBeforeAnniversary = anniversaryDay - 1;

        if (current.month() === startDate.month() && current.year() > startDate.year() && dayBeforeAnniversary > 0) {
          if (current.date() === 1) periodEnd = current.date(dayBeforeAnniversary);
          else if (current.date() === anniversaryDay) periodEnd = current.date(15);
          else if (current.date() <= 15) periodEnd = current.date(15);
          else periodEnd = current.endOf('month');
        } else {
          if (current.date() <= 15) periodEnd = current.date(15);
          else periodEnd = current.endOf('month');
        }

        // --- BUG FIX ---
        // Neeche di gayi line ghalti se maujooda period ko chota kar rahi thi.
        // Isay hata diya gaya hai.
        // if (periodEnd.isAfter(today)) periodEnd = today; 

        const isNonStandard = !((current.date() === 1 && periodEnd.date() === 15) || (current.date() === 16 && periodEnd.isSame(current.endOf('month'), 'day')));

        periods.push({
          label: `${current.format('MMMM YYYY')} (${current.date()} - ${periodEnd.date()})`,
          value: `${current.format('YYYY-MM-DD')}_${periodEnd.format('YYYY-MM-DD')}`,
          start: current.format('YYYY-MM-DD'), end: periodEnd.format('YYYY-MM-DD'), isNonStandard,
        });
        current = periodEnd.add(1, 'day');
      }
      setPayPeriods(periods.reverse());
    };

    if (settings) {
      if (settings.agreement_start_date) {
        generatePayPeriods(settings.agreement_start_date);
      } else {
        messageApi.warning('Please set your Agreement Start Date in Settings to generate reports.');
      }
    }
  }, [settings, messageApi]);

  const handleGenerateReport = async () => {
    if (!selectedPeriod) { messageApi.error('Please select a pay period.'); return; }
    setLoading(true);
    setReportData([]);
    try {
      const period = payPeriods.find(p => p.value === selectedPeriod);
      
      const entries = await db.daily_entries
        .where('[user_id+entry_date]')
        .between([user.id, period.start], [user.id, period.end])
        .toArray();

      if (entries.length === 0) {
        messageApi.info('No entries found for this period.');
        setLoading(false);
        return;
      }
      
      const entryLocalIds = entries.map(e => e.local_id);
      const earnings = await db.daily_earnings.where('entry_local_id').anyOf(entryLocalIds).toArray();
      const agreement = await db.agreements.where({ user_id: user.id, agreement_name: 'Current Agreement' }).first();

      if (!agreement) {
        throw new Error('Could not find agreement data locally. Please go online to sync.');
      }
      
      let allowanceForPeriod = 0;
      if (period.isNonStandard && agreement.allowance_calculation_type === 'Pro-Rata') {
        const dailyAllowance = (agreement.monthly_allowance || 0) / 30;
        const periodDays = dayjs(period.end).diff(dayjs(period.start), 'day') + 1;
        allowanceForPeriod = dailyAllowance * periodDays;
      } else {
        allowanceForPeriod = (agreement.monthly_allowance || 0) / 2;
      }

      const summary = {};
      earnings.forEach(e => {
        if (!summary[e.worker_name]) summary[e.worker_name] = 0;
        summary[e.worker_name] += e.earning;
      });

      const finalData = Object.keys(summary).map(workerName => ({
        key: workerName,
        worker_name: workerName,
        work_earning: summary[workerName],
        allowance: allowanceForPeriod,
        total_salary: summary[workerName] + allowanceForPeriod,
      }));
      setReportData(finalData);

    } catch (error) {
      messageApi.error(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const columns = [
    { title: 'Worker Name', dataIndex: 'worker_name', key: 'worker_name' },
    { title: 'Work Earning', dataIndex: 'work_earning', key: 'work_earning', render: (val) => val.toFixed(2) },
    { title: 'Allowance', dataIndex: 'allowance', key: 'allowance', render: (val) => val.toFixed(2) },
    { title: 'Total Salary', dataIndex: 'total_salary', key: 'total_salary', render: (text) => <strong>{text.toFixed(2)}</strong> },
  ];

  return (
    <Layout style={{ minHeight: '100vh', padding: '24px' }}>
      {contextHolder}
      <Content style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <Title level={2}>Salary Report</Title>
        <Card>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <Select placeholder="Select Pay Period" style={{ flexGrow: 1 }} onChange={(value) => setSelectedPeriod(value)} options={payPeriods} />
            <Button type="primary" onClick={handleGenerateReport} loading={loading}>Generate Report</Button>
          </div>
          <Spin spinning={loading}>
            <Table
              columns={columns}
              dataSource={reportData}
              pagination={false}
              summary={pageData => {
                let totalEarning = 0, totalAllowance = 0, totalSalary = 0;
                pageData.forEach(({ work_earning, allowance, total_salary }) => {
                  totalEarning += work_earning;
                  totalAllowance += allowance;
                  totalSalary += total_salary;
                });
                return (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0}><strong>Total</strong></Table.Summary.Cell>
                    <Table.Summary.Cell index={1}><strong>{totalEarning.toFixed(2)}</strong></Table.Summary.Cell>
                    <Table.Summary.Cell index={2}><strong>{totalAllowance.toFixed(2)}</strong></Table.Summary.Cell>
                    <Table.Summary.Cell index={3}><strong>{totalSalary.toFixed(2)}</strong></Table.Summary.Cell>
                  </Table.Summary.Row>
                );
              }}
            />
          </Spin>
        </Card>
      </Content>
    </Layout>
  );
};

export default SalaryReportPage;