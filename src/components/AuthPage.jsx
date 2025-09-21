import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { db } from '../db'; // db ko yahan import karein
import { Layout, Flex, Form, Input, Button, message, Card, Tabs } from 'antd';

const AuthForm = ({ isSignUp }) => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async (values) => {
    setLoading(true);
    const { email, password } = values;

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        message.success('Signup successful! Please check your email for a confirmation link.');
        form.resetFields();
      } else {
        // --- YEH HAI NAYI TABDEELI ---
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Kamyab login par, user ki maloomat ko local DB mein save karein
        if (data.user) {
          await db.offline_session.put({
            id: 'currentUser', // Hum hamesha ek hi record ko update karenge
            user: data.user
          });
        }
        message.success('Signed in successfully!');
      }
    } catch (error) {
      message.error(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit}>
      <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email', message: 'Please input a valid email!' }]}>
        <Input placeholder="Your email address" />
      </Form.Item>
      <Form.Item label="Password" name="password" rules={[{ required: true, min: 6, message: 'Password must be at least 6 characters.' }]}>
        <Input.Password placeholder="Your password" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>
          {isSignUp ? 'Sign Up' : 'Sign In'}
        </Button>
      </Form.Item>
    </Form>
  );
};

const AuthPage = () => {
  const items = [
    { key: '1', label: 'Sign In', children: <AuthForm isSignUp={false} /> },
    { key: '2', label: 'Sign Up', children: <AuthForm isSignUp={true} /> },
  ];
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Flex align="center" justify="center" style={{ minHeight: '100vh' }}>
        <Card title="Welcome" style={{ width: '350px' }}>
          <Tabs defaultActiveKey="1" items={items} centered />
        </Card>
      </Flex>
    </Layout>
  );
};

export default AuthPage;