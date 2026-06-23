// Screen 2 — Scenario Modeller
// State/API contract preserved: selected, result, loading, error; simulate(scenario_id) → {scenario_result, scenario_summary}

import { useState } from 'react'
import { simulate } from '../api'

const SCENARIO_LABELS = {
  hormuz_closure:     'Strait of Hormuz Closure',
  opec_cut:           'Emergency OPEC+ Cut',
  red_sea_suspension: 'Red Sea Suspension',
}

const SCENARIO_ICONS = {
  hormuz_closure:     'local_fire_department',
  opec_cut:           'trending_down',
  red_sea_suspension: 'anchor',
}

export default function ScenarioPanel({ scenarioList }) {
  const [selected, setSelected] = useState('')
  const [result,   setResult]   = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  const run = async () => {
    if (!selected) return
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await simulate(selected)
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  const sr = result?.scenario_result

  const keys = scenarioList ? Object.keys(scenarioList) : Object.keys(SCENARIO_LABELS)

  return (
    <div className="h-full overflow-y-auto" style={{background:'#0A0A0B'}}>
      <div className="p-6 pb-14 max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-2 h-2 status-pulse" style={{background:'#00d1ff'}}/>
            <span className="mono text-xs tracking-widest uppercase" style={{color:'#a4e6ff'}}>
              Disruption Scenario Engine
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-3 uppercase" style={{fontFamily:'Geist,sans-serif',color:'#e4e2e4'}}>
            SCENARIO MODELLER
          </h1>
          <p className="mono text-xs" style={{color:'#859399'}}>
            Select a disruption scenario and simulate supply, price and currency impact.
          </p>
        </div>

        {/* Scenario selector cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {keys.map(k => {
            const active = selected === k
            return (
              <button key={k} onClick={() => setSelected(k)}
                className="glass-panel p-4 text-left transition-all card-glow"
                style={{
                  borderColor: active ? '#00d1ff' : '#2D2D30',
                  background: active ? 'rgba(0,209,255,0.08)' : 'rgba(14,14,16,0.8)',
                }}>
                <span className="material-symbols-outlined mb-2 block"
                  style={{color: active ? '#00d1ff' : '#bbc9cf', fontSize:22}}>
                  {SCENARIO_ICONS[k] || 'warning'}
                </span>
                <p className="mono text-xs tracking-wider uppercase font-bold" style={{color: active ? '#00d1ff' : '#e4e2e4'}}>
                  {SCENARIO_LABELS[k] || k}
                </p>
                {scenarioList?.[k] && (
                  <p className="mono text-xs mt-1 opacity-60" style={{color:'#bbc9cf'}}>
                    {scenarioList[k].global_supply_cut_pct}% global cut
                    {scenarioList[k].duration_days ? ` · ${scenarioList[k].duration_days}d` : ' · indefinite'}
                  </p>
                )}
              </button>
            )
          })}
        </div>

        {/* Run button */}
        <button onClick={run} disabled={!selected || loading}
          className="w-full mono text-xs tracking-widest uppercase py-3 mb-6 transition-all disabled:opacity-40"
          style={{
            background: selected && !loading ? 'rgba(0,209,255,0.12)' : 'rgba(30,30,32,0.8)',
            border: `1px solid ${selected && !loading ? 'rgba(0,209,255,0.5)' : '#3c494e'}`,
            color: selected && !loading ? '#00d1ff' : '#859399',
          }}>
          {loading
            ? <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined animate-spin" style={{fontSize:16}}>refresh</span>
                SIMULATING...
              </span>
            : <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined" style={{fontSize:16}}>play_arrow</span>
                RUN SIMULATION
              </span>
          }
        </button>

        {/* Error */}
        {error && (
          <div className="mono text-xs p-4 mb-6" style={{background:'rgba(147,0,10,0.3)',border:'1px solid rgba(255,180,171,0.4)',color:'#ffb4ab'}}>
            <span className="material-symbols-outlined mr-2" style={{fontSize:16}}>warning</span>
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-20 glass-panel"/>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <div key={i} className="h-20 glass-panel"/>)}
            </div>
          </div>
        )}

        {/* Results */}
        {sr && !loading && (
          <div className="space-y-4">
            {/* Scenario label */}
            <div className="glass-panel p-4 flex items-center gap-3"
              style={{borderColor:'rgba(255,177,47,0.3)',background:'rgba(255,177,47,0.05)'}}>
              <span className="material-symbols-outlined" style={{color:'#ffb12f',fontSize:20}}>warning</span>
              <div>
                <p className="mono text-xs tracking-widest uppercase font-bold" style={{color:'#ffb12f'}}>
                  ACTIVE SCENARIO
                </p>
                <p className="mono text-xs" style={{color:'#e4e2e4'}}>{sr.description}</p>
              </div>
            </div>

            {/* Stat grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label:'SUPPLY GAP',    value:`${(sr.supply_gap_bpd/1000).toFixed(0)}K BPD`, sub:`${sr.global_supply_cut_pct}% global`, icon:'oil_barrel' },
                { label:'OIL PRICE',     value:`$${sr.projected_price_usd}`, sub:`+${sr.price_impact_pct}% from $${sr.baseline_oil_price_usd}`, icon:'trending_up', alert:true },
                { label:'USD/INR',       value:sr.projected_usdinr.toFixed(2), sub:`+${sr.inr_depreciation_pct}% from ${sr.baseline_usdinr.toFixed(2)}`, icon:'currency_rupee', alert:true },
                { label:'SPR COVER',     value:`${sr.spr_days_remaining}D`, sub:'India strategic reserve', icon:'inventory_2' },
              ].map(s => (
                <div key={s.label} className="glass-panel p-4 card-glow">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined" style={{fontSize:16,color: s.alert ? '#ffb12f' : '#00d1ff'}}>{s.icon}</span>
                    <span className="mono text-xs tracking-widest" style={{color:'#859399'}}>{s.label}</span>
                  </div>
                  <p className="mono font-bold text-base" style={{color: s.alert ? '#ffb12f' : '#a4e6ff'}}>{s.value}</p>
                  <p className="mono text-xs mt-1 opacity-60" style={{color:'#bbc9cf'}}>{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Assumptions */}
            <div className="glass-panel p-4" style={{borderColor:'rgba(60,73,78,0.5)'}}>
              <p className="mono text-xs tracking-widest mb-2 uppercase" style={{color:'#859399'}}>
                MODEL ASSUMPTIONS
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mono text-xs" style={{color:'#bbc9cf'}}>
                <span>Elasticity: {sr.price_elasticity_used}x</span>
                <span>INR pass-through: {sr.inr_passthrough_used}</span>
                <span>Baseline oil: ${sr.baseline_oil_price_usd}/bbl (configured)</span>
              </div>
            </div>

            {/* Policymaker summary */}
            {result.scenario_summary && (
              <div className="glass-panel p-5" style={{borderColor:'rgba(0,209,255,0.2)',background:'rgba(0,209,255,0.04)'}}>
                <p className="mono text-xs tracking-widest uppercase mb-3" style={{color:'#00d1ff'}}>
                  POLICYMAKER BRIEFING
                </p>
                <p className="text-sm leading-relaxed" style={{fontFamily:'Geist,sans-serif',color:'#e4e2e4'}}>
                  {result.scenario_summary}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
