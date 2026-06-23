// Screen 1 — Risk Intelligence Dashboard
// Data contract preserved: data={hormuz,red_sea,general:{avg_risk_score,top_headlines,top_scores,top_reasoning}}, loading:bool

const LABELS = {
  hormuz:  'STRAIT OF HORMUZ',
  red_sea: 'RED SEA / HOUTHI',
  general: 'IRAN / OPEC',
}

const CORRIDOR_ORDER = ['hormuz', 'red_sea', 'general']

function riskColor(score) {
  if (score >= 70) return { bar: '#ffb4ab', text: '#ffb4ab', bg: 'rgba(147,0,10,0.3)', border: 'rgba(255,180,171,0.4)' }
  if (score >= 40) return { bar: '#ffb12f', text: '#ffb12f', bg: 'rgba(255,177,47,0.1)', border: 'rgba(255,177,47,0.4)' }
  return              { bar: '#00d1ff', text: '#a4e6ff',  bg: 'rgba(0,209,255,0.08)',  border: 'rgba(0,209,255,0.3)' }
}

function SkeletonCard() {
  return (
    <div className="glass-panel p-5 animate-pulse" style={{minHeight:160}}>
      <div className="h-3 w-32 rounded mb-3" style={{background:'#2a2a2c'}}/>
      <div className="h-2 w-full rounded mb-4" style={{background:'#2a2a2c'}}/>
      <div className="h-3 w-full rounded mb-2" style={{background:'#1f1f21'}}/>
      <div className="h-3 w-3/4 rounded" style={{background:'#1f1f21'}}/>
    </div>
  )
}

export default function RiskScoreCards({ data, loading, onRefresh }) {
  if (loading) return (
    <div className="h-full flex flex-col gap-4 p-6 overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1,2,3].map(i => <SkeletonCard key={i} />)}
      </div>
    </div>
  )

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{background:'#0A0A0B'}}>
      <div className="flex-1 overflow-y-auto p-6 pb-12">

        {/* Top row — corridor cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {CORRIDOR_ORDER.map(key => {
            const val = data?.[key]
            if (!val) return <SkeletonCard key={key} />
            const c = riskColor(val.avg_risk_score)
            return (
              <div key={key} className="glass-panel p-5 card-glow" style={{borderColor: c.border}}>
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="mono text-xs tracking-widest" style={{color:'#bbc9cf'}}>{LABELS[key]}</span>
                  <span className="mono text-sm font-bold" style={{color: c.text}}>
                    {val.avg_risk_score}<span className="text-xs opacity-60">/100</span>
                  </span>
                </div>

                {/* Score bar */}
                <div className="w-full h-1.5 mb-3" style={{background:'#1f1f21',border:'1px solid #3c494e'}}>
                  <div className="h-full transition-all duration-700" style={{width:`${val.avg_risk_score}%`, background: c.bar}} />
                </div>

                {/* Micro sparkline */}
                <svg viewBox="0 0 120 24" className="w-full mb-3" style={{height:24}}>
                  <polyline
                    fill="none"
                    stroke={c.bar}
                    strokeWidth="1.2"
                    opacity="0.7"
                    points={`0,${20 - val.avg_risk_score * 0.18} 30,${20 - val.avg_risk_score * 0.22} 60,${20 - val.avg_risk_score * 0.15} 90,${20 - val.avg_risk_score * 0.20} 120,${20 - val.avg_risk_score * 0.18}`}
                  />
                </svg>

                {/* Top headline */}
                {val.top_headlines?.[0] && (
                  <p className="mono text-xs leading-relaxed line-clamp-2" style={{color:'#859399'}}>
                    {val.top_headlines[0]}
                  </p>
                )}
                {val.top_reasoning?.[0] && (
                  <p className="mono text-xs mt-1 italic line-clamp-1 opacity-60" style={{color:'#bbc9cf'}}>
                    {val.top_reasoning[0]}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* Bottom row: SPR gauge + signal feed + top risk list */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* SPR Gauge */}
          <div className="glass-panel p-5 flex flex-col items-center justify-center">
            <p className="mono text-xs tracking-widest mb-4 self-start" style={{color:'#bbc9cf'}}>STRATEGIC RESERVE STATUS</p>
            <div className="relative flex items-center justify-center" style={{width:140,height:140}}>
              <svg width="140" height="140" style={{transform:'rotate(-90deg)'}}>
                <circle cx="70" cy="70" r="58" fill="none" stroke="#1f1f21" strokeWidth="10"/>
                <circle cx="70" cy="70" r="58" fill="none" stroke="#00d1ff" strokeWidth="10"
                  strokeDasharray="364" strokeDashoffset={364 * (1 - 9.5/30)} strokeLinecap="butt"/>
                <line x1="12" y1="70" x2="22" y2="70" stroke="#ffb4ab" strokeWidth="2" transform="rotate(220 70 70)"/>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="mono font-bold text-xl" style={{color:'#a4e6ff'}}>9.5</span>
                <span className="mono text-xs" style={{color:'#a4e6ff'}}>DAYS</span>
                <span className="mono text-xs opacity-50" style={{color:'#bbc9cf'}}>COVERAGE</span>
              </div>
            </div>
            <p className="mono text-xs mt-3 tracking-widest uppercase" style={{color:'#ffb4ab'}}>
              THRESHOLD WARNING: -1.2D VAR
            </p>
          </div>

          {/* Live Signal Feed */}
          <div className="glass-panel p-5 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined" style={{fontSize:16,color:'#00d1ff'}}>rss_feed</span>
                <span className="mono text-xs tracking-widest" style={{color:'#e4e2e4'}}>LIVE SIGNAL FEED</span>
              </div>
              <span className="mono text-xs" style={{color:'#bbc9cf'}}>{data ? '15 SIGNALS/MIN' : '--'}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {data && Object.entries(data).flatMap(([key, val]) =>
                (val.top_headlines || []).slice(0,2).map((h, i) => {
                  const c = riskColor(val.avg_risk_score)
                  return (
                    <div key={`${key}-${i}`} className="flex items-start gap-3 py-2 transition-colors"
                      style={{borderBottom:'1px solid rgba(60,73,78,0.2)'}}>
                      <span className="w-2 h-2 rounded-full mt-1 shrink-0 status-pulse" style={{background: c.bar}}/>
                      <div className="flex-1 min-w-0">
                        <span className="mono text-xs font-bold mr-2" style={{color: c.text}}>{LABELS[key]}</span>
                        <p className="mono text-xs line-clamp-1 mt-0.5" style={{color:'#e4e2e4'}}>{h}</p>
                      </div>
                    </div>
                  )
                })
              )}
              {!data && (
                <p className="mono text-xs opacity-40" style={{color:'#bbc9cf'}}>Awaiting signal feed...</p>
              )}
            </div>
          </div>

          {/* Top Risk Corridors ranked list */}
          <div className="glass-panel p-5 flex flex-col">
            <p className="mono text-xs tracking-widest mb-4" style={{color:'#bbc9cf'}}>TOP RISK CORRIDORS</p>
            <div className="space-y-4 flex-1">
              {data
                ? CORRIDOR_ORDER
                    .map(k => ({key: k, val: data[k]}))
                    .sort((a,b) => (b.val?.avg_risk_score||0) - (a.val?.avg_risk_score||0))
                    .map((item, rank) => {
                      const c = riskColor(item.val?.avg_risk_score || 0)
                      return (
                        <div key={item.key} className="space-y-1">
                          <div className="flex justify-between items-end">
                            <span className="mono text-xs" style={{color:'#e4e2e4'}}>{rank+1}. {LABELS[item.key]}</span>
                            <span className="mono text-xs font-bold" style={{color: c.text}}>
                              {item.val?.avg_risk_score ?? '--'}/100
                            </span>
                          </div>
                          <div className="h-1.5 w-full" style={{background:'#1b1b1d',border:'1px solid #3c494e'}}>
                            <div className="h-full" style={{width:`${item.val?.avg_risk_score||0}%`, background: c.bar}}/>
                          </div>
                        </div>
                      )
                    })
                : [1,2,3].map(i => (
                    <div key={i} className="space-y-1 animate-pulse">
                      <div className="h-3 rounded" style={{background:'#2a2a2c'}}/>
                      <div className="h-1.5 rounded" style={{background:'#1f1f21'}}/>
                    </div>
                  ))
              }
            </div>
            {onRefresh && (
              <button onClick={onRefresh}
                className="mt-4 w-full mono text-xs tracking-widest uppercase py-2 transition-colors"
                style={{background:'rgba(0,209,255,0.06)',border:'1px solid rgba(0,209,255,0.2)',color:'#00d1ff'}}>
                REFRESH SCORES
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
