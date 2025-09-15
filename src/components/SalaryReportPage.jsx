import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Typography, Select, Button, Card, Table, message, Spin } from 'antd';
import dayjs from 'dayjs';

const { Content } = Layout;
const { Title } = Typography;

const SalaryReportPage = ({ user }) => {
  const [payPeriods, setPayPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    // NAYI AUR MUKAMMAL LOGIC: Pay periods generate karne ke liye
    const generatePayPeriods = (startDateStr) => {
      const startDate = dayjs(startDateStr);
      const periods = [];
      let current = startDate;
      const today = dayjs();

      while (current.isBefore(today) || current.isSame(today, 'day')) {
        let periodEnd;
        const anniversaryDay = startDate.date();
        const dayBeforeAnniversary = anniversaryDay - 1;

        // Check for anniversary month
        if (current.month() === startDate.month() && current.year() > startDate.year() && dayBeforeAnniversary > 0) {
          // Case 1: Start of anniversary month
          if (current.date() === 1) {
            periodEnd = current.date(dayBeforeAnniversary);
          }
          // Case 2: Anniversary date itself
          else if (current.date() === anniversaryDay) {
            periodEnd = current.date(15);
          }
          // Default cases for the month
          else if (current.date() <= 15) {
            periodEnd = current.date(15);
          } else {
            periodEnd = current.endOf('month');
          }
        } else {
           // Normal month logic
          if (current.date() <= 15) {
            periodEnd = current.date(15);
          } else {
            periodEnd = current.endOf('month');
          }
        }

        if (periodEnd.isAfter(today)) {
          periodEnd = today;
        }
        
        const isNonStandard = !( (current.date() === 1 && periodEnd.date() === 15) || (current.date() === 16 && periodEnd.isSame(current.endOf('month'), 'day')) );

        periods.push({
          label: `${current.format('MMMM YYYY')} (${current.date()} - ${periodEnd.date()})`,
          value: `${current.format('YYYY-MM-DD')}_${periodEnd.format('YYYY-MM-DD')}`,
          start: current.format('YYYY-MM-DD'),
          end: periodEnd.format('YYYY-MM-DD'),
          isNonStandard: isNonStandard,
        });

        current = periodEnd.add(1, 'day');
      }
      setPayPeriods(periods.reverse());
    };

    const fetchStartDate = async () => {
      const { data, error } = await supabase.from('settings').select('agreement_start_date').eq('user_id', user.id).single();
      if (error || !data.agreement_start_date) {
        messageApi.warning('Please set your Agreement Start Date in Settings to generate reports.');
      } else {
        generatePayPeriods(data.agreement_start_date);
      }
    };
    fetchStartDate();
  }, [user.id, messageApi]);

  const handleGenerateReport = async () => {
    if (!selectedPeriod) { messageApi.error('Please select a pay period.'); return; }
    setLoading(true);
    setReportData([]);
    try {
      const period = payPeriods.find(p => p.value === selectedPeriod);
      const { data: entries, error: entriesError } = await supabase.from('daily_entries').select('id').eq('user_id', user.id).gte('entry_date', period.start).lte('entry_date', period.end);
      if (entriesError) throw entriesError;
      if (entries.length === 0) { messageApi.info('No entries found for this period.'); setLoading(false); return; }
      
      const entryIds = entries.map(e => e.id);
      const { data: earnings, error: earningsError } = await supabase.from('daily_earnings').select('worker_name, earning').eq('user_id', user.id).in('entry_id', entryIds);
      if (earningsError) throw earningsError;

      const { data: agreement, error: agreementError } = await supabase.from('agreements').select('monthly_allowance, allowance_calculation_type').eq('user_id', user.id).eq('agreement_name', 'Current Agreement').single();
      if (agreementError) throw new Error('Could not fetch allowance rate.');
      
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