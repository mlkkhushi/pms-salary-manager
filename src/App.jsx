import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { App as AntApp, Layout, Menu, ConfigProvider, theme, Button, Switch, Grid } from 'antd';
import {
  EditOutlined,
  DollarCircleOutlined,
  SettingOutlined,
  CarryOutOutlined,
  GiftOutlined,
  CalculatorOutlined,
  MenuOutlined,
  SunOutlined,
  MoonOutlined
} from '@ant-design/icons';
import AuthPage from './components/AuthPage';
import DailyEntryPage from './components/DailyEntryPage';
import SalaryReportPage from './components/SalaryReportPage';
import SettingsPage from './components/SettingsPage';
import LeavesReportPage from './components/LeavesReportPage';
import AnnualBonusPage from './components/AnnualBonusPage';
import ArrearsPage from './components/ArrearsPage';
import './App.css';

const { Sider, Content, Header } = Layout;
const { useBreakpoint } = Grid;

// --- Custom Dark Theme (Aapki image ke mutabiq) ---
const customDarkTheme = {
  token: {
    colorPrimary: '#1677ff',
    colorBgBase: '#1d1d1d',      // Page ka background
    colorBgContainer: '#2b2b2b', // Cards, Header, Inputs ka background
    colorText: 'rgba(255, 255, 255, 0.85)',
    colorTextSecondary: 'rgba(255, 255, 255, 0.65)',
    colorBorder: '#424242',
  },
  algorithm: theme.darkAlgorithm,
};

// --- Custom Light Theme ---
const customLightTheme = {
  token: {
    colorPrimary: '#1677ff',
    colorBgBase: '#f0f2f5',
    colorBgContainer: '#ffffff',
  },
  algorithm: theme.defaultAlgorithm,
};

// --- Sider ka alag style jo hamesha dark rahega ---
const siderStyle = {
  background: '#1d1d1d', // Sider ka background color
  position: 'sticky',
  top: 0,
  height: '100vh',
};

const mobileSiderStyle = {
  background: '#1d1d1d',
  position: 'fixed',
  top: 0,
  left: 0,
  height: '100vh',
  zIndex: 1000,
  boxShadow: '0 0 10px rgba(0,0,0,0.5)',
};


const AppContent = ({ user, isDarkMode, setIsDarkMode }) => {
  const [currentPage, setCurrentPage] = useState('daily_entry');
  const [collapsed, setCollapsed] = useState(true); // Mobile par shuru mein band
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  useEffect(() => {
    // Desktop par menu shuru mein khula ho
    if (!isMobile) {
      setCollapsed(false);
    }
  }, [isMobile]);

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
    if (isMobile) {
      setCollapsed(true);
    }
  };

  const renderPage = () => {
    // ... (renderPage logic wesa hi rahega) ...
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
      <div className="logo-container">
        <h2 style={{ color: 'white', textAlign: 'center', margin: '16px 0' }}>Salary App</h2>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        defaultSelectedKeys={['daily_entry']}
        items={menuItems}
        onClick={handleMenuClick}
        style={{ background: 'transparent', borderRight: 0, fontSize: '16px' }}
      />
      {/* Toggle button ab menu ke andar hai */}
      <div className="theme-switch-container">
        <Switch
          checkedChildren={<MoonOutlined />}
          unCheckedChildren={<SunOutlined />}
          checked={isDarkMode}
          onChange={setIsDarkMode}
        />
      </div>
    </>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible={!isMobile}
        collapsed={isMobile ? false : collapsed} // Mobile par collapse prop kaam nahi karega
        onCollapse={isMobile ? null : (value) => setCollapsed(value)}
        trigger={isMobile ? null : undefined}
        collapsedWidth={isMobile ? 0 : 80}
        breakpoint="md"
        style={isMobile ? (collapsed ? { display: 'none' } : mobileSiderStyle) : siderStyle}
        width={220}
      >
        <AppMenu />
      </Sider>

      <Layout>
        <Header className="app-header">
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="menu-toggle-btn"
            />
          )}
        </Header>
        
        {!collapsed && isMobile && (
          <div onClick={() => setCollapsed(true)} className="overlay" />
        )}

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
        <div className="App">
          {!session ? <AuthPage /> : <AppContent user={session.user} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />}
        </div>
      </AntApp>
    </ConfigProvider>
  );
}
export default App;