import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Typography, Select, Button, Card, Table, message, Spin } from 'antd';
import dayjs from 'dayjs';

const { Content } = Layout;
const { Title } = Typography;

const LeavesReportPage = ({ user }) => {
  const [fiscalYears, setFiscalYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  // Yeh function agreement start date se fiscal years generate karega
  useEffect(() => {
    const generateFiscalYears = (startDateStr) => {
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

  // "Generate Report" button par click hone par
  const handleGenerateReport = async () => {
    if (!selectedYear) {
      messageApi.error('Please select a fiscal year.');
      return;
    }
    setLoading(true);
    setReportData([]);

    try {
      const year = fiscalYears.find(y => y.value === selectedYear);

      // Step 1: Agreement se leaves ki details hasil karein
      const { data: agreement, error: agreementError } = await supabase.from('agreements').select('without_paid_leaves, paid_leaves').eq('user_id', user.id).eq('agreement_name', 'Current Agreement').single();
      if (agreementError) throw new Error('Could not fetch agreement details.');
      const withoutPaidLimit = agreement.without_paid_leaves || 0;
      const paidLimit = agreement.paid_leaves || 0;

      // Step 2: Tamam ghair-hazriyan (absences) hasil karein
      const { data: absences, error: absencesError } = await supabase
        .from('daily_earnings')
        .select('worker_name')
        .eq('user_id', user.id)
        .eq('attendance_status', 'Absent')
        .gte('created_at', year.start)
        .lte('created_at', year.end);
      if (absencesError) throw absencesError;
      
      // Step 3: Har worker ke liye hisab lagayein
      const summary = {};
      // Pehle tamam workers ko list mein shamil karein
      const { data: allWorkers } = await supabase.from('workers').select('worker_name').eq('user_id', user.id);
      allWorkers.forEach(w => {
        summary[w.worker_name] = { totalAbsences: 0 };
      });

      // Ab ghair-hazriyan ginein
      absences.forEach(a => {
        if (summary[a.worker_name]) {
          summary[a.worker_name].totalAbsences += 1;
        }
      });

      // Step 4: Nayi logic ke mutabiq leaves calculate karein
      const finalData = Object.keys(summary).map(workerName => {
        const totalAbsences = summary[workerName].totalAbsences;
        
        // Pehle Without Paid Leaves count hongi
        const unpaidLeavesTaken = Math.min(totalAbsences, withoutPaidLimit);
        const remainingAbsencesAfterUnpaid = totalAbsences - unpaidLeavesTaken;
        
        // Phir Paid Leaves count hongi
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
    <Layout style={{ minHeight: '100vh', padding: '24px' }}>
      {contextHolder}
      <Content style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <Title level={2}>Leaves Report</Title>
        <Card>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <Select
              placeholder="Select Fiscal Year"
              style={{ flexGrow: 1 }}
              onChange={(value) => setSelectedYear(value)}
              options={fiscalYears}
            />
            <Button type="primary" onClick={handleGenerateReport} loading={loading}>Generate Report</Button>
          </div>
          
          <Spin spinning={loading}>
            <Table
              columns={columns}
              dataSource={reportData}
              pagination={false}
              scroll={{ x: 800 }}
            />
          </Spin>
        </Card>
      </Content>
    </Layout>
  );
};

export default LeavesReportPage;