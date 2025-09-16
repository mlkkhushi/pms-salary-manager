import React, { useState } from 'react';
import { db } from '../db'; // Dexie DB istemal karein
import { Layout, Typography, Button, Card, Table, message, Spin } from 'antd';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
dayjs.extend(isBetween);

const { Content } = Layout;
const { Title } = Typography;

const pageStyles = { padding: '12px' };
const contentStyles = { maxWidth: '1000px', margin: '0 auto', width: '100%' };
const cardStyles = { borderRadius: '8px' };

const ArrearsPage = ({ user }) => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const handleCalculateArrears = async () => {
    setLoading(true);
    setReportData([]);
    try {
      // Tamam data local Dexie DB se fetch karein
      const settings = await db.settings.where('user_id').equals(user.id).first();
      if (!settings || !settings.agreement_start_date) throw new Error('Agreement Start Date not set. Please go online to sync.');

      const oldAgreement = await db.agreements.where('[user_id+agreement_name]').equals([user.id, 'Current Agreement']).first();
      if (!oldAgreement) throw new Error('Could not find Current Agreement locally.');

      const newAgreement = await db.agreements.where('[user_id+agreement_name]').equals([user.id, 'New Agreement']).first();
      if (!newAgreement) throw new Error('Could not find New Agreement locally.');

      const allWorkers = await db.workers.where('user_id').equals(user.id).toArray();
      if (allWorkers.length === 0) throw new Error('Could not find workers list locally.');

      const allEntries = await db.daily_entries.where('user_id').equals(user.id).and(e => dayjs(e.entry_date).isAfter(dayjs(settings.agreement_start_date).subtract(1, 'day'))).toArray();
      const allEntryLocalIds = allEntries.map(e => e.local_id);
      const allEarningsData = await db.daily_earnings.where('entry_local_id').anyOf(allEntryLocalIds).toArray();

      const arrearsSummary = {};
      allWorkers.forEach(w => { arrearsSummary[w.worker_name] = { salary_arrears: 0, allowance_arrears: 0, bonus_arrears: 0 }; });

      // Salary Arrears Calculation
      let current = dayjs(settings.agreement_start_date);
      const today = dayjs();
      while (current.isBefore(today)) {
        const entry = allEntries.find(e => dayjs(e.entry_date).isSame(current, 'day'));
        if (entry && entry.day_type === 'Work Day') {
            const presentWorkers = allEarningsData.filter(e => e.entry_local_id === entry.local_id && e.attendance_status === 'Present').map(e => e.worker_name);
            if (presentWorkers.length > 0) {
              let oldTonnageEarning = (entry.tonnage * oldAgreement.ton_rate) / presentWorkers.length;
              oldTonnageEarning = Math.max(oldTonnageEarning, oldAgreement.layoff_rate);
              let newTonnageEarning = (entry.tonnage * newAgreement.ton_rate) / presentWorkers.length;
              newTonnageEarning = Math.max(newTonnageEarning, newAgreement.layoff_rate);
              const dailyDifference = newTonnageEarning - oldTonnageEarning;
              if (dailyDifference > 0) {
                presentWorkers.forEach(worker => { arrearsSummary[worker].salary_arrears += dailyDifference; });
              }
            }
        }
        current = current.add(1, 'day');
      }

      // Allowance Arrears Calculation
      let allowanceCurrent = dayjs(settings.agreement_start_date);
      while (allowanceCurrent.isBefore(today)) {
        const endOfMonth = allowanceCurrent.endOf('month');
        let periodEnd = allowanceCurrent.date() <= 15 ? allowanceCurrent.date(15) : endOfMonth;
        if (periodEnd.isAfter(today)) periodEnd = today;
        const isNonStandard = !((allowanceCurrent.date() === 1 && periodEnd.date() === 15) || (allowanceCurrent.date() === 16 && periodEnd.isSame(allowanceCurrent.endOf('month'), 'day')));
        let oldAllowance = (oldAgreement.allowance_calculation_type === 'Pro-Rata' && isNonStandard) ? ((oldAgreement.monthly_allowance / 30) * (periodEnd.diff(allowanceCurrent, 'day') + 1)) : (oldAgreement.monthly_allowance / 2);
        let newAllowance = (newAgreement.allowance_calculation_type === 'Pro-Rata' && isNonStandard) ? ((newAgreement.monthly_allowance / 30) * (periodEnd.diff(allowanceCurrent, 'day') + 1)) : (newAgreement.monthly_allowance / 2);
        const allowanceDiff = newAllowance - oldAllowance;
        if (allowanceDiff > 0) {
          allWorkers.forEach(w => { arrearsSummary[w.worker_name].allowance_arrears += allowanceDiff; });
        }
        allowanceCurrent = periodEnd.add(1, 'day');
      }

      // Bonus Arrears Calculation (Yeh logic bohot paicheeda hai, isay ehtiyat se offline kiya gaya hai)
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
              const entryLocalIdsThisYear = entriesThisYear.map(e => e.local_id);
              const earningsThisYear = allEarningsData.filter(e => entryLocalIdsThisYear.includes(e.entry_local_id) && e.worker_name === workerName);
              
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
              
              // New bonus calculation needs to be based on new rates applied to old work
              const newAnnualWorkEarnings = 0; // Arrears are calculated on top, not by recalculating work
              const newAnnualAllowance = (newAgreement.monthly_allowance || 0) * 12;
              const newTotalAnnual = oldAnnualWorkEarnings + newAnnualAllowance; // Use old work earnings with new allowance
              const newAvgSalary = newTotalAnnual > 0 ? newTotalAnnual / 12 : 0;
              const newAbsences = oldAbsences;
              const newUnpaidTaken = Math.min(newAbsences, newAgreement.without_paid_leaves || 0);
              const newPaidTaken = Math.min(newAbsences - newUnpaidTaken, newAgreement.paid_leaves || 0);
              const newRemainingPaid = (newAgreement.paid_leaves || 0) - newPaidTaken;
              const newPaidLeavesBonus = newRemainingPaid * (newAgreement.paid_leave_rate || 0);
              const newBonusPackage = newAvgSalary + newAvgSalary + newPaidLeavesBonus;
              
              const bonusDiff = newBonusPackage - oldBonusPackage;
              if (bonusDiff > 0) {
                arrearsSummary[workerName].bonus_arrears += bonusDiff;
              }
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