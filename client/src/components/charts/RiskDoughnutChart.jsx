import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

const RiskDoughnutChart = ({ counts = { low: 72, moderate: 18, high: 10 } }) => {
  const chartData = {
    labels: ['Low Risk (>=85% Att.)', 'Moderate Risk (75-85%)', 'Critical Risk (<75%)'],
    datasets: [
      {
        data: [counts.low, counts.moderate, counts.high],
        backgroundColor: ['#10b981', '#f59e0b', '#f43f5e'],
        borderColor: '#0f172a',
        borderWidth: 2,
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#cbd5e1',
          font: { size: 11 },
          padding: 16,
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
        callbacks: {
          label: (context) => ` ${context.label}: ${context.raw} students`,
        },
      },
    },
    cutout: '70%',
  };

  const total = counts.low + counts.moderate + counts.high;

  return (
    <div className="relative h-64 w-full flex items-center justify-center">
      <Doughnut data={chartData} options={options} />
      <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
        <span className="text-2xl font-black text-white">{total}</span>
        <span className="block text-[10px] uppercase font-bold text-slate-400">Total</span>
      </div>
    </div>
  );
};

export default RiskDoughnutChart;
