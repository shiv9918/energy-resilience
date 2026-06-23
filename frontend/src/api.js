import axios from 'axios'

// In dev the Vite proxy forwards /api → localhost:8000.
// In production set VITE_API_URL to your Render backend URL, e.g.
//   https://energy-resilience-api.onrender.com
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
})

export const getRiskScores   = ()                   => api.get('/risk-scores')
export const getScenarios    = ()                   => api.get('/scenarios')
export const simulate        = (scenario_id)        => api.post('/simulate', { scenario_id })
export const recommend       = (corridor)           => api.post('/recommend', { corridor })
export const runPipeline     = ()                   => api.get('/pipeline')
export const getMacroHistory = (column, months)     => api.get('/macro-history', { params: { column, months } })
