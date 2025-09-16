import React, { useState, useEffect } from 'react';
import { db } from '../db'; // Dexie DB istemal karein
import { useLiveQuery } from 'dexie-react-hooks';
import { Layout, Typography, Select, Button, Card, Table, message, Spin, Row, Col } from 'antd';
import dayjs from 'dayjs';

const { Content } = Layout;
const { Title } = Typography;

const pageStyles = { padding: '12px' };
const contentStyles = { maxWidth: '1000px', margin: '0 auto', width: '100%' };
const cardStyles = { borderRadius: '8px' };

const LeavesReportPage = ({ user }) => {
  const [fiscalYears, setFiscalYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  // Settings ko local database se hasil karein
  const settings = useLiveQuery(() => db.settings.where('user_id').equals(user.id).first(), [user.id]);

  useEffect(() => {
    const generateFiscalYears = (startDateStr) => {
      if (!startDateStr) return;
      const startDate = dayjs(startDateStr);
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
      const year = fiscalYears.find(y => y.value === selectedYear);
      
      // Tamam data local Dexie DB se fetch karein
      const agreement = await db.agreements.where({ user_id: user.id, agreement_name: 'Current Agreement' }).first();
      if (!agreement) throw new Error('Could not find agreement data locally. Please go online to sync.');

      const withoutPaidLimit = agreement.without_paid_leaves || 0;
      const paidLimit = agreement.paid_leaves || 0;

      // Entries aur unki earnings ko local DB se hasil karein
      const entriesInYear = await db.daily_entries
        .where('[user_id+entry_date]')
        .between([user.id, year.start], [user.id, year.end])
        .toArray();
      
      const entryLocalIds = entriesInYear.map(e => e.local_id);
      const absences = await db.daily_earnings
        .where('entry_local_id').anyOf(entryLocalIds)
        .and(earning => earning.attendance_status === 'Absent')
        .toArray();

      const summary = {};
      const allWorkers = await db.workers.where('user_id').equals(user.id).toArray();
      
      allWorkers.forEach(w => {
        summary[w.worker_name] = { totalAbsences: 0 };
      });
      
      absences.forEach(a => {
        if (summary[a.worker_name]) {
          summary[a.worker_name].totalAbsences += 1;
        }
      });

      const finalData = Object.keys(summary).map(workerName => {
        const totalAbsences = summary[workerName].totalAbsences;
        const unpaidLeavesTaken = Math.min(totalAbsences, withoutPaidLimit);
        const remainingAbsencesAfterUnpaid = totalAbsences - unpaidLeavesTaken;
        const paidLeavesTaken = Math.min(remainingAbsencesAfterUnpaid, paidLimit);
        const remainingPaidLeaves = paidLimit - paidLeavesTaken;
        return {
          key: workerName,
          worker_name: workerName,
          total_absences: totalAbsences,
          unpaid_leaves_taken: unpaidLeavesTaken,
          paid_leaves_taken: paidLeavesTaken,
          remaining_paid_leaves: remainingPaidLeaves,
        };
      });
      
      setReportData(finalData);
      if (finalData.length === 0) {
        messageApi.info('No workers found.');
      }
    } catch (error) {
      messageApi.error(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const columns = [
    { title: 'Worker Name', dataIndex: 'worker_name', key: 'worker_name', fixed: 'left' },
    { title: 'Total Absences', dataIndex: 'total_absences', key: 'total_absences' },
    { title: 'Unpaid Leaves Taken', dataIndex: 'unpaid_leaves_taken', key: 'unpaid_leaves_taken' },
    { title: 'Paid Leaves Taken', dataIndex: 'paid_leaves_taken', key: 'paid_leaves_taken' },
    { title: 'Remaining Paid Leaves', dataIndex: 'remaining_paid_leaves', key: 'remaining_paid_leaves' },
  ];

  return (
    <div style={pageStyles}>
      {contextHolder}
      <div style={contentStyles}>
        <Title level={2} style={{ marginBottom: '16px' }}>Leaves Report</Title>
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
              scroll={{ x: 800 }}
            />
          </Spin>
        </Card>
      </div>
    </div>
  );
};

export default LeavesReportPage;