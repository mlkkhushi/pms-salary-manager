import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { db } from './db';
import { App as AntApp, Layout, Menu, ConfigProvider, theme, Button, Switch, Grid, Tag, Tooltip, Spin, message } from 'antd';
import {
  EditOutlined, DollarCircleOutlined, SettingOutlined, CarryOutOutlined, GiftOutlined,
  CalculatorOutlined, MenuOutlined, SunOutlined, MoonOutlined, CloudSyncOutlined,
  CloudOutlined, SyncOutlined
} from '@ant-design/icons';
import AuthPage from './components/AuthPage';
import DailyEntryPage from './components/DailyEntryPage';
import SalaryReportPage from './components/SalaryReportPage';
import SettingsPage from './components/SettingsPage';
import LeavesReportPage from './components/LeavesReportPage';
import AnnualBonusPage from './components/AnnualBonusPage';
import ArrearsPage from './components/ArrearsPage';
import './App.css';
import { SyncProvider, useSync } from './contexts/SyncContext';

const { Sider, Content, Header } = Layout;
const { useBreakpoint } = Grid;

const customDarkTheme = { token: { colorPrimary: '#1677ff', colorBgBase: '#1d1d1d', colorBgContainer: '#2b2b2b', colorText: 'rgba(255, 255, 255, 0.85)', colorTextSecondary: 'rgba(255, 255, 255, 0.65)', colorBorder: '#424242' }, algorithm: theme.darkAlgorithm };
const customLightTheme = { token: { colorPrimary: '#1677ff', colorBgBase: '#f0f2f5', colorBgContainer: '#ffffff' }, algorithm: theme.defaultAlgorithm };
const siderStyle = { background: '#1d1d1d', position: 'sticky', top: 0, height: '100vh' };
const mobileSiderStyle = { background: '#1d1d1d', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 1000, boxShadow: '0 0 10px rgba(0,0,0,0.5)' };

const SyncStatusIndicator = () => {
  const { isOnline, isSyncing } = useSync();
  if (isSyncing) return <Tag icon={<SyncOutlined spin />} color="processing" style={{ fontSize: '14px', padding: '5px 10px' }}>Syncing...</Tag>;
  if (isOnline) return <Tooltip title="You are connected."><Tag icon={<CloudSyncOutlined />} color="success" style={{ fontSize: '14px', padding: '5px 10px' }}>Online</Tag></Tooltip>;
  return <Tooltip title="You are offline."><Tag icon={<CloudOutlined />} color="warning" style={{ fontSize: '14px', padding: '5px 10px' }}>Offline</Tag></Tooltip>;
};

const AppContent = ({ user, isDarkMode, setIsDarkMode }) => {
  const [currentPage, setCurrentPage] = useState('daily_entry');
  const [collapsed, setCollapsed] = useState(true);
  const [initialSyncComplete, setInitialSyncComplete] = useState(false);
  const { isOnline, lastSyncTime } = useSync(); // lastSyncTime ko yahan hasil karein
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const syncWithSupabase = useCallback(async (isInitialSync) => {
    if (!isOnline) {
      if(isInitialSync) setInitialSyncComplete(true); // Agar offline hain to loading khatam karein
      return;
    }
    if(isInitialSync) message.info("Syncing initial data with server...");
    else message.info("Refreshing data from server...");

    try {
      const { data: settingsData } = await supabase.from('settings').select('*').eq('user_id', user.id);
      const { data: workersData } = await supabase.from('workers').select('*').eq('user_id', user.id);
      const { data: agreementsData } = await supabase.from('agreements').select('*').eq('user_id', user.id);
      const { data: entriesData } = await supabase.from('daily_entries').select('*').eq('user_id', user.id);
      const { data: earningsData } = await supabase.from('daily_earnings').select('*').eq('user_id', user.id);

      await db.transaction('rw', db.settings, db.workers, db.agreements, db.daily_entries, db.daily_earnings, async () => {
        await db.settings.where('user_id').equals(user.id).delete();
        await db.workers.where('user_id').equals(user.id).delete();
        await db.agreements.where('user_id').equals(user.id).delete();
        await db.daily_entries.where('user_id').equals(user.id).delete();
        await db.daily_earnings.where('user_id').equals(user.id).delete();
        
        await db.settings.bulkAdd(settingsData || []);
        await db.workers.bulkAdd(workersData || []);
        await db.agreements.bulkAdd(agreementsData || []);
        
        for (const entry of (entriesData || [])) {
            const localEntryId = await db.daily_entries.add({ ...entry, synced: true });
            const relatedEarnings = (earningsData || []).filter(e => e.entry_id === entry.id);
            if (relatedEarnings.length > 0) {
                await db.daily_earnings.bulkAdd(relatedEarnings.map(e => ({...e, entry_local_id: localEntryId})));
            }
        }
      });
      if(isInitialSync) message.success("Initial data sync complete.");
    } catch (error) {
      message.error("Failed to sync data.");
    } finally {
      if(isInitialSync) setInitialSyncComplete(true);
    }
  }, [user.id, isOnline]);

  useEffect(() => {
    // Pehli baar data download karein
    syncWithSupabase(true);
  }, []); // Sirf ek baar chalega

  useEffect(() => {
    // Jab bhi upload mukammal ho, to data ko refresh karein
    if (lastSyncTime) {
      syncWithSupabase(false);
    }
  }, [lastSyncTime, syncWithSupabase]);


  useEffect(() => { if (!isMobile) setCollapsed(false); }, [isMobile]);

  const menuItems = [
    { key: 'daily_entry', icon: <EditOutlined />, label: 'Daily Entry' },
    { key: 'salary_report', icon: <DollarCircleOutlined />, label: 'Salary Report' },
    { key: 'leaves_report', icon: <CarryOutOutlined />, label: 'Leaves Report' },
    { key: 'annual_bonus', icon: <GiftOutlined />, label: 'Annual Bonus' },
    { key: 'arrears', icon: <CalculatorOutlined />, label: 'Arrears' },
    { key: 'settings', icon: <SettingOutlined />, label: 'Settings' },
  ];

  const handleMenuClick = (e) => {
    setCurrentPage(e.key);
    if (isMobile) setCollapsed(true);
  };

  const renderPage = () => {
    if (!initialSyncComplete && isOnline) {
      return <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%'}}><Spin size="large" tip="Loading initial data..." /></div>;
    }
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

  const AppMenu = () => (
    <>
      <div className="logo-container"><h2 style={{ color: 'white', textAlign: 'center', margin: '16px 0' }}>Salary App</h2></div>
      <Menu theme="dark" mode="inline" defaultSelectedKeys={['daily_entry']} items={menuItems} onClick={handleMenuClick} style={{ background: 'transparent', borderRight: 0, fontSize: '16px' }} />
      <div className="theme-switch-container"><Switch checkedChildren={<MoonOutlined />} unCheckedChildren={<SunOutlined />} checked={isDarkMode} onChange={setIsDarkMode} /></div>
    </>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible={!isMobile} collapsed={isMobile ? false : collapsed} onCollapse={isMobile ? null : (value) => setCollapsed(value)} trigger={isMobile ? null : undefined} collapsedWidth={isMobile ? 0 : 80} breakpoint="md" style={isMobile ? (collapsed ? { display: 'none' } : mobileSiderStyle) : siderStyle} width={220}>
        <AppMenu />
      </Sider>
      <Layout>
        <Header className="app-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            {isMobile ? <Button type="text" icon={<MenuOutlined />} onClick={() => setCollapsed(!collapsed)} className="menu-toggle-btn" /> : <div />}
            <SyncStatusIndicator />
          </div>
        </Header>
        {!collapsed && isMobile && <div onClick={() => setCollapsed(true)} className="overlay" />}
        <Content className="app-content">{renderPage()}</Content>
      </Layout>
    </Layout>
  );
};

function App() {
  const [session, setSession] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);
  return (
    <ConfigProvider theme={isDarkMode ? customDarkTheme : customLightTheme}>
      <AntApp>
        <SyncProvider>
          <div className="App">
            {!session ? <AuthPage /> : <AppContent user={session.user} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />}
          </div>
        </SyncProvider>
      </AntApp>
    </ConfigProvider>
  );
}
export default App;