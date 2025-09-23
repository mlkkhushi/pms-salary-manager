import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Card, Form, InputNumber, Button, Input, Typography, Space, Divider, Modal, Spin } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons'; // Icon import karein

const { Text } = Typography;

const CONFIRMATION_KEYWORD = 'CONFIRM';

const WorkersSection = ({ user, messageApi }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [initialFormValues, setInitialFormValues] = useState({});
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const fetchWorkers = async () => {
      setIsFetching(true);
      const { data, error } = await supabase
        .from('workers')
        .select('worker_name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        messageApi.error("Failed to fetch workers data.");
        setIsFetching(false);
        return;
      }

      if (data && data.length > 0) {
        const initialValues = { num_workers: data.length };
        data.forEach((worker, index) => {
          initialValues[`worker_${index}`] = worker.worker_name;
        });
        form.setFieldsValue(initialValues);
        setInitialFormValues(initialValues);
        setIsEditing(false);
      } else {
        const initialValues = { num_workers: 0 };
        form.setFieldsValue(initialValues);
        setInitialFormValues(initialValues);
        setIsEditing(true);
      }
      setIsFetching(false);
    };
    fetchWorkers();
  }, [form, user.id, messageApi]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await supabase.from('workers').delete().eq('user_id', user.id);

      const workerCount = values.num_workers || 0;
      const newWorkers = [];
      for (let i = 0; i < workerCount; i++) {
        const workerName = values[`worker_${i}`];
        if (workerName && workerName.trim() !== '') {
          newWorkers.push({
            user_id: user.id,
            worker_name: workerName,
          });
        }
      }

      if (newWorkers.length > 0) {
        const { error: insertError } = await supabase.from('workers').insert(newWorkers);
        if (insertError) throw insertError;
      }
      
      messageApi.success('Workers list saved successfully!');
      setIsEditing(false); 
      setInitialFormValues(values);

    } catch (error) {
      messageApi.error('Failed to save workers list.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = () => setIsModalVisible(true);

  const handleModalOk = () => {
    if (confirmText === CONFIRMATION_KEYWORD) {
      setIsEditing(true);
      setIsModalVisible(false);
      setConfirmText('');
    } else {
      messageApi.error('Confirmation text does not match.');
    }
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
    setConfirmText('');
  };
  
  const handleCancelEdit = () => {
    form.resetFields();
    form.setFieldsValue(initialFormValues);
    setIsEditing(false);
  };

  if (isFetching) {
    return <Card title="Workers"><Spin /></Card>;
  }

  return (
    <>
      <Card title="Workers">
        <Form form={form} onFinish={onFinish} layout="vertical">
          {/* ... baqi form ka code waisa hi hai ... */}
          <Form.Item label="Number of Workers" name="num_workers">
            <InputNumber min={0} style={{ width: '100%' }} disabled={!isEditing} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) => {
              const workerCount = getFieldValue('num_workers') || 0;
              return workerCount > 0 && (
                <>
                  <Divider />
                  <Text type="secondary">Please enter the names of the workers:</Text>
                  <div style={{ marginTop: '16px' }}>
                    {Array.from({ length: workerCount }, (_, index) => (
                      <Form.Item key={index} label={`Worker ${index + 1}`} name={`worker_${index}`} rules={[{ required: true, message: 'Please enter a name.' }]}>
                        <Input disabled={!isEditing} />
                      </Form.Item>
                    ))}
                  </div>
                </>
              );
            }}
          </Form.Item>
          <Form.Item>
            {isEditing ? (
              <Space>
                <Button type="primary" htmlType="submit" loading={loading}>Save Workers</Button>
                {initialFormValues.num_workers > 0 && <Button onClick={handleCancelEdit}>Cancel</Button>}
              </Space>
            ) : (
              <Button type="default" onClick={handleEditClick}>Edit Workers List</Button>
            )}
          </Form.Item>
        </Form>
      </Card>

      {/* MODAL KA CODE UPDATE KIYA GAYA HAI */}
      <Modal
        title={<Space><ExclamationCircleOutlined />Confirm Edit</Space>}
        visible={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        okText="Unlock Editing"
        cancelText="Cancel"
        okButtonProps={{ disabled: confirmText !== CONFIRMATION_KEYWORD }}
      >
        <div style={{ display: 'flex', alignItems: 'start' }}>
            <ExclamationCircleOutlined style={{ fontSize: '22px', color: '#faad14', marginRight: '16px', marginTop: '4px' }} />
            <div>
                <p>Aap workers ki faharist min changes karne wale hein. ya ek hassas qadam hay. is qadam ke bad, hisaab uss waqt tak durust nihen ho ga jab tak keh aap agreement ki start date se rozana ki entries dubarah darj nihen karte hen.</p>
                <p>aage badhane ke liye, please darj zeel box min <strong>{CONFIRMATION_KEYWORD}</strong> type karin.</p>
            </div>
        </div>
        <Input
          style={{ marginTop: '16px' }}
          placeholder={`Type ${CONFIRMATION_KEYWORD} to confirm`}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
        />
      </Modal>
    </>
  );
};

export default WorkersSection;