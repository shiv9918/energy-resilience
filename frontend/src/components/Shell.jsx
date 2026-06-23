import { useEffect, useState } from 'react'

const NAV_SCREENS = [
  { id: 'dashboard',  icon: 'language',        label: 'STRATEGIC' },
  { id: 'scenario',   icon: 'security',         label: 'SCENARIO' },
  { id: 'recommend',  icon: 'analytics',        label: 'PROCURE' },
  { id: 'pipeline',   icon: 'account_tree',     label: 'PIPELINE' },
]

export default function Shell({ activeScreen, onNavigate, onRunPipeline, pipeLoading, children }) {
  const [clock, setClock] = useState('')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
      setClock(`${now.getUTCDate()} ${months[now.getUTCMonth()]} ${now.getUTCFullYear()} ${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')}:${String(now.getUTCSeconds()).padStart(2,'0')} UTC`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{background:'#0A0A0B',color:'#e4e2e4'}}>
      {/* Top nav */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-8 h-16"
        style={{background:'rgba(19,19,21,0.85)',backdropFilter:'blur(16px)',borderBottom:'1px solid rgba(60,73,78,0.4)'}}>
        <div className="flex items-center gap-8">
          <span className="mono font-black tracking-tighter text-xl" style={{color:'#00d1ff'}}>SENTINEL</span>
          <div className="hidden md:flex items-center gap-4 px-4" style={{borderLeft:'1px solid rgba(60,73,78,0.4)'}}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full status-pulse" style={{background:'#5bffa1'}}/>
              <span className="mono text-xs tracking-widest uppercase" style={{color:'#5bffa1'}}>LIVE</span>
            </div>
            <div className="mono text-xs pl-4" style={{color:'#bbc9cf',borderLeft:'1px solid rgba(60,73,78,0.3)'}}>
              {clock}
            </div>
          </div>
        </div>

        <nav className="hidden md:flex gap-6 items-center h-full">
          {NAV_SCREENS.map(s => (
            <button key={s.id} onClick={() => onNavigate(s.id)}
              className="mono text-xs tracking-widest uppercase transition-colors"
              style={{
                color: activeScreen === s.id ? '#a4e6ff' : '#bbc9cf',
                borderBottom: activeScreen === s.id ? '2px solid #00d1ff' : '2px solid transparent',
                paddingBottom: '2px',
              }}>
              {s.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <button
            onClick={onRunPipeline}
            disabled={pipeLoading}
            className="flex items-center gap-2 mono text-xs tracking-widest uppercase px-4 py-2 transition-colors disabled:opacity-40"
            style={{background:'rgba(0,209,255,0.12)',border:'1px solid rgba(0,209,255,0.4)',color:'#00d1ff'}}>
            {pipeLoading
              ? <><span className="material-symbols-outlined animate-spin" style={{fontSize:14}}>refresh</span>RUNNING...</>
              : <><span className="material-symbols-outlined" style={{fontSize:14}}>play_arrow</span>RUN PIPELINE</>}
          </button>
          <span className="material-symbols-outlined cursor-pointer" style={{color:'#bbc9cf'}}>notifications</span>
          <span className="material-symbols-outlined cursor-pointer" style={{color:'#bbc9cf'}}>settings</span>
        </div>
      </header>

      {/* Side nav */}
      <aside className="fixed left-0 top-0 h-full flex flex-col z-40 overflow-hidden transition-all duration-300 group"
        style={{
          width: 64,
          background:'rgba(14,14,16,0.92)',
          backdropFilter:'blur(20px)',
          borderRight:'1px solid rgba(60,73,78,0.25)',
          paddingTop: 80,
        }}
        onMouseEnter={e => e.currentTarget.style.width='220px'}
        onMouseLeave={e => e.currentTarget.style.width='64px'}>
        <div className="flex flex-col gap-1 overflow-hidden">
          {NAV_SCREENS.map(s => {
            const active = activeScreen === s.id
            return (
              <button key={s.id} onClick={() => onNavigate(s.id)}
                className="flex items-center gap-4 py-3 px-4 w-full transition-all whitespace-nowrap"
                style={{
                  color: active ? '#00d1ff' : '#bbc9cf',
                  background: active ? 'rgba(0,209,255,0.08)' : 'transparent',
                  borderRight: active ? '2px solid #00d1ff' : '2px solid transparent',
                }}>
                <span className="material-symbols-outlined shrink-0" style={{fontSize:20,color:active?'#00d1ff':'#bbc9cf'}}>{s.icon}</span>
                <span className="mono text-xs tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{color:active?'#00d1ff':'#bbc9cf'}}>{s.label}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-auto pb-6 flex flex-col gap-1">
          {[{icon:'help',label:'SUPPORT'},{icon:'history',label:'LOGS'}].map(item => (
            <div key={item.icon} className="flex items-center gap-4 py-3 px-4 cursor-pointer whitespace-nowrap" style={{color:'#bbc9cf'}}>
              <span className="material-symbols-outlined shrink-0" style={{fontSize:20}}>{item.icon}</span>
              <span className="mono text-xs tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity">{item.label}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Main canvas */}
      <main className="flex-1 mt-16 ml-16 overflow-hidden">
        {children}
      </main>

      {/* Footer ticker */}
      <footer className="fixed bottom-0 left-16 right-0 h-9 flex items-center px-6 z-40 overflow-hidden"
        style={{background:'rgba(14,14,16,0.95)',borderTop:'1px solid rgba(60,73,78,0.25)'}}>
        <span className="mono text-xs whitespace-nowrap mr-6" style={{color:'#00d1ff'}}>GLOBAL STATUS: MONITORING</span>
        <div className="flex gap-8 animate-marquee whitespace-nowrap">
          {[
            'SUEZ CANAL: MONITORING',
            'HORMUZ: ELEVATED RISK',
            'BRENT CRUDE: $82.41 (+1.4%)',
            'RED SEA: CAUTION ADVISORY',
            'INDIA SPR: 9.5 DAYS COVER',
            'SUEZ CANAL: MONITORING',
            'HORMUZ: ELEVATED RISK',
            'BRENT CRUDE: $82.41 (+1.4%)',
            'RED SEA: CAUTION ADVISORY',
            'INDIA SPR: 9.5 DAYS COVER',
          ].map((t, i) => (
            <span key={i} className="mono text-xs" style={{color:'#bbc9cf'}}>{t}</span>
          ))}
        </div>
        <div className="ml-auto mono text-xs opacity-40 shrink-0 pl-4" style={{color:'#bbc9cf'}}>
          NODE: GS-CENTRAL
        </div>
      </footer>
    </div>
  )
}
