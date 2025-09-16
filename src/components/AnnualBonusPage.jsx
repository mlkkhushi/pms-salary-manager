import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Typography, Select, Button, Card, Table, message, Spin, Row, Col } from 'antd';
import dayjs from 'dayjs';

const { Content } = Layout;
const { Title } = Typography;

// --- Consistent Styles ---
const pageStyles = {
  padding: '12px',
};

const contentStyles = {
  maxWidth: '1200px', // Is page ke liye thori zyada jagah
  margin: '0 auto',
  width: '100%',
};

const cardStyles = {
  borderRadius: '8px',
};

const AnnualBonusPage = ({ user }) => {
  const [fiscalYears, setFiscalYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [agreementStartDate, setAgreementStartDate] = useState(null);
  const [messageApi, contextHolder] = message.useMessage();

  // Data fetch karne ki logic bilkul wesi hi rahegi
  useEffect(() => {
    const generateFiscalYears = (startDateStr) => {
      const startDate = dayjs(startDateStr);
      setAgreementStartDate(startDate);
      const years = [];
      let currentYearStart = startDate;
      const today = dayjs();
      while (currentYearStart.isBefore(today)) {
        const currentYearEnd = currentYearStart.add(1, 'year').subtract(1, 'day');
        years.push({
          label: `${currentYearStart.format('MMM DD, YYYY')} - ${currentYearEnd.format('MMM DD, YYYY')}`,
          value: `${currentYearStart.format('YYYY-MM-DD')}_${currentYearEnd.format('YYYY-MM-DD')}`,
          start: currentYearStart.format('YYYY-MM-DD'),
          end: currentYearEnd.format('YYYY-MM-DD'),
        });
        currentYearStart = currentYearStart.add(1, 'year');
      }
      setFiscalYears(years.reverse());
    };
    const fetchStartDate = async () => {
      const { data, error } = await supabase.from('settings').select('agreement_start_date').eq('user_id', user.id).single();
      if (error || !data.agreement_start_date) {
        messageApi.warning('Please set your Agreement Start Date in Settings to generate reports.');
      } else {
        generateFiscalYears(data.agreement_start_date);
      }
    };
    fetchStartDate();
  }, [user.id, messageApi]);

  // Report generate karne ki logic bilkul wesi hi rahegi
  const handleGenerateReport = async () => {
    if (!selectedYear) {
      messageApi.error('Please select a fiscal year.');
      return;
    }
    setLoading(true);
    setReportData([]);
    try {
      const year = fiscalYears.find(y => y.value === selectedYear);
      const selectedYearStartDate = dayjs(year.start);
      const isFirstYear = selectedYearStartDate.isSame(agreementStartDate, 'day');
      const agreementNameToFetch = isFirstYear ? 'Current Agreement' : 'New Agreement';
      messageApi.info(`Calculating bonus using: ${agreementNameToFetch}`);
      const { data: agreement, error: agreementError } = await supabase.from('agreements').select('*').eq('user_id', user.id).eq('agreement_name', agreementNameToFetch).single();
      if (agreementError) throw new Error(`Could not fetch '${agreementNameToFetch}' details.`);
      const { data: allWorkers, error: workersError } = await supabase.from('workers').select('worker_name').eq('user_id', user.id);
      if (workersError) throw new Error('Could not fetch workers list.');
      const { data: earnings, error: earningsError } = await supabase.from('daily_earnings').select('worker_name, earning, attendance_status').eq('user_id', user.id).gte('created_at', year.start).lte('created_at', year.end);
      if (earningsError) throw new Error('Could not fetch earnings.');
      const totalAnnualAllowance = (agreement.monthly_allowance || 0) * 12;
      const finalData = allWorkers.map(worker => {
        const workerName = worker.worker_name;
        const annualWorkEarnings = earnings.filter(e => e.worker_name === workerName).reduce((acc, curr) => acc + curr.earning, 0);
        const totalAnnualEarnings = annualWorkEarnings + totalAnnualAllowance;
        const avgMonthlySalary = totalAnnualEarnings > 0 ? totalAnnualEarnings / 12 : 0;
        const annualBonus = avgMonthlySalary;
        const gratuity = avgMonthlySalary;
        const totalAbsences = earnings.filter(e => e.worker_name === workerName && e.attendance_status === 'Absent').length;
        const unpaidTaken = Math.min(totalAbsences, agreement.without_paid_leaves || 0);
        const paidTaken = Math.min(totalAbsences - unpaidTaken, agreement.paid_leaves || 0);
        const remainingPaid = (agreement.paid_leaves || 0) - paidTaken;
        const paidLeavesBonus = remainingPaid * (agreement.paid_leave_rate || 0);
        const totalBonusPackage = annualBonus + gratuity + paidLeavesBonus;
        return {
          key: workerName,
          worker_name: workerName,
          avg_monthly_salary: avgMonthlySalary,
          annual_bonus: annualBonus,
          gratuity: gratuity,
          paid_leaves_bonus: paidLeavesBonus,
          total_bonus_package: totalBonusPackage,
        };
      });
      setReportData(finalData);
    } catch (error) {
      messageApi.error(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const columns = [
    { title: 'Worker Name', dataIndex: 'worker_name', key: 'worker_name', fixed: 'left', width: 150 },
    { title: 'Avg Monthly Salary', dataIndex: 'avg_monthly_salary', key: 'avg_monthly_salary', render: val => val.toFixed(2) },
    { title: 'Annual Bonus', dataIndex: 'annual_bonus', key: 'annual_bonus', render: val => val.toFixed(2) },
    { title: 'Gratuity', dataIndex: 'gratuity', key: 'gratuity', render: val => val.toFixed(2) },
    { title: 'Paid Leaves Bonus', dataIndex: 'paid_leaves_bonus', key: 'paid_leaves_bonus', render: val => val.toFixed(2) },
    { title: 'Total Bonus Package', dataIndex: 'total_bonus_package', key: 'total_bonus_package', render: val => <strong>{val.toFixed(2)}</strong> },
  ];

  return (
    <div style={pageStyles}>
      {contextHolder}
      <div style={contentStyles}>
        <Title level={2} style={{ marginBottom: '16px' }}>Annual Bonus & Gratuity</Title>
        <Card style={cardStyles}>
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col xs={24} md={18}>
              <Select
                placeholder="Select Fiscal Year"
                style={{ width: '100%' }}
                onChange={(value) => setSelectedYear(value)}
                options={fiscalYears}
              />
            </Col>
            <Col xs={24} md={6}>
              <Button type="primary" onClick={handleGenerateReport} loading={loading} block>Generate Report</Button>
            </Col>
          </Row>
          
          <Spin spinning={loading}>
            <Table
              columns={columns}
              dataSource={reportData}
              pagination={false}
              scroll={{ x: 1000 }}
            />
          </Spin>
        </Card>
      </div>
    </div>
  );
};

export default AnnualBonusPage;