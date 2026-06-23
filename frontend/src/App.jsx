import { useState, useEffect } from 'react'
import { getRiskScores, getScenarios, runPipeline } from './api'
import Shell         from './components/Shell'
import RiskScoreCards from './components/RiskScoreCards'
import ScenarioPanel  from './components/ScenarioPanel'
import RecommendPanel from './components/RecommendPanel'
import MacroChart     from './components/MacroChart'
import PipelinePanel  from './components/PipelinePanel'
import './index.css'

export default function App() {
  const [screen,      setScreen]      = useState('dashboard')

  // Screen 1 — risk data
  const [risk,        setRisk]        = useState(null)
  const [riskLoading, setRiskLoading] = useState(false)

  // Screen 2 — scenario list (static, loaded once)
  const [scenarios,   setScenarios]   = useState(null)

  // Screen 4 — pipeline
  const [pipeline,    setPipeline]    = useState(null)
  const [pipeLoading, setPipeLoading] = useState(false)
  const [pipeError,   setPipeError]   = useState(null)

  useEffect(() => {
    getScenarios().then(r => setScenarios(r.data)).catch(() => {})
    loadRisk()
  }, [])

  const loadRisk = async () => {
    setRiskLoading(true)
    try {
      const r = await getRiskScores()
      setRisk(r.data.data)
    } catch {
      // silent — retry via refresh button on dashboard
    } finally {
      setRiskLoading(false)
    }
  }

  const runFull = async () => {
    setPipeLoading(true); setPipeError(null); setPipeline(null)
    setScreen('pipeline')
    try {
      const r = await runPipeline()
      setPipeline(r.data)
      if (r.data?.data?.corridor_risk_scores) setRisk(r.data.data.corridor_risk_scores)
    } catch (e) {
      setPipeError(e.response?.data?.detail || e.message)
    } finally {
      setPipeLoading(false)
    }
  }

  return (
    <Shell
      activeScreen={screen}
      onNavigate={setScreen}
      onRunPipeline={runFull}
      pipeLoading={pipeLoading}
    >
      {/* Screens rendered as full-height panels, only active one shown */}
      <div style={{height:'calc(100vh - 64px - 36px)', overflow:'hidden'}}>

        {screen === 'dashboard' && (
          <RiskScoreCards
            data={risk}
            loading={riskLoading}
            onRefresh={loadRisk}
          />
        )}

        {screen === 'scenario' && (
          <ScenarioPanel scenarioList={scenarios} />
        )}

        {screen === 'recommend' && (
          <RecommendPanel />
        )}

        {screen === 'pipeline' && (
          <PipelinePanel
            data={pipeline}
            loading={pipeLoading}
            error={pipeError}
          />
        )}

        {/* MacroChart accessible from dashboard as a sub-view */}
        {screen === 'chart' && (
          <div className="h-full overflow-y-auto p-6 pb-14" style={{background:'#0A0A0B'}}>
            <MacroChart />
          </div>
        )}
      </div>
    </Shell>
  )
}
