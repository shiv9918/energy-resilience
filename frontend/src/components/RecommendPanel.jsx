// Screen 3 — Procurement Recommendations
// State/API contract preserved: corridor, result, loading, error; recommend(corridor) → {ranked_alternatives, recommendation_text}

import { useState } from 'react'
import { recommend } from '../api'

const CORRIDOR_LABELS = {
  hormuz:  'Strait of Hormuz',
  red_sea: 'Red Sea / Houthi',
  general: 'Iran / OPEC',
}

const SOURCE_ICONS = {
  russia_urals:  'factory',
  usa_wti:       'account_balance',
  nigeria_bonny: 'hub',
  saudi_cape:    'oil_barrel',
  uae_murban:    'shopping',
}

function confidenceLabel(score) {
  if (score >= 0.55) return { text: 'HIGH CONFIDENCE',  color: '#5bffa1', bg: 'rgba(91,255,161,0.08)',  border: 'rgba(91,255,161,0.3)' }
  if (score >= 0.35) return { text: 'MODERATE RISK',    color: '#ffb12f', bg: 'rgba(255,177,47,0.08)',  border: 'rgba(255,177,47,0.3)' }
  return                    { text: 'LOW CONFIDENCE',   color: '#ffb4ab', bg: 'rgba(255,180,171,0.08)', border: 'rgba(255,180,171,0.3)' }
}

export default function RecommendPanel() {
  const [corridor, setCorridor] = useState('')
  const [result,   setResult]   = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  const run = async () => {
    if (!corridor) return
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await recommend(corridor)
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  const scoreColor = (score) => {
    if (score >= 0.55) return '#5bffa1'
    if (score >= 0.35) return '#ffb12f'
    return '#bbc9cf'
  }

  return (
    <div className="h-full overflow-y-auto" style={{background:'#0A0A0B'}}>
      <div className="p-6 pb-14 max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-2 h-2 status-pulse" style={{background:'#00d1ff'}}/>
            <span className="mono text-xs tracking-widest uppercase" style={{color:'#a4e6ff'}}>
              Tactical Optimization Engine
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-4 uppercase"
            style={{fontFamily:'Geist,sans-serif',color:'#e4e2e4'}}>
            PROCUREMENT RECOMMENDATIONS
          </h1>

          {/* Corridor selector */}
          <div className="flex gap-3 items-center">
            {Object.entries(CORRIDOR_LABELS).map(([k, v]) => (
              <button key={k} onClick={() => setCorridor(k)}
                className="mono text-xs tracking-widest uppercase px-4 py-2 transition-all"
                style={{
                  border: `1px solid ${corridor === k ? '#00d1ff' : '#3c494e'}`,
                  color:  corridor === k ? '#00d1ff' : '#bbc9cf',
                  background: corridor === k ? 'rgba(0,209,255,0.1)' : 'transparent',
                }}>
                {v}
              </button>
            ))}
          </div>

          {corridor && (
            <div className="mt-3 flex items-center gap-2 px-4 py-1.5"
              style={{background:'rgba(147,0,10,0.2)',border:'1px solid rgba(255,180,171,0.3)',color:'#ffb4ab'}}>
              <span className="material-symbols-outlined" style={{fontSize:16}}>warning</span>
              <span className="mono text-xs tracking-widest uppercase">
                Scenario: {CORRIDOR_LABELS[corridor]} Disruption
              </span>
            </div>
          )}
        </div>

        {/* Run button */}
        {corridor && !result && !loading && (
          <button onClick={run}
            className="w-full mono text-xs tracking-widest uppercase py-3 mb-6 transition-all"
            style={{background:'rgba(0,209,255,0.12)',border:'1px solid rgba(0,209,255,0.5)',color:'#00d1ff'}}>
            <span className="flex items-center justify-center gap-2">
              <span className="material-symbols-outlined" style={{fontSize:16}}>play_arrow</span>
              GENERATE RECOMMENDATIONS
            </span>
          </button>
        )}

        {/* Error */}
        {error && (
          <div className="mono text-xs p-4 mb-6"
            style={{background:'rgba(147,0,10,0.3)',border:'1px solid rgba(255,180,171,0.4)',color:'#ffb4ab'}}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="glass-panel p-8 animate-pulse">
                <div className="flex gap-4 mb-6">
                  <div className="w-12 h-12" style={{background:'#2a2a2c'}}/>
                  <div className="flex-1">
                    <div className="h-4 w-48 mb-2 rounded" style={{background:'#2a2a2c'}}/>
                    <div className="h-3 w-32 rounded" style={{background:'#1f1f21'}}/>
                  </div>
                </div>
                <div className="h-px mb-6" style={{background:'#3c494e'}}/>
                <div className="flex gap-3">
                  <div className="h-10 flex-1 rounded" style={{background:'#2a2a2c'}}/>
                  <div className="h-10 w-24 rounded" style={{background:'#1f1f21'}}/>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recommendation cards */}
        {result && !loading && (
          <div className="space-y-6">
            {result.ranked_alternatives.map((alt, i) => {
              const conf = confidenceLabel(alt.score)
              const priceSign = alt.price_vs_brent >= 0 ? '+' : ''
              return (
                <div key={alt.id} className="glass-panel card-glow relative p-8 transition-all"
                  style={{opacity: alt.feasible ? 1 : 0.4}}>

                  {/* Rank watermark */}
                  <div className="absolute top-4 right-8 font-black select-none pointer-events-none"
                    style={{fontSize:64,color:'rgba(53,52,55,0.25)',fontFamily:'Geist,sans-serif',lineHeight:1}}>
                    {String(i+1).padStart(2,'0')}
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    {/* Supplier info */}
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 flex items-center justify-center"
                        style={{background:'#2a2a2c',border:'1px solid #3c494e'}}>
                        <span className="material-symbols-outlined"
                          style={{color:'#a4e6ff',fontSize:22}}>{SOURCE_ICONS[alt.id] || 'oil_barrel'}</span>
                      </div>
                      <div>
                        <h3 className="font-bold uppercase mb-0.5"
                          style={{fontFamily:'Geist,sans-serif',color:'#e4e2e4',fontSize:15}}>
                          {alt.label.split('--')[0].trim()}
                        </h3>
                        <p className="mono text-xs uppercase tracking-wider" style={{color:'#859399'}}>
                          {alt.grade.toUpperCase()} CRUDE · {alt.transit_days}D TRANSIT
                          {alt.sanctions_risk && <span style={{color:'#ffb12f'}}> · SANCTIONS RISK</span>}
                        </p>
                      </div>
                    </div>

                    {/* Volume shift */}
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="mono text-xs uppercase mb-1" style={{color:'#859399'}}>PRICE VS BRENT</div>
                        <div className="mono font-bold text-lg"
                          style={{color: alt.price_vs_brent <= 0 ? '#5bffa1' : '#ffb4ab'}}>
                          {priceSign}{alt.price_vs_brent.toFixed(1)} $/BBL
                        </div>
                      </div>
                      <span className="material-symbols-outlined status-pulse"
                        style={{fontSize:28,color:'#00d1ff'}}>trending_flat</span>
                      <div>
                        <div className="mono text-xs uppercase mb-1" style={{color:'#00d1ff'}}>SCORE</div>
                        <div className="mono font-bold text-lg" style={{color: scoreColor(alt.score)}}>
                          {alt.score.toFixed(3)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats + badge */}
                  <div className="mt-6 pt-6 flex flex-wrap items-center justify-between gap-4"
                    style={{borderTop:'1px solid rgba(60,73,78,0.4)'}}>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { icon:'schedule', label:`Transit: ${alt.transit_days} days` },
                        { icon:'layers',   label:`Grade: ${alt.grade}` },
                        { icon:'check_circle', label: alt.feasible ? 'Route Feasible' : 'Corridor Overlap', alert: !alt.feasible },
                      ].map(s => (
                        <div key={s.label} className="flex items-center gap-2 px-3 py-1.5 mono text-xs"
                          style={{background:'#1f1f21',border:'1px solid #3c494e',color: s.alert ? '#ffb4ab' : '#e4e2e4'}}>
                          <span className="material-symbols-outlined"
                            style={{fontSize:14, color: s.alert ? '#ffb4ab' : '#bbc9cf'}}>{s.icon}</span>
                          {s.label}
                        </div>
                      ))}
                    </div>
                    <div className="mono text-xs px-3 py-1 tracking-widest uppercase"
                      style={{background: conf.bg, border:`1px solid ${conf.border}`, color: conf.color}}>
                      {conf.text}
                    </div>
                  </div>

                  {/* Actions — only for feasible top-3 */}
                  {alt.feasible && i < 3 && (
                    <div className="mt-6 flex gap-3">
                      <button className="flex-1 py-2.5 mono text-xs tracking-widest uppercase font-bold transition-colors"
                        style={{background:'#00d1ff',color:'#003543'}}>
                        ACCEPT RECOMMENDATION
                      </button>
                      <button className="px-6 mono text-xs tracking-widest uppercase transition-colors"
                        style={{border:'1px solid #3c494e',color:'#bbc9cf'}}>
                        REJECT
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Trading desk memo */}
            <div className="glass-panel p-6" style={{borderColor:'rgba(0,209,255,0.2)',background:'rgba(0,209,255,0.03)'}}>
              <p className="mono text-xs tracking-widest uppercase mb-3" style={{color:'#00d1ff'}}>
                TRADING DESK MEMO
              </p>
              <p className="text-sm leading-relaxed" style={{fontFamily:'Geist,sans-serif',color:'#e4e2e4'}}>
                {result.recommendation_text}
              </p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !corridor && (
          <div className="glass-panel p-12 text-center"
            style={{borderStyle:'dashed',borderColor:'#3c494e'}}>
            <span className="material-symbols-outlined mb-3 block" style={{fontSize:32,color:'#3c494e'}}>oil_barrel</span>
            <p className="mono text-xs tracking-widest uppercase" style={{color:'#3c494e'}}>
              SELECT A DISRUPTED CORRIDOR TO GENERATE RECOMMENDATIONS
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
