'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { NameValue } from '@lad/frontend-features/lad-monitor';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

interface DonutChartProps {
  title: string;
  data: NameValue[];
}

export function DonutChart({ title, data }: DonutChartProps) {
  const hasData = Array.isArray(data) && data.some((d) => d.value > 0);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      {hasData ? (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            {/* Recharts paints legend text in the slice colour, and the lighter
                slices fail contrast; the swatch keeps the colour, the label reads. */}
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) => <span className="text-gray-700 dark:text-gray-300">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[220px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">No data</div>
      )}
    </div>
  );
}
