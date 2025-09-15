import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { App as AntApp, Layout, Menu } from 'antd';
import { EditOutlined, DollarCircleOutlined, SettingOutlined, CarryOutOutlined, GiftOutlined, CalculatorOutlined } from '@ant-design/icons';
import AuthPage from './components/AuthPage';
import DailyEntryPage from './components/DailyEntryPage';
import SalaryReportPage from './components/SalaryReportPage';
import SettingsPage from './components/SettingsPage';
import LeavesReportPage from './components/LeavesReportPage';
import AnnualBonusPage from './components/AnnualBonusPage';
import ArrearsPage from './components/ArrearsPage';
import './App.css';

const { Sider, Content } = Layout;

const AppContent = ({ user }) => {
  const [currentPage, setCurrentPage] = useState('daily_entry');
  const menuItems = [
    { key: 'daily_entry', icon: <EditOutlined />, label: 'Daily Entry' },
    { key: 'salary_report', icon: <DollarCircleOutlined />, label: 'Salary Report' },
    { key: 'leaves_report', icon: <CarryOutOutlined />, label: 'Leaves Report' },
    { key: 'annual_bonus', icon: <GiftOutlined />, label: 'Annual Bonus' },
    { key: 'arrears', icon: <CalculatorOutlined />, label: 'Arrears' },
    { key: 'settings', icon: <SettingOutlined />, label: 'Settings' },
  ];
  const renderPage = () => {
    switch (currentPage) {
      case 'daily_entry': return <DailyEntryPage user={user} />;
      case 'salary_report': return <SalaryReportPage user={user} />;
      case 'leaves_report': return <LeavesReportPage user={user} />;
      case 'annual_bonus': return <AnnualBonusPage user={user} />;
      case 'arrears': return <ArrearsPage user={user} />;
      case 'settings': return <SettingsPage user={user} />;
      default: return <DailyEntryPage user={user} />;
    }
  };
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible>
        <div className="logo" />
        <Menu theme="dark" mode="inline" defaultSelectedKeys={['daily_entry']} items={menuItems} onClick={(e) => setCurrentPage(e.key)} />
      </Sider>
      <Layout><Content>{renderPage()}</Content></Layout>
    </Layout>
  );
};

function App() {
  const [session, setSession] = useState(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);
  return (
    <AntApp>
      <div className="App">{!session ? <AuthPage /> : <AppContent user={session.user} />}</div>
    </AntApp>
  );
}
export default App;