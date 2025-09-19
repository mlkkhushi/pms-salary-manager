import React from 'react';
import { Button } from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const DownloadToPdfButton = ({ data, columns, fileName, title, workerName, periodLabel }) => {
  const handleDownload = () => {
    if (!data || data.length === 0) {
      console.error("No data available to generate PDF.");
      return;
    }

    const doc = new jsPDF();
    let startY = 15;

    if (title) {
      doc.setFontSize(16);
      doc.text(title, 14, startY);
      startY += 8;
    }

    if (workerName) {
      doc.setFontSize(12);
      doc.text(`Worker: ${workerName}`, 14, startY);
      startY += 6;
    }
    
    if (periodLabel) {
      doc.setFontSize(12);
      doc.text(`Period: ${periodLabel}`, 14, startY);
      startY += 10;
    }

    const tableColumnNames = columns.map(col => col.title);
    
    const tableRows = data.map(record => {
      return columns.map(col => {
        let cellData = record[col.dataIndex];
        
        if (Array.isArray(col.dataIndex)) {
          cellData = col.dataIndex.reduce((acc, key) => acc && acc[key], record);
        }

        if (React.isValidElement(cellData) && cellData.props.children) {
            return cellData.props.children;
        }

        return cellData !== undefined && cellData !== null ? String(cellData) : '';
      });
    });

    autoTable(doc, {
      head: [tableColumnNames],
      body: tableRows,
      startY: startY,
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
      },
      styles: {
        lineWidth: 0.1,
        lineColor: [200, 200, 200],
      },
      // <-- YEH HOOK HAR CELL KE LIYE STYLE SET KAREGA -->
      didParseCell: (data) => {
        // data.row.raw[0] pehli column ki value hai, jis se hum row ko pehchante hain
        const firstColumnValue = data.row.raw[0];

        if (firstColumnValue === 'Allowance for Period') {
          data.cell.styles.fillColor = '#f5f5f5'; // Halka grey background
        }
        
        if (firstColumnValue === 'Grand Total') {
          data.cell.styles.fillColor = '#f5f5f5'; // Halka grey background
          data.cell.styles.fontStyle = 'bold';   // Text ko bold karein
        }
      },
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