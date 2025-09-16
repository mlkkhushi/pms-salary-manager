import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Form, Input, Button, message, Spin, Avatar, Layout, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';

const { Content } = Layout;
const { Title } = Typography;

const ProfilePage = ({ user }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('profiles')
          .select(`full_name, username, avatar_url`)
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
          throw error;
        }

        if (data) {
          setProfile(data);
          form.setFieldsValue(data);
          if (data.avatar_url) {
            downloadImage(data.avatar_url);
          }
        }
      } catch (error) {
        message.error('Error fetching profile: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user.id, form]);

  const downloadImage = async (path) => {
    try {
      const { data, error } = await supabase.storage.from('avatars').download(path);
      if (error) {
        throw error;
      }
      const url = URL.createObjectURL(data);
      setAvatarUrl(url);
    } catch (error) {
      console.error('Error downloading image: ', error.message);
    }
  };

  const onFinish = async (values) => {
    try {
      setLoading(true);
      const updates = {
        id: user.id,
        ...values,
        updated_at: new Date(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);

      if (error) {
        throw error;
      }
      message.success('Profile updated successfully!');
    } catch (error) {
      message.error('Error updating profile: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      message.error('Error signing out: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin size="large" tip="Loading Profile..." />
      </div>
    );
  }

  return (
    <Layout style={{ padding: '24px' }}>
      <Content>
        <Title level={2}>My Profile</Title>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={profile}
        >
          <Form.Item label="Avatar">
            <Avatar size={64} src={avatarUrl} icon={<UserOutlined />} />
            {/* Avatar upload functionality can be added later */}
          </Form.Item>
          <Form.Item
            label="Email"
          >
            <Input value={user.email} disabled />
          </Form.Item>
          <Form.Item
            label="Full Name"
            name="full_name"
            rules={[{ required: true, message: 'Please input your full name!' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Username"
            name="username"
            rules={[{ required: true, message: 'Please input your username!' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              Update Profile
            </Button>
          </Form.Item>
        </Form>
        <Button type="default" danger onClick={signOut} style={{ marginTop: '20px' }}>
          Sign Out
        </Button>
      </Content>
    </Layout>
  );
};

export default ProfilePage;