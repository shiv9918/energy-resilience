import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { getMacroHistory } from '../api'

const COLUMNS = [
  { key: 'USDINR',       label: 'USD / INR',           color: '#60a5fa' },
  { key: 'CPI_Infl',     label: 'CPI Inflation %',     color: '#f59e0b' },
  { key: 'WPI_Fuel_yoy', label: 'WPI Fuel YoY %',      color: '#f87171' },
  { key: 'WPI_All_yoy',  label: 'WPI All YoY %',       color: '#a78bfa' },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-white font-medium">{payload[0]?.value?.toFixed(2)}</p>
    </div>
  )
}

export default function MacroChart() {
  const [column,   setColumn]  = useState('USDINR')
  const [months,   setMonths]  = useState(24)
  const [data,     setData]    = useState(null)
  const [loading,  setLoading] = useState(false)
  const [error,    setError]   = useState(null)

  const fetch = async () => {
    setLoading(true); setError(null)
    try {
      const res = await getMacroHistory(column, months)
      setData(res.data.data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch() }, [column, months])

  const meta  = COLUMNS.find(c => c.key === column)
  const color = meta?.color || '#60a5fa'

  // zero reference line for inflation metrics
  const showZero = column.includes('yoy') || column.includes('Infl')

  return (
    <div className="bg-slate-800 rounded-xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="text-slate-100 font-semibold text-lg">Macro Indicators</h2>
        <div className="flex gap-2">
          <select
            value={column}
            onChange={e => setColumn(e.target.value)}
            className="bg-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-sm border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {COLUMNS.map(c => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          <select
            value={months}
            onChange={e => setMonths(Number(e.target.value))}
            className="bg-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-sm border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[12, 24, 36, 60].map(m => (
              <option key={m} value={m}>{m}M</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="h-56 bg-slate-700 rounded-lg animate-pulse" />
      )}

      {!loading && data && (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickFormatter={d => d.slice(0, 7)}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickFormatter={v => v.toFixed(1)}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            {showZero && (
              <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: color }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
