import React from 'react';
import { Button } from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const DownloadToPdfButton = ({ data, columns, fileName, title, subtitle }) => {
  const handleDownload = () => {
    if (!data || data.length === 0) {
      console.error("No data available to generate PDF.");
      return;
    }

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(16);
    doc.text(title || 'Report', 14, 15);

    // Subtitle (New Addition)
    if (subtitle) {
      doc.setFontSize(10);
      doc.text(subtitle, 14, 22);
    }

    const tableColumnNames = columns.map(col => col.title);
    const tableRows = data.map(record => {
      return columns.map(col => {
        if (Array.isArray(col.dataIndex)) {
          return col.dataIndex.reduce((acc, key) => acc && acc[key], record);
        }
        const value = record[col.dataIndex];
        return value !== null && value !== undefined ? String(value) : '';
      });
    });

    autoTable(doc, {
      head: [tableColumnNames],
      body: tableRows,
      startY: subtitle ? 28 : 20, // Adjust table position based on subtitle
    });

    doc.save(`${fileName}.pdf`);
  };

  return (
    <Button
      icon={<FilePdfOutlined />}
      onClick={handleDownload}
      disabled={!data || data.length === 0}
    >
      Download PDF
    </Button>
  );
};

export default DownloadToPdfButton;