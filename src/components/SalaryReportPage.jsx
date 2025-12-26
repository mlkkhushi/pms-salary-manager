import React, { useState, useEffect } from 'react';
import { db } from '../db'; // Dexie DB ko import karein
import { useLiveQuery } from 'dexie-react-hooks'; // Live data ke liye hook
import { Layout, Typography, Select, Button, Card, Table, message, Spin, Row, Col } from 'antd';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween'; // Date range ke liye plugin
import DownloadToPdfButton from '../components/DownloadToPdfButton'; // <-- YAHAN IMPORT KIYA GAYA HAI

dayjs.extend(isBetween);

const { Content } = Layout;
const { Title } = Typography;

const SalaryReportPage = ({ user, onEditClick }) => {
  const [payPeriods, setPayPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [salaryDetails, setSalaryDetails] = useState([]);
  const [cachedEntries, setCachedEntries] = useState([]);
  const [cachedEarnings, setCachedEarnings] = useState([]);

  const settings = useLiveQuery(() => db.settings.where('user_id').equals(user.id).first(), [user.id]);
  const allWorkers = useLiveQuery(() => db.workers.where('user_id').equals(user.id).toArray(), [user.id]) || [];
  const profile = useLiveQuery(() => db.profiles.get(user.id), [user.id]);
  const agreement = useLiveQuery(() => db.agreements.where({ user_id: user.id, agreement_name: 'Current Agreement' }).first(), [user.id]);

  // --- DEFAULT SELECTION FIX: useEffect mein tabdeeli ki gayi hai ---
  useEffect(() => {
    const generatePayPeriods = (startDateStr) => {
      if (!startDateStr) return []; // Return an empty array if no start date
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

        const isNonStandard = !((current.date() === 1 && periodEnd.date() === 15) || (current.date() === 16 && periodEnd.isSame(current.endOf('month'), 'day')));

        periods.push({
          label: `${current.format('MMMM YYYY')} (${current.date()} - ${periodEnd.date()})`,
          value: `${current.format('YYYY-MM-DD')}_${periodEnd.format('YYYY-MM-DD')}`,
          start: current.format('YYYY-MM-DD'), end: periodEnd.format('YYYY-MM-DD'), isNonStandard,
        });
        current = periodEnd.add(1, 'day');
      }
      return periods.reverse(); // Return the reversed array
    };

    if (settings) {
      if (settings.agreement_start_date) {
        const generatedPeriods = generatePayPeriods(settings.agreement_start_date);
        setPayPeriods(generatedPeriods);

        // Agar periods generate hue hain, to sab se pehle (latest) ko select kar lein
        if (generatedPeriods.length > 0) {
          setSelectedPeriod(generatedPeriods[0].value);
        }
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
      const entries = await db.daily_entries.where('[user_id+entry_date]').between([user.id, period.start], [user.id, period.end + '\uffff']).toArray();

      if (entries.length === 0) {
        messageApi.info('No entries found for this period.');
        setLoading(false);
        return;
      }
      
      const entryDates = entries.map(e => e.entry_date);
      const earnings = await db.daily_earnings.where('entry_date').anyOf(entryDates).toArray();
      
      if (!agreement || !profile || !allWorkers || allWorkers.length === 0) {
        throw new Error('Could not find essential data locally. Please go online to sync.');
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
      
      const allowedWorkersList = profile?.allowed_workers;
      let filteredSummary = {};

      if (!allowedWorkersList || allowedWorkersList.length === 0) {
        const firstWorkerName = allWorkers[0]?.worker_name;
        if (firstWorkerName && summary.hasOwnProperty(firstWorkerName)) {
          filteredSummary[firstWorkerName] = summary[firstWorkerName];
        }
      } else {
        allowedWorkersList.forEach(workerName => {
          if (summary.hasOwnProperty(workerName)) {
            filteredSummary[workerName] = summary[workerName];
          }
        });
      }

      const finalData = Object.keys(filteredSummary).map(workerName => ({
        key: workerName,
        worker_name: workerName,
        work_earning: filteredSummary[workerName],
        allowance: allowanceForPeriod,
        total_salary: filteredSummary[workerName] + allowanceForPeriod,
      }));

      setCachedEntries(entries);
      setCachedEarnings(earnings);

      if (finalData.length === 0) {
        messageApi.info('No data available for the workers you are permitted to see in this period.');
        setReportData([]);
        setSalaryDetails([]);
        setSelectedWorker(null);
      } else {
        setReportData(finalData);
        // Hamesha pehla worker khud-ba-khud select karein
        const firstWorkerName = finalData[0].worker_name;
        setSelectedWorker(firstWorkerName);
        
        // Foran salary details generate karein
        generateSalaryDetails(period, firstWorkerName, finalData, entries, earnings);
      }
    } catch (error) {
      messageApi.error(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const generateSalaryDetails = (period, workerName, reportDataSource, entries, earnings) => {
    if (!period || !workerName || !reportDataSource || !entries || !earnings) {
      setSalaryDetails([]);
      return;
    }
    if (!agreement || !profile || !allWorkers || allWorkers.length === 0) {
      messageApi.error("Essential data like workers or profile is not loaded yet. Please try again.");
      return;
    }
    
    try {
      const allWorkerNames = new Set(allWorkers.map(w => String(w.worker_name).trim()));
      const visibleWorkersInReport = new Set(reportDataSource.map(r => String(r.worker_name).trim()));

      const processedDetails = entries.map(entry => {
        const earningsForThisDay = earnings.filter(e => e.entry_date === entry.entry_date);
        const absentWorkerRecords = earningsForThisDay.filter(e => e.attendance_status === 'Absent');
        const absentWorkers = absentWorkerRecords.map(e => String(e.worker_name).trim());
        const workerEarningForDay = earningsForThisDay.find(e => String(e.worker_name).trim() === String(workerName).trim());
        const payment = workerEarningForDay ? workerEarningForDay.earning : 0;

        let absentDisplay = '-';
        if (absentWorkers.length > 0) {
          const visibleAbsent = absentWorkers.filter(name => visibleWorkersInReport.has(name));
          const hiddenAbsentCount = absentWorkers.length - visibleAbsent.length;
          if (visibleAbsent.length > 0 && hiddenAbsentCount > 0) {
            absentDisplay = `${visibleAbsent.join(', ')} & ${hiddenAbsentCount} others`;
          } else if (visibleAbsent.length > 0) {
            absentDisplay = visibleAbsent.join(', ');
          } else {
            absentDisplay = `${absentWorkers.length}/${allWorkerNames.size}`;
          }
        }

        return {
          key: entry.local_id, date: entry.entry_date, tonnage: entry.tonnage,
          day_type: entry.day_type, wagons: entry.wagons,
          absent_workers: absentDisplay, payment: payment,
        };
      });

      let allowanceForPeriod = 0;
      if (period.isNonStandard && agreement.allowance_calculation_type === 'Pro-Rata') {
        const dailyAllowance = (agreement.monthly_allowance || 0) / 30;
        const periodDays = dayjs(period.end).diff(dayjs(period.start), 'day') + 1;
        allowanceForPeriod = dailyAllowance * periodDays;
      } else {
        allowanceForPeriod = (agreement.monthly_allowance || 0) / 2;
      }
      const grandTotalPayment = processedDetails.reduce((sum, item) => sum + item.payment, 0);
      const grandTotalTonnage = processedDetails.reduce((sum, item) => sum + item.tonnage, 0);
      const grandTotalWagons = processedDetails.reduce((sum, item) => sum + item.wagons, 0);
      const finalDetailsData = [
        ...processedDetails.sort((a, b) => new Date(a.date) - new Date(b.date)),
        { key: 'allowance', date: 'Allowance for Period', payment: allowanceForPeriod },
        {
          key: 'grand_total', date: 'Grand Total',
          tonnage: grandTotalTonnage, wagons: grandTotalWagons,
          payment: (grandTotalPayment + allowanceForPeriod),
        },
      ];
      setSalaryDetails(finalDetailsData);
    } catch (error) {
      messageApi.error(`Error generating details: ${error.message}`);
      setSalaryDetails([]);
    }
  };

  const columns = [
    { title: 'Worker Name', dataIndex: 'worker_name', key: 'worker_name', width: 150, fixed: 'left' },
    { title: 'Work Earning', dataIndex: 'work_earning', key: 'work_earning', width: 130, render: (val) => val.toFixed(2) },
    { title: 'Allowance', dataIndex: 'allowance', key: 'allowance', width: 120, render: (val) => val.toFixed(2) },
    { title: 'Total Salary', dataIndex: 'total_salary', key: 'total_salary', width: 130, render: (text) => <strong>{text.toFixed(2)}</strong> },
  ];
  
  const detailsColumns = [
    { 
  title: 'Date', 
  dataIndex: 'date', 
  key: 'date', 
  width: 120, 
  fixed: 'left',
  render: (text, record) => {
    // Agar yeh summary row hai (Allowance ya Grand Total), to sirf text dikhayen
    if (record.key === 'allowance' || record.key === 'grand_total') {
      return <strong>{text}</strong>;
    }
    
    // Agar asli entry hai, to format karein aur clickable banayen
    return (
      <Button type="link" onClick={() => onEditClick(text)} style={{ padding: 0, fontWeight: 'bold' }}>
        {dayjs(text).format('DD MMM YYYY')}
      </Button>
    );
  }
},
    { title: 'Tonnage', dataIndex: 'tonnage', key: 'tonnage', width: 100 },
    { title: 'Day Type', dataIndex: 'day_type', key: 'day_type', width: 120 },
    { title: 'Wagons', dataIndex: 'wagons', key: 'wagons', width: 100 },
    { title: 'Absent Workers', dataIndex: 'absent_workers', key: 'absent_workers', minWidth: 150 },
    { title: 'Payment', dataIndex: 'payment', key: 'payment', width: 120, render: (val) => typeof val === 'number' ? val.toFixed(2) : val },
  ];

  // <-- PDF KE LIYE DATA TAYYAR KARNA -->
  const getPdfData = () => {
    return salaryDetails.map(item => {
      const newItem = { ...item };
      if (typeof newItem.payment === 'number') {
        newItem.payment = newItem.payment.toFixed(2);
      }
      return newItem;
    });
  }

  const getPdfTitle = () => {
    const period = payPeriods.find(p => p.value === selectedPeriod);
    if (!period || !selectedWorker) return 'Salary Details';
    return `Salary Details for ${selectedWorker} (${period.label})`;
  };

  return (
    <Layout style={{ minHeight: '100vh', padding: '16px' }}>
      {contextHolder}
      <Content style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        <Title level={2}>Salary Report</Title>
        <Card>
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col xs={24} sm={24} md={9}>
              <Select
                placeholder="Select Pay Period" style={{ width: '100%' }}
                onChange={(value) => {
                  setSelectedPeriod(value); setSelectedWorker(null);
                  setSalaryDetails([]); setReportData([]);
                }}
                options={payPeriods} value={selectedPeriod}
              />
            </Col>
            <Col xs={24} sm={24} md={9}>
              <Select
                placeholder="Select Worker for Details" style={{ width: '100%' }}
                onChange={(workerName) => {
                  setSelectedWorker(workerName);
                  const period = payPeriods.find(p => p.value === selectedPeriod);
                  generateSalaryDetails(period, workerName, reportData, cachedEntries, cachedEarnings);
                }}
                options={reportData.map(r => ({ label: r.worker_name, value: r.worker_name }))}
                value={selectedWorker}
                disabled={!selectedPeriod || reportData.length === 0}
              />
            </Col>
            <Col xs={24} sm={24} md={6}>
              <Button type="primary" onClick={handleGenerateReport} loading={loading} style={{ width: '100%' }}>
                Generate Report
              </Button>
            </Col>
          </Row>

          <Spin spinning={loading}>
            <Table
              columns={columns} dataSource={reportData}
              pagination={false} scroll={{ x: 'max-content' }}
            />
          </Spin>
          {salaryDetails.length > 0 && (
            <div style={{ marginTop: '32px' }}>
              {/* <-- YAHAN TITLE AUR BUTTON ADD KIYE GAYE HAIN --> */}
              <Row justify="space-between" align="middle">
                <Col>
                  <Title level={4}>Salary Details (Day-wise Breakdown)</Title>
                </Col>
                <Col>
                  <DownloadToPdfButton
  data={getPdfData()}
  columns={detailsColumns}
  fileName={`Salary_Details_${selectedWorker}_${dayjs().format('YYYY-MM-DD')}`}
  title="Salary Details (Day-wise Breakdown)"
  workerName={selectedWorker}
  periodLabel={payPeriods.find(p => p.value === selectedPeriod)?.label}
/>
                </Col>
              </Row>
              <Table
                columns={detailsColumns} dataSource={salaryDetails}
                rowKey="key"
                pagination={false}
                bordered scroll={{ x: 'max-content' }}
                style={{ marginTop: '16px' }} // <-- Thora sa margin add kiya hai
              />
            </div>
          )}
        </Card>
      </Content>
    </Layout>
  );
};

export default SalaryReportPage;