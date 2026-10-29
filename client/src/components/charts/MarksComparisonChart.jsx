import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const MarksComparisonChart = ({ data = null }) => {
  const defaultLabels = ['DSA', 'Machine Learning', 'Operating Sys', 'DBMS', 'Soft. Eng'];
  const defaultObtained = [46, 44, 42, 48, 45];
  const defaultMax = [50, 50, 50, 50, 50];

  const chartData = {
    labels: data?.labels || defaultLabels,
    datasets: [
      {
        label: 'Obtained Marks',
        data: data?.obtained || defaultObtained,
        backgroundColor: '#4f46e5',
        borderRadius: 8,
        borderSkipped: false,
      },
      {
        label: 'Maximum Marks',
        data: data?.max || defaultMax,
        backgroundColor: 'rgba(51, 65, 85, 0.4)',
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#cbd5e1',
          font: { size: 11 },
          boxWidth: 12,
          boxHeight: 12,
        },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        borderWidth: 1,
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 60,
        grid: {
          color: 'rgba(51, 65, 85, 0.4)',
        },
        ticks: {
          color: '#94a3b8',
          font: { size: 11 },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#94a3b8',
          font: { size: 11 },
        },
      },
    },
  };

  return (
    <div className="h-64 w-full">
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default MarksComparisonChart;
