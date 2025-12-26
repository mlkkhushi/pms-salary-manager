import React, { useState, useEffect } from 'react';
import { db } from '../db'; // Dexie DB istemal karein
import { useLiveQuery } from 'dexie-react-hooks';
import { Layout, Typography, Select, Button, Card, Table, message, Spin, Row, Col } from 'antd';
import dayjs from 'dayjs';

const { Content } = Layout;
const { Title } = Typography;

const pageStyles = { padding: '12px' };
const contentStyles = { maxWidth: '1200px', margin: '0 auto', width: '100%' };
const cardStyles = { borderRadius: '8px' };

const AnnualBonusPage = ({ user }) => {
  const [fiscalYears, setFiscalYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [agreementStartDate, setAgreementStartDate] = useState(null);
  const [messageApi, contextHolder] = message.useMessage();

  const settings = useLiveQuery(() => db.settings.where('user_id').equals(user.id).first(), [user.id]);

  useEffect(() => {
    const generateFiscalYears = (startDateStr) => {
      if (!startDateStr) return;
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
    
    if (settings) {
      if (settings.agreement_start_date) {
        generateFiscalYears(settings.agreement_start_date);
      } else {
        messageApi.warning('Please set your Agreement Start Date in Settings to generate reports.');
      }
    }
  }, [settings, messageApi]);

  const handleGenerateReport = async () => {
    if (!selectedYear) {
      messageApi.error('Please select a fiscal year.');
      return;
    }
    setLoading(true);
    setReportData([]);
    try {
      // --- 100% OFFLINE LOGIC START ---
      const profile = await db.profiles.get(user.id);
      const allWorkers = await db.workers.where('user_id').equals(user.id).toArray();

      if (allWorkers.length === 0) {
        messageApi.info('No workers found. Please add workers in Settings.');
        setLoading(false);
        return;
      }
      // --- 100% OFFLINE LOGIC END ---

      const year = fiscalYears.find(y => y.value === selectedYear);
      const selectedYearStartDate = dayjs(year.start);
      const isFirstYear = selectedYearStartDate.isSame(agreementStartDate, 'day');
      const agreementNameToFetch = isFirstYear ? 'Current Agreement' : 'New Agreement';
      messageApi.info(`Calculating bonus using: ${agreementNameToFetch}`);
      
      const agreement = await db.agreements.where({ user_id: user.id, agreement_name: agreementNameToFetch }).first();
      if (!agreement) throw new Error(`Could not find '${agreementNameToFetch}' details locally. Please go online to sync.`);
      
      const entriesInYear = await db.daily_entries.where('[user_id+entry_date]').between([user.id, year.start], [user.id, year.end]).toArray();
      const entryDates = entriesInYear.map(e => e.entry_date);
const earnings = await db.daily_earnings.where('entry_date').anyOf(entryDates).toArray();

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

      // --- NAYA OFFLINE FILTERING LOGIC START ---
      const allowedWorkersList = profile?.allowed_workers;
      let filteredReportData = [];

      if (!allowedWorkersList || allowedWorkersList.length === 0) {
        // Default Case: Sirf pehla worker dikhayein
        const firstWorkerName = allWorkers[0]?.worker_name;
        if (firstWorkerName) {
            const workerData = finalData.find(d => d.worker_name === firstWorkerName);
            if (workerData) filteredReportData.push(workerData);
        }
      } else {
        // Permission Case: Sirf ijazat shuda workers dikhayein
        allowedWorkersList.forEach(workerName => {
            const workerData = finalData.find(d => d.worker_name === workerName);
            if (workerData) filteredReportData.push(workerData);
        });
      }
      // --- NAYA OFFLINE FILTERING LOGIC END ---

      setReportData(filteredReportData);
      if (filteredReportData.length === 0) {
        messageApi.info('No data available for the workers you are permitted to see.');
      }
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