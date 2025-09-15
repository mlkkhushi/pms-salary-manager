import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Card, Form, InputNumber, Button, Input, Typography, Space, Divider } from 'antd';

const { Title, Text } = Typography;

const WorkersSection = ({ user, messageApi }) => {
  const [form] = Form.useForm();
  const [workerCount, setWorkerCount] = useState(0); // Yeh yaad rakhega ke kitne workers hain
  const [loading, setLoading] = useState(false);

  // Jab page load ho, to purane workers ka data database se layein
  useEffect(() => {
    const fetchWorkers = async () => {
      const { data, error } = await supabase
        .from('workers')
        .select('worker_name')
        .eq('user_id', user.id);

      if (data) {
        setWorkerCount(data.length);
        const initialValues = {};
        data.forEach((worker, index) => {
          initialValues[`worker_${index}`] = worker.worker_name;
        });
        form.setFieldsValue({
          num_workers: data.length,
          ...initialValues,
        });
      }
    };
    fetchWorkers();
  }, [form, user.id]);


  // Jab user "Number of Workers" ko tabdeel kare
  const handleWorkerCountChange = (count) => {
    setWorkerCount(count || 0);
  };

  // Form submit hone par
  const onFinish = async (values) => {
    setLoading(true);
    try {
      // 1. Is user ke tamam purane workers ko delete kar dein
      const { error: deleteError } = await supabase
        .from('workers')
        .delete()
        .eq('user_id', user.id);
      if (deleteError) throw deleteError;

      // 2. Naye workers ki list banayein
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

      // 3. Agar naye workers hain, to unko database mein daal dein
      if (newWorkers.length > 0) {
        const { error: insertError } = await supabase.from('workers').insert(newWorkers);
        if (insertError) throw insertError;
      }

      messageApi.success('Workers list saved successfully!');
    } catch (error) {
      messageApi.error('Failed to save workers list.');
      console.error('Error saving workers:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Workers">
      <Form form={form} onFinish={onFinish} layout="vertical">
        <Form.Item label="Number of Workers" name="num_workers">
          <InputNumber min={0} style={{ width: '100%' }} onChange={handleWorkerCountChange} />
        </Form.Item>

        {workerCount > 0 && (
          <>
            <Divider />
            <Text type="secondary">Please enter the names of the workers:</Text>
            <div style={{marginTop: '16px'}}>
              {/* Yeh hissa dynamically worker fields banata hai */}
              {Array.from({ length: workerCount }, (_, index) => (
                <Form.Item
                  key={index}
                  label={`Worker ${index + 1}`}
                  name={`worker_${index}`}
                  rules={[{ required: true, message: 'Please enter a name or remove the worker.' }]}
                >
                  <Input />
                </Form.Item>
              ))}
            </div>
          </>
        )}

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Save Workers
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default WorkersSection;