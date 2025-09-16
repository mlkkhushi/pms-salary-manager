import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Typography, Button, Card, Table, message, Spin } from 'antd';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
dayjs.extend(isBetween);

const { Content } = Layout;
const { Title } = Typography;

// --- Consistent Styles ---
const pageStyles = {
  padding: '12px',
};

const contentStyles = {
  maxWidth: '1000px',
  margin: '0 auto',
  width: '100%',
};

const cardStyles = {
  borderRadius: '8px',
};

const ArrearsPage = ({ user }) => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  // Arrears calculate karne ki logic bilkul wesi hi rahegi
  const handleCalculateArrears = async () => {
    setLoading(true);
    setReportData([]);
    try {
      const { data: settings, error: settingsError } = await supabase.from('settings').select('agreement_start_date').eq('user_id', user.id).single();
      if (settingsError || !settings.agreement_start_date) throw new Error('Agreement Start Date not set.');
      const { data: oldAgreement, error: oldAgreementError } = await supabase.from('agreements').select('*').eq('user_id', user.id).eq('agreement_name', 'Current Agreement').single();
      if (oldAgreementError) throw new Error('Could not fetch Current Agreement.');
      const { data: newAgreement, error: newAgreementError } = await supabase.from('agreements').select('*').eq('user_id', user.id).eq('agreement_name', 'New Agreement').single();
      if (newAgreementError) throw new Error('Could not fetch New Agreement.');
      const { data: allWorkers, error: workersError } = await supabase.from('workers').select('worker_name').eq('user_id', user.id);
      if (workersError) throw new Error('Could not fetch workers list.');
      const { data: allEntries, error: entriesError } = await supabase.from('daily_entries').select('id, entry_date, day_type, tonnage').eq('user_id', user.id).gte('entry_date', settings.agreement_start_date).order('entry_date');
      if (entriesError) throw new Error('Could not fetch daily entries.');
      const allEntryIds = allEntries.map(e => e.id);
      const { data: allEarningsData, error: earningsError } = await supabase.from('daily_earnings').select('entry_id, worker_name, attendance_status, earning').in('entry_id', allEntryIds);
      if (earningsError) throw new Error('Could not fetch daily earnings.');
      const arrearsSummary = {};
      allWorkers.forEach(w => { arrearsSummary[w.worker_name] = { salary_arrears: 0, allowance_arrears: 0, bonus_arrears: 0 }; });
      let current = dayjs(settings.agreement_start_date);
      const today = dayjs();
      while (current.isBefore(today)) {
        const entry = allEntries.find(e => dayjs(e.entry_date).isSame(current, 'day'));
        if (entry && entry.day_type === 'Work Day') {
            const presentWorkers = allEarningsData.filter(e => e.entry_id === entry.id && e.attendance_status === 'Present').map(e => e.worker_name);
            if (presentWorkers.length > 0) {
              let oldTonnageEarning = (entry.tonnage * oldAgreement.ton_rate) / presentWorkers.length;
              oldTonnageEarning = Math.max(oldTonnageEarning, oldAgreement.layoff_rate);
              let newTonnageEarning = (entry.tonnage * newAgreement.ton_rate) / presentWorkers.length;
              newTonnageEarning = Math.max(newTonnageEarning, newAgreement.layoff_rate);
              const dailyDifference = newTonnageEarning - oldTonnageEarning;
              presentWorkers.forEach(worker => { arrearsSummary[worker].salary_arrears += dailyDifference; });
            }
        }
        current = current.add(1, 'day');
      }
      let allowanceCurrent = dayjs(settings.agreement_start_date);
      while (allowanceCurrent.isBefore(today)) {
        const endOfMonth = allowanceCurrent.endOf('month');
        let periodEnd = allowanceCurrent.date() <= 15 ? allowanceCurrent.date(15) : endOfMonth;
        if (periodEnd.isAfter(today)) periodEnd = today;
        const isNonStandard = !( (allowanceCurrent.date() === 1 && periodEnd.date() === 15) || (allowanceCurrent.date() === 16 && periodEnd.isSame(allowanceCurrent.endOf('month'), 'day')) );
        let oldAllowance = (oldAgreement.allowance_calculation_type === 'Pro-Rata' && isNonStandard) ? ((oldAgreement.monthly_allowance / 30) * (periodEnd.diff(allowanceCurrent, 'day') + 1)) : (oldAgreement.monthly_allowance / 2);
        let newAllowance = (newAgreement.allowance_calculation_type === 'Pro-Rata' && isNonStandard) ? ((newAgreement.monthly_allowance / 30) * (periodEnd.diff(allowanceCurrent, 'day') + 1)) : (newAgreement.monthly_allowance / 2);
        const allowanceDiff = newAllowance - oldAllowance;
        allWorkers.forEach(w => { arrearsSummary[w.worker_name].allowance_arrears += allowanceDiff; });
        allowanceCurrent = periodEnd.add(1, 'day');
      }
      const fiscalYears = [];
      let yearStart = dayjs(settings.agreement_start_date);
      while(yearStart.add(1, 'year').isBefore(today)) {
          fiscalYears.push({ start: yearStart, end: yearStart.add(1, 'year').subtract(1, 'day') });
          yearStart = yearStart.add(1, 'year');
      }
      for (const year of fiscalYears) {
        const agreementForOldBonus = year.start.isSame(dayjs(settings.agreement_start_date), 'day') ? oldAgreement : newAgreement;
          for (const worker of allWorkers) {
              const workerName = worker.worker_name;
              const entriesThisYear = allEntries.filter(e => dayjs(e.entry_date).isBetween(year.start, year.end, null, '[]'));
              const entryIdsThisYear = entriesThisYear.map(e => e.id);
              const earningsThisYear = allEarningsData.filter(e => entryIdsThisYear.includes(e.entry_id) && e.worker_name === workerName);
              const oldAnnualWorkEarnings = earningsThisYear.reduce((acc, curr) => acc + curr.earning, 0);
              const oldAnnualAllowance = (agreementForOldBonus.monthly_allowance || 0) * 12;
              const oldTotalAnnual = oldAnnualWorkEarnings + oldAnnualAllowance;
              const oldAvgSalary = oldTotalAnnual > 0 ? oldTotalAnnual / 12 : 0;
              const oldAbsences = earningsThisYear.filter(e => e.attendance_status === 'Absent').length;
              const oldUnpaidTaken = Math.min(oldAbsences, agreementForOldBonus.without_paid_leaves || 0);
              const oldPaidTaken = Math.min(oldAbsences - oldUnpaidTaken, agreementForOldBonus.paid_leaves || 0);
              const oldRemainingPaid = (agreementForOldBonus.paid_leaves || 0) - oldPaidTaken;
              const oldPaidLeavesBonus = oldRemainingPaid * (agreementForOldBonus.paid_leave_rate || 0);
              const oldBonusPackage = oldAvgSalary + oldAvgSalary + oldPaidLeavesBonus;
              const newAnnualWorkEarnings = 0;
              const newAnnualAllowance = (newAgreement.monthly_allowance || 0) * 12;
              const newTotalAnnual = newAnnualWorkEarnings + newAnnualAllowance;
              const newAvgSalary = newTotalAnnual > 0 ? newTotalAnnual / 12 : 0;
              const newAbsences = oldAbsences;
              const newUnpaidTaken = Math.min(newAbsences, newAgreement.without_paid_leaves || 0);
              const newPaidTaken = Math.min(newAbsences - newUnpaidTaken, newAgreement.paid_leaves || 0);
              const newRemainingPaid = (newAgreement.paid_leaves || 0) - newPaidTaken;
              const newPaidLeavesBonus = newRemainingPaid * (newAgreement.paid_leave_rate || 0);
              const newBonusPackage = newAvgSalary + newAvgSalary + newPaidLeavesBonus;
              arrearsSummary[workerName].bonus_arrears += (newBonusPackage - oldBonusPackage);
          }
      }
      const finalData = Object.keys(arrearsSummary).map(workerName => ({
        key: workerName,
        worker_name: workerName,
        salary_arrears: arrearsSummary[workerName].salary_arrears,
        allowance_arrears: arrearsSummary[workerName].allowance_arrears,
        bonus_arrears: arrearsSummary[workerName].bonus_arrears,
        total_arrears: arrearsSummary[workerName].salary_arrears + arrearsSummary[workerName].allowance_arrears + arrearsSummary[workerName].bonus_arrears,
      }));
      setReportData(finalData);
    } catch (error) {
      messageApi.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: 'Worker Name', dataIndex: 'worker_name', key: 'worker_name', fixed: 'left' },
    { title: 'Salary Arrears', dataIndex: 'salary_arrears', key: 'salary_arrears', render: val => val.toFixed(2) },
    { title: 'Allowance Arrears', dataIndex: 'allowance_arrears', key: 'allowance_arrears', render: val => val.toFixed(2) },
    { title: 'Bonus Arrears', dataIndex: 'bonus_arrears', key: 'bonus_arrears', render: val => val.toFixed(2) },
    { title: 'Total Arrears', dataIndex: 'total_arrears', key: 'total_arrears', render: val => <strong>{val.toFixed(2)}</strong> },
  ];

  return (
    <div style={pageStyles}>
      {contextHolder}
      <div style={contentStyles}>
        <Title level={2} style={{ marginBottom: '16px' }}>Arrears Calculation</Title>
        <Card style={cardStyles}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <Button type="primary" size="large" onClick={handleCalculateArrears} loading={loading}>
              Calculate Automatic Arrears
            </Button>
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
      </div>
    </div>
  );
};

export default ArrearsPage;