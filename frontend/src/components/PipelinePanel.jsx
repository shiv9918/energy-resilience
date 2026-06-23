// Screen 4 — Executive Pipeline Log
// Props contract preserved: data (full pipeline response), loading:bool, error:str
// d = data.data ?? data; sr = d.scenario_result; top = feasible alternatives slice(0,3)

export default function PipelinePanel({ data, loading, error }) {
  if (loading) return (
    <div className="h-full overflow-y-auto p-6 pb-14" style={{background:'#0A0A0B'}}>
      <div className="max-w-4xl mx-auto space-y-4 animate-pulse">
        <div className="h-16 glass-panel"/>
        <div className="grid grid-cols-4 gap-3">{[1,2,3,4].map(i=><div key={i} className="h-24 glass-panel"/>)}</div>
        <div className="h-48 glass-panel"/>
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-20 glass-panel"/>)}</div>
      </div>
    </div>
  )

  if (error) return (
    <div className="h-full flex items-center justify-center p-6" style={{background:'#0A0A0B'}}>
      <div className="glass-panel p-8 max-w-lg text-center"
        style={{borderColor:'rgba(255,180,171,0.4)',background:'rgba(147,0,10,0.2)'}}>
        <span className="material-symbols-outlined mb-3 block" style={{fontSize:32,color:'#ffb4ab'}}>warning</span>
        <p className="mono text-xs tracking-widest uppercase mb-2" style={{color:'#ffb4ab'}}>PIPELINE ERROR</p>
        <p className="mono text-xs" style={{color:'#bbc9cf'}}>{error}</p>
      </div>
    </div>
  )

  if (!data) return (
    <div className="h-full flex items-center justify-center p-6" style={{background:'#0A0A0B'}}>
      <div className="glass-panel p-12 max-w-lg text-center" style={{borderStyle:'dashed',borderColor:'#3c494e'}}>
        <span className="material-symbols-outlined mb-4 block" style={{fontSize:40,color:'#3c494e'}}>account_tree</span>
        <p className="mono text-xs tracking-widest uppercase mb-2" style={{color:'#3c494e'}}>PIPELINE NOT YET RUN</p>
        <p className="mono text-xs" style={{color:'#3c494e'}}>
          Click RUN PIPELINE in the header to execute the full<br/>
          risk → scenario → rerouting analysis.
        </p>
      </div>
    </div>
  )

  const d   = data.data ?? data
  const sr  = d.scenario_result
  const top = (d.ranked_alternatives || []).filter(a => a.feasible).slice(0, 3)

  const CORRIDOR_LABELS = { hormuz:'HORMUZ', red_sea:'RED SEA', general:'IRAN/OPEC' }

  return (
    <div className="h-full overflow-y-auto" style={{background:'#0A0A0B'}}>
      <div className="p-6 pb-14 max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full status-pulse" style={{background:'#5bffa1'}}/>
              <span className="mono text-xs tracking-widest uppercase" style={{color:'#5bffa1'}}>
                Pipeline Complete
              </span>
            </div>
            {data.cached && (
              <span className="mono text-xs px-2 py-0.5" style={{background:'#1f1f21',border:'1px solid #3c494e',color:'#859399'}}>
                CACHED
              </span>
            )}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight uppercase"
            style={{fontFamily:'Geist,sans-serif',color:'#e4e2e4'}}>
            EXECUTIVE PIPELINE LOG
          </h1>
          <p className="mono text-xs mt-1" style={{color:'#859399'}}>
            Signal → Scenario → Rerouting · Full analysis chain
          </p>
        </div>

        {/* Step 1 — Corridor risk */}
        <div className="glass-panel p-5 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-7 h-7 flex items-center justify-center mono text-xs font-bold"
              style={{background:'rgba(0,209,255,0.12)',border:'1px solid rgba(0,209,255,0.3)',color:'#00d1ff'}}>1</div>
            <span className="mono text-xs tracking-widest uppercase" style={{color:'#bbc9cf'}}>CORRIDOR RISK ASSESSMENT</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(d.corridor_risk_scores || {}).map(([k, v]) => {
              const isHighest = k === d.highest_risk_corridor
              const score = v.avg_risk_score
              const color = score >= 70 ? '#ffb4ab' : score >= 40 ? '#ffb12f' : '#00d1ff'
              return (
                <div key={k} className="flex items-center gap-3 px-4 py-2 mono text-xs"
                  style={{
                    background: isHighest ? 'rgba(147,0,10,0.25)' : '#1f1f21',
                    border: `1px solid ${isHighest ? 'rgba(255,180,171,0.5)' : '#3c494e'}`,
                  }}>
                  {isHighest && <span className="w-2 h-2 rounded-full status-pulse" style={{background:'#ffb4ab'}}/>}
                  <span style={{color: isHighest ? '#e4e2e4' : '#bbc9cf'}}>
                    {CORRIDOR_LABELS[k] || k}
                  </span>
                  <span className="font-bold" style={{color}}>{score}</span>
                  {isHighest && <span style={{color:'#ffb4ab'}}>↑ HIGHEST</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Step 2 — Scenario impact */}
        {sr && (
          <div className="glass-panel p-5 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-7 h-7 flex items-center justify-center mono text-xs font-bold"
                style={{background:'rgba(255,177,47,0.12)',border:'1px solid rgba(255,177,47,0.3)',color:'#ffb12f'}}>2</div>
              <div>
                <span className="mono text-xs tracking-widest uppercase" style={{color:'#bbc9cf'}}>TRIGGERED SCENARIO</span>
                <p className="mono text-xs mt-0.5" style={{color:'#859399'}}>{sr.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label:'SUPPLY GAP',  value:`${(sr.supply_gap_bpd/1000).toFixed(0)}K BPD` },
                { label:'OIL PRICE',   value:`$${sr.projected_price_usd}/BBL`, note:`+${sr.price_impact_pct}%`, alert:true },
                { label:'USD / INR',   value:sr.projected_usdinr.toFixed(2),   note:`+${sr.inr_depreciation_pct}%`, alert:true },
                { label:'SPR COVER',   value:`${sr.spr_days_remaining} DAYS` },
              ].map(s => (
                <div key={s.label} className="p-3 text-center" style={{background:'#1b1b1d',border:'1px solid #3c494e'}}>
                  <p className="mono text-xs mb-1" style={{color:'#859399'}}>{s.label}</p>
                  <p className="mono font-bold text-sm" style={{color: s.alert ? '#ffb12f' : '#a4e6ff'}}>{s.value}</p>
                  {s.note && <p className="mono text-xs mt-0.5" style={{color:'#ffb12f'}}>{s.note}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3 — Rerouting */}
        {top.length > 0 && (
          <div className="glass-panel p-5 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-7 h-7 flex items-center justify-center mono text-xs font-bold"
                style={{background:'rgba(91,255,161,0.1)',border:'1px solid rgba(91,255,161,0.3)',color:'#5bffa1'}}>3</div>
              <span className="mono text-xs tracking-widest uppercase" style={{color:'#bbc9cf'}}>TOP REROUTING OPTIONS</span>
            </div>
            <div className="space-y-2">
              {top.map((alt, i) => (
                <div key={alt.id} className="flex items-center gap-4 px-4 py-3 mono text-xs"
                  style={{background:'#1b1b1d',border:'1px solid #3c494e'}}>
                  <span style={{color:'#3c494e',width:16}}>{i+1}.</span>
                  <span className="flex-1 truncate" style={{color:'#e4e2e4'}}>{alt.label}</span>
                  <span style={{color: alt.price_vs_brent <= 0 ? '#5bffa1' : '#bbc9cf'}}>
                    {alt.price_vs_brent > 0 ? '+' : ''}{alt.price_vs_brent.toFixed(1)}/BBL
                  </span>
                  <span style={{color:'#859399'}}>{alt.transit_days}D</span>
                  <span style={{color:'#5bffa1'}}>SCORE {alt.score.toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4 — Memo */}
        {d.recommendation_text && (
          <div className="glass-panel p-6"
            style={{borderColor:'rgba(0,209,255,0.2)',background:'rgba(0,209,255,0.03)'}}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-7 h-7 flex items-center justify-center mono text-xs font-bold"
                style={{background:'rgba(0,209,255,0.12)',border:'1px solid rgba(0,209,255,0.3)',color:'#00d1ff'}}>4</div>
              <span className="mono text-xs tracking-widest uppercase" style={{color:'#bbc9cf'}}>TRADING DESK MEMO</span>
            </div>
            <p className="text-sm leading-relaxed" style={{fontFamily:'Geist,sans-serif',color:'#e4e2e4'}}>
              {d.recommendation_text}
            </p>
          </div>
        )}

        <p className="mono text-xs text-center mt-6 opacity-40" style={{color:'#859399'}}>
          Model estimates only — not a market forecast. Baseline oil price is a configured reference value.
        </p>
      </div>
    </div>
  )
}
