import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Layout, Typography, Form, InputNumber, Button, Card, Col, Row, message, DatePicker, Divider, Radio, Switch } from 'antd';
import dayjs from 'dayjs';
import WorkersSection from './WorkersSection';
// PenaltySettings ka import hata diya gaya hai

const { Content } = Layout;
const { Title } = Typography;

// Agreement Form ka component
const AgreementForm = ({ title, user, messageApi, isWagonSystemEnabled }) => {
  // ... (Is component mein koi tabdeeli nahi) ...
  const [form] = Form.useForm();
  useEffect(() => {
    const fetchAgreement = async () => {
      const { data } = await supabase.from('agreements').select('*').eq('user_id', user.id).eq('agreement_name', title).single();
      if (data) form.setFieldsValue(data);
    };
    fetchAgreement();
  }, [form, title, user.id]);
  const onFinish = async (values) => {
    try {
      await supabase.from('agreements').upsert({ user_id: user.id, agreement_name: title, ...values }, { onConflict: 'user_id, agreement_name' });
      messageApi.success(`${title} saved successfully!`);
    } catch (error) {
      messageApi.error(`Failed to save ${title}.`);
    }
  };
  return (
    <Card title={title}>
      <Form form={form} name={title.toLowerCase().replace(/ /g, '_')} layout="vertical" onFinish={onFinish} initialValues={{ allowance_calculation_type: 'Normal' }}>
        <Row gutter={16}><Col span={12}><Form.Item label="Ton Rate" name="ton_rate"><InputNumber style={{ width: '100%' }} /></Form.Item></Col><Col span={12}><Form.Item label="Rest Rate" name="rest_rate"><InputNumber style={{ width: '100%' }} /></Form.Item></Col></Row>
        <Row gutter={16}><Col span={12}><Form.Item label="Layoff Rate" name="layoff_rate"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>{isWagonSystemEnabled && (<Col span={12}><Form.Item label="Wagon Rate" name="wagon_rate"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>)}</Row>
        <Row gutter={16}><Col span={24}><Form.Item label="Monthly Allowance" name="monthly_allowance"><InputNumber style={{ width: '100%' }} /></Form.Item></Col></Row>
        <Row gutter={16}><Col span={24}><Form.Item label="Allowance Calculation Method" name="allowance_calculation_type"><Radio.Group><Radio value="Normal">Normal (Half Monthly)</Radio><Radio value="Pro-Rata">Pro-Rata (Daily Basis)</Radio></Radio.Group></Form.Item></Col></Row>
        <Row gutter={16}><Col span={12}><Form.Item label="Without Paid Leaves" name="without_paid_leaves"><InputNumber style={{ width: '100%' }} /></Form.Item></Col><Col span={12}><Form.Item label="Paid Leaves" name="paid_leaves"><InputNumber style={{ width: '100%' }} /></Form.Item></Col></Row>
        <Row gutter={16}><Col span={12}><Form.Item label="Paid Leave Rate" name="paid_leave_rate"><InputNumber style={{ width: '100%' }} /></Form.Item></Col></Row>
        <Form.Item><Button type="primary" htmlType="submit">Save {title}</Button></Form.Item>
      </Form>
    </Card>
  );
};

// Agreement Start Date ka component (YAHAN GHALTI THEEK KI GAYI HAI)
const AgreementStartDate = ({ user, messageApi }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('settings').select('agreement_start_date').eq('user_id', user.id).single();
      if (data && data.agreement_start_date) {
        form.setFieldsValue({ agreement_start_date: dayjs(data.agreement_start_date) });
      }
    };
    fetchSettings();
  }, [form, user.id]);
  const onFinish = async (values) => {
    setLoading(true);
    try {
      // .update() ke bajaye .upsert() istemal karein
      const { error } = await supabase
        .from('settings')
        .upsert({
          user_id: user.id, // user_id bhi bhejna zaroori hai
          agreement_start_date: values.agreement_start_date ? values.agreement_start_date.format('YYYY-MM-DD') : null
        }, {
          onConflict: 'user_id' // Batayein ke user_id unique hai
        });

      if (error) throw error;
      messageApi.success('Agreement start date saved successfully!');
    } catch (error) {
      messageApi.error('Failed to save start date.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card title="Agreement Start Date">
      <Form form={form} onFinish={onFinish} layout="vertical">
        <Form.Item label="Select Start Date" name="agreement_start_date"><DatePicker style={{ width: '100%' }} /></Form.Item>
        <Form.Item><Button type="primary" htmlType="submit" loading={loading}>Save Start Date</Button></Form.Item>
      </Form>
    </Card>
  );
};

// Wagon Settings ka component
const WagonSettings = ({ user, messageApi, onWagonSystemChange }) => {
  // ... (Is component mein koi tabdeeli nahi) ...
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('settings').select('is_wagon_system_enabled').eq('user_id', user.id).single();
      if (data) {
        form.setFieldsValue(data);
        onWagonSystemChange(data.is_wagon_system_enabled);
      }
    };
    fetchSettings();
  }, [form, user.id, onWagonSystemChange]);
  const onFinish = async (values) => {
    setLoading(true);
    try {
      await supabase.from('settings').update({ is_wagon_system_enabled: values.is_wagon_system_enabled }).eq('user_id', user.id);
      messageApi.success('Wagon settings saved successfully!');
      onWagonSystemChange(values.is_wagon_system_enabled);
    } catch (error) {
      messageApi.error('Failed to save wagon settings.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card title="Wagon Rate System">
      <Form form={form} onFinish={onFinish} layout="vertical" initialValues={{ is_wagon_system_enabled: false }}>
        <Form.Item name="is_wagon_system_enabled" label="Enable Wagon Rate Calculation" valuePropName="checked"><Switch /></Form.Item>
        <Form.Item><Button type="primary" htmlType="submit" loading={loading}>Save Wagon Settings</Button></Form.Item>
      </Form>
    </Card>
  );
};

// Main Settings Page
const SettingsPage = ({ user }) => {
  // ... (Is component mein koi tabdeeli nahi) ...
  const [messageApi, contextHolder] = message.useMessage();
  const [isWagonSystemEnabled, setIsWagonSystemEnabled] = useState(false);
  return (
    <Layout style={{ minHeight: '100vh', padding: '24px' }}>
      {contextHolder}
      <Content>
        <Title level={2}>Settings</Title>
        <AgreementStartDate user={user} messageApi={messageApi} />
        <Divider />
        <div style={{marginTop: '24px'}}><WagonSettings user={user} messageApi={messageApi} onWagonSystemChange={setIsWagonSystemEnabled} /></div>
        <Divider />
        <Title level={4} style={{marginTop: '24px'}}>Agreement Details</Title>
        <Row gutter={[24, 24]}><Col xs={24} lg={12}><AgreementForm title="Current Agreement" user={user} messageApi={messageApi} isWagonSystemEnabled={isWagonSystemEnabled} /></Col><Col xs={24} lg={12}><AgreementForm title="New Agreement" user={user} messageApi={messageApi} isWagonSystemEnabled={isWagonSystemEnabled} /></Col></Row>
        <Divider />
        <div style={{marginTop: '24px'}}><WorkersSection user={user} messageApi={messageApi} /></div>
      </Content>
    </Layout>
  );
};
export default SettingsPage;