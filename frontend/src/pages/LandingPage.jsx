// LandingPage — pure static UI, zero API calls, zero backend dependencies.
// CTA buttons navigate to /dashboard via react-router-dom useNavigate.

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

// ── WebGL shader background ──────────────────────────────────────────────────
function ShaderCanvas() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    const syncSize = () => {
      const w = canvas.clientWidth || 1280
      const h = canvas.clientHeight || 720
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h
      }
    }
    const ro = new ResizeObserver(syncSize)
    ro.observe(canvas)
    syncSize()

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) return

    const vs = `attribute vec2 a_position;varying vec2 v_texCoord;
void main(){v_texCoord=a_position*0.5+0.5;gl_Position=vec4(a_position,0.0,1.0);}`

    const fs = `precision highp float;
varying vec2 v_texCoord;uniform float u_time;uniform vec2 u_resolution;
float grid(vec2 uv,float res){vec2 g=fract(uv*res);return step(0.98,max(g.x,g.y));}
float scanline(vec2 uv){return sin(uv.y*800.0+u_time*5.0)*0.02;}
void main(){
  vec2 uv=v_texCoord;
  vec3 baseColor=vec3(0.039,0.055,0.078);
  float g=grid(uv,20.0)*0.05;
  float vignette=1.0-length(uv-0.5)*1.2;
  vec2 p1=vec2(0.3,0.45);vec2 p2=vec2(0.25,0.35);
  float pulse1=smoothstep(0.05,0.0,length(uv-p1))*(0.5+0.5*sin(u_time*3.0));
  float pulse2=smoothstep(0.04,0.0,length(uv-p2))*(0.5+0.5*sin(u_time*2.5+1.0));
  vec3 accent=vec3(0.0,0.82,1.0)*(pulse1+pulse2)*0.2;
  vec3 finalColor=baseColor+g+scanline(uv)+accent;
  gl_FragColor=vec4(finalColor*vignette,1.0);
}`

    const makeShader = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s
    }
    const prog = gl.createProgram()
    gl.attachShader(prog, makeShader(gl.VERTEX_SHADER, vs))
    gl.attachShader(prog, makeShader(gl.FRAGMENT_SHADER, fs))
    gl.linkProgram(prog); gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW)
    const pos = gl.getAttribLocation(prog, 'a_position')
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)
    const uTime = gl.getUniformLocation(prog, 'u_time')
    const uRes  = gl.getUniformLocation(prog, 'u_resolution')

    let raf
    const render = (t) => {
      syncSize()
      gl.viewport(0, 0, canvas.width, canvas.height)
      if (uTime) gl.uniform1f(uTime, t * 0.001)
      if (uRes)  gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return (
    <canvas ref={ref} style={{
      position: 'absolute', inset: 0, width: '100%', height: '100%',
      opacity: 0.4, mixBlendMode: 'screen', display: 'block',
    }} />
  )
}

// ── Intersection-observer fade-in for feature cards ──────────────────────────
function FadeCard({ children, className, style }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.style.opacity = '1'; el.style.transform = 'translateY(0)' }
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} className={className} style={{
      opacity: 0, transform: 'translateY(32px)',
      transition: 'opacity 0.7s ease, transform 0.7s ease',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate()
  const toDashboard = () => navigate('/dashboard')

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div style={{background:'#0A0E14',color:'#e4e2e4',fontFamily:"'Geist',sans-serif",overflowX:'hidden'}}>

      {/* ── Top Nav ── */}
      <nav style={{
        position:'fixed',top:0,width:'100%',zIndex:50,
        background:'rgba(10,14,20,0.8)',backdropFilter:'blur(8px)',
        borderBottom:'1px solid rgba(60,73,78,0.3)',
      }}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 32px',maxWidth:1920,margin:'0 auto'}}>
          <span style={{fontFamily:"'Geist',sans-serif",fontWeight:700,fontSize:18,letterSpacing:'-0.01em',color:'#e4e2e4'}}>
            PROJECT SENTINEL
          </span>
          <div className="hidden md:flex" style={{gap:32,alignItems:'center'}}>
            {['problem','solution','features'].map(id => (
              <button key={id} onClick={() => scrollTo(id)}
                style={{background:'none',border:'none',cursor:'pointer',color:'#bbc9cf',fontSize:14,fontFamily:"'Geist',sans-serif"}}
                onMouseEnter={e=>e.target.style.color='#00d1ff'}
                onMouseLeave={e=>e.target.style.color='#bbc9cf'}>
                {id.charAt(0).toUpperCase() + id.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={toDashboard} style={{
            background:'#00d1ff',color:'#003543',
            padding:'8px 24px',fontWeight:700,fontSize:14,
            border:'none',cursor:'pointer',fontFamily:"'Geist',sans-serif",
          }}>
            Launch App
          </button>
        </div>
      </nav>

      <main>
        {/* ── Hero ── */}
        <section style={{
          position:'relative',minHeight:'100vh',display:'flex',
          flexDirection:'column',alignItems:'center',justifyContent:'center',
          paddingTop:96,overflow:'hidden',padding:'96px 32px 64px',
        }}>
          <ShaderCanvas />

          <div style={{position:'relative',zIndex:10,maxWidth:896,textAlign:'center'}}>
            {/* Live badge */}
            <div style={{
              display:'inline-flex',alignItems:'center',gap:8,
              background:'rgba(0,78,96,0.2)',border:'1px solid rgba(0,209,255,0.3)',
              padding:'4px 12px',marginBottom:24,
            }}>
              <span style={{width:8,height:8,borderRadius:'50%',background:'#00d1ff',animation:'pulse 2s infinite'}}/>
              <span className="mono" style={{fontSize:11,letterSpacing:'0.05em',color:'#00d1ff'}}>LIVE RISK FEED ACTIVE</span>
            </div>

            <h1 style={{
              fontFamily:"'Geist',sans-serif",fontWeight:600,
              fontSize:'clamp(32px,5vw,56px)',lineHeight:1.1,
              letterSpacing:'-0.02em',color:'#e4e2e4',margin:'0 0 24px',
            }}>
              India imports 88% of its oil.{' '}
              <span style={{color:'#00d1ff'}}>One chokepoint event could change everything.</span>
            </h1>

            <p style={{fontSize:16,lineHeight:'24px',color:'#bbc9cf',maxWidth:640,margin:'0 auto 32px'}}>
              Project Sentinel is an AI-driven resilience platform that detects disruption risks
              and recommends rerouting before a crisis hits.
            </p>

            <div style={{display:'flex',flexWrap:'wrap',gap:16,justifyContent:'center',marginBottom:64}}>
              <button onClick={toDashboard} style={{
                background:'#00d1ff',color:'#003543',padding:'16px 40px',
                fontWeight:700,fontSize:16,border:'none',cursor:'pointer',
                fontFamily:"'Geist',sans-serif",
              }}>
                View Live Dashboard
              </button>
              <button onClick={() => scrollTo('solution')} style={{
                background:'transparent',border:'1px solid #3c494e',
                color:'#e4e2e4',padding:'16px 40px',
                fontWeight:700,fontSize:16,cursor:'pointer',
                fontFamily:"'Geist',sans-serif",
              }}>
                Explore the Platform
              </button>
            </div>

            {/* Stat strip */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:16,maxWidth:720,margin:'0 auto'}}>
              {[
                { label:'CURRENT STATUS', value:'9.5 days SPR cover', accent:'#00d1ff' },
                { label:'EXPOSURE',       value:'45% via Hormuz',     accent:'#859399' },
                { label:'PROTOCOL',       value:'Live risk monitoring',accent:'#859399' },
              ].map(s => (
                <div key={s.label} style={{
                  background:'rgba(31,31,33,0.5)',borderLeft:`1px solid ${s.accent}`,
                  padding:'16px',backdropFilter:'blur(4px)',textAlign:'left',
                }}>
                  <div className="mono" style={{fontSize:11,letterSpacing:'0.05em',color:s.accent,marginBottom:4}}>{s.label}</div>
                  <div className="mono" style={{fontSize:13,fontWeight:500,color:'#e4e2e4'}}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Problem ── */}
        <section id="problem" style={{padding:'96px 32px',maxWidth:1920,margin:'0 auto'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:64,alignItems:'center',maxWidth:1200,margin:'0 auto'}}>
            <div>
              <h2 style={{fontFamily:"'Geist',sans-serif",fontWeight:600,fontSize:32,lineHeight:'40px',letterSpacing:'-0.02em',color:'#e4e2e4',marginBottom:24}}>
                The data exists. <br/>The intelligence to act on it doesn't.
              </h2>
              <p style={{fontSize:16,lineHeight:'24px',color:'#bbc9cf'}}>
                The 2025 escalation in the Strait of Hormuz demonstrated the fragility of global
                energy corridors. Without predictive modeling, national response times remain
                reactive, costing billions in volatility and security risk.
              </p>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {[
                { stat:'88%',   desc:'Crude imported annually into the subcontinent', border:'#3c494e', color:'#00d1ff' },
                { stat:'47 days', desc:'Slower recovery without automated response systems', border:'#ffb4ab', color:'#ffb4ab' },
                { stat:'9.5 days',desc:'Total Strategic Petroleum Reserve (SPR) cover', border:'#3c494e', color:'#e4e2e4' },
              ].map(s => (
                <FadeCard key={s.stat} style={{
                  background:'rgba(31,31,33,0.6)',backdropFilter:'blur(12px)',
                  border:`1px solid rgba(60,73,78,0.4)`,borderLeft:`4px solid ${s.border}`,
                  padding:32,
                }}>
                  <div style={{fontFamily:"'Geist',sans-serif",fontWeight:600,fontSize:48,lineHeight:'56px',letterSpacing:'-0.02em',color:s.color,marginBottom:8}}>
                    {s.stat}
                  </div>
                  <div style={{fontSize:14,lineHeight:'20px',color:'#bbc9cf'}}>{s.desc}</div>
                </FadeCard>
              ))}
            </div>
          </div>
        </section>

        {/* ── Solution ── */}
        <section id="solution" style={{
          padding:'96px 32px',
          background:'rgba(14,14,16,0.5)',
          borderTop:'1px solid rgba(60,73,78,0.1)',
          borderBottom:'1px solid rgba(60,73,78,0.1)',
        }}>
          <div style={{maxWidth:1200,margin:'0 auto'}}>
            <h2 style={{
              fontFamily:"'Geist',sans-serif",fontWeight:600,fontSize:32,
              lineHeight:'40px',letterSpacing:'-0.02em',color:'#e4e2e4',
              textAlign:'center',marginBottom:64,
            }}>
              From signal to decision — automatically
            </h2>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:32}}>
              {[
                { icon:'radar',  phase:'PHASE 01', title:'Detect',    desc:'Geopolitical risk intelligence agent monitoring 2,400+ signals.' },
                { icon:'hub',    phase:'PHASE 02', title:'Simulate',  desc:'AI-driven scenario modeller analyzing impact on supply chains.' },
                { icon:'route',  phase:'PHASE 03', title:'Recommend', desc:'Procurement orchestrator suggesting optimal rerouting pathways.' },
              ].map(s => (
                <FadeCard key={s.title} style={{
                  background:'rgba(31,31,33,0.6)',backdropFilter:'blur(12px)',
                  border:'1px solid rgba(60,73,78,0.4)',
                  padding:40,display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',gap:24,
                }}>
                  <div style={{
                    width:64,height:64,display:'flex',alignItems:'center',justifyContent:'center',
                    background:'rgba(0,209,255,0.1)',border:'1px solid #00d1ff',
                  }}>
                    <span className="material-symbols-outlined" style={{fontSize:32,color:'#00d1ff'}}>{s.icon}</span>
                  </div>
                  <div>
                    <div className="mono" style={{fontSize:10,letterSpacing:'0.1em',fontWeight:700,color:'#00d1ff',marginBottom:8}}>{s.phase}</div>
                    <h3 style={{fontFamily:"'Geist',sans-serif",fontWeight:500,fontSize:18,color:'#e4e2e4',marginBottom:16}}>{s.title}</h3>
                    <p style={{fontSize:14,lineHeight:'20px',color:'#bbc9cf'}}>{s.desc}</p>
                  </div>
                </FadeCard>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" style={{padding:'96px 32px',maxWidth:1920,margin:'0 auto'}}>
          <div style={{maxWidth:1200,margin:'0 auto',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:32}}>
            {[
              {
                title:'Risk Intelligence Dashboard',
                desc:'Real-time maritime monitoring and chokepoint tracking using high-fidelity geospatial data.',
                tag:'Live Integration',
                img:'https://lh3.googleusercontent.com/aida-public/AB6AXuDHt5WU0o5Wm3eAX0MijzxgYNxLWntsAIcWDU3llr-tAG6z4LPUBj3Wy1D5LmpRi0rvf89m3Y0_H1-XS6-gOPgyC78Nd6KzT0bLaduOQGSEfwcmx-wYGAsjDq-yNCuEkpJJ_qr_mJ5US39H9dEk6qeGH7MFnfjBg38DSzIVJS85Q7xXZQGRO5u1RmTcCfXSdArjneX5xXFyJ1krjXJSNbwsYC1JdnIZtjIGmit-OAok9MV9-LaNqzes8kAut51SGdC98mmTs9VH0z8P',
              },
              {
                title:'Scenario Modeller',
                desc:'AI-driven impact analysis for geopolitical disruptions, providing predictive outcome scoring.',
                tag:'Predictive Engine',
                img:'https://lh3.googleusercontent.com/aida-public/AB6AXuAlReL5JNaAD-uO8irDJoW1yXPyDyfylC3wP0GeHaYgnvAepJ8MSkEgOohx6IX3CaC80-3D2ADG_eBmS3_N2YMWDWdjfBbEnoxvr0LJAlFhnEdMkkUIncNFkZAfOSkIZj4USBZGzucDS-u7jvUQtdr_U42lXfDR2e6o6HNPaIh_m7gmrBpjeqZPuFhH7ONTw4SOmNEPQbJItVoi3DGi66L2s4VJuq0NmEjKt_-NpNQQT9tXbzYOS6vjCivXxCx2ERKvdtogC5FsarVE',
              },
              {
                title:'Procurement Recommendations',
                desc:'Automated logistics and supplier optimization to ensure energy security during volatility.',
                tag:'Strategic Solver',
                img:'https://lh3.googleusercontent.com/aida-public/AB6AXuDiZkiQr2ui88UhL2lp7IaTMhwR4iqPrVqErFfHQwVLzbacFoz2U9o9q_K-6IaYfwl1xOmJmXUE57FJoPj3cEwpslzm9ww3TSrcphVq-FcKhqVXNNvIWHr0YnY_R-RFJmoxmqpXs0kWWDoXr7BmFIVhf2GWR2XhhZhJPMZchoUM3gSYLUxmI2kIff1QPxpZPQZmAal7ZpCNWwl2xQmXEnURy_Zjtd4gB_yj-REx7dVZm2BLpvmRIQtRq2h0K5-PIGKxgsPmWX5WLkqM',
              },
            ].map(f => (
              <FadeCard key={f.title} style={{
                background:'rgba(31,31,33,0.6)',backdropFilter:'blur(12px)',
                border:'1px solid rgba(60,73,78,0.4)',
                display:'flex',flexDirection:'column',
                transition:'all 0.3s cubic-bezier(0.4,0,0.2,1)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='#00d1ff'; e.currentTarget.style.background='rgba(31,31,33,0.8)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(60,73,78,0.4)'; e.currentTarget.style.background='rgba(31,31,33,0.6)' }}>
                <div style={{height:256,overflow:'hidden',borderBottom:'1px solid rgba(60,73,78,0.3)'}}>
                  <img src={f.img} alt={f.title} style={{width:'100%',height:'100%',objectFit:'cover',filter:'grayscale(1)',transition:'filter 0.7s'}}
                    onMouseEnter={e=>e.target.style.filter='grayscale(0)'}
                    onMouseLeave={e=>e.target.style.filter='grayscale(1)'} />
                </div>
                <div style={{padding:32,display:'flex',flexDirection:'column',gap:16,flex:1}}>
                  <h3 style={{fontFamily:"'Geist',sans-serif",fontWeight:500,fontSize:18,color:'#e4e2e4',margin:0}}>{f.title}</h3>
                  <p style={{fontSize:14,lineHeight:'20px',color:'#bbc9cf',margin:0}}>{f.desc}</p>
                  <div style={{height:1,background:'rgba(60,73,78,0.2)'}}/>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span className="mono" style={{fontSize:11,letterSpacing:'0.1em',fontWeight:700,color:'#00d1ff',textTransform:'uppercase'}}>{f.tag}</span>
                    <span className="material-symbols-outlined" style={{fontSize:16,color:'#00d1ff'}}>trending_flat</span>
                  </div>
                </div>
              </FadeCard>
            ))}
          </div>
        </section>

        {/* ── Tech strip ── */}
        <section style={{
          padding:'48px 0',overflow:'hidden',whiteSpace:'nowrap',
          borderTop:'1px solid rgba(60,73,78,0.1)',
          borderBottom:'1px solid rgba(60,73,78,0.1)',
          background:'#0e0e10',
        }}>
          <div style={{display:'flex',animation:'scroll 40s linear infinite',gap:48}}>
            {['Agentic AI','Geospatial Intelligence','Predictive Analytics','Real-time Risk Scoring','Maritime Tracking',
              'Agentic AI','Geospatial Intelligence','Predictive Analytics','Real-time Risk Scoring','Maritime Tracking'].map((t,i) => (
              <span key={i} className="mono" style={{
                fontSize:10,letterSpacing:'0.1em',fontWeight:700,
                color:'#3c494e',border:'1px solid rgba(60,73,78,0.3)',
                padding:'8px 24px',flexShrink:0,
              }}>{t}</span>
            ))}
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section style={{
          padding:'128px 32px',textAlign:'center',position:'relative',
          background:'radial-gradient(circle at center, rgba(0,209,255,0.05) 0%, transparent 70%)',
        }}>
          <div style={{maxWidth:768,margin:'0 auto'}}>
            <h2 style={{
              fontFamily:"'Geist',sans-serif",fontWeight:600,
              fontSize:'clamp(32px,4vw,48px)',lineHeight:1.1,
              letterSpacing:'-0.02em',color:'#e4e2e4',marginBottom:48,
            }}>
              Turn reactive crisis response into managed intelligence
            </h2>
            <button onClick={toDashboard} style={{
              background:'#00d1ff',color:'#003543',
              padding:'20px 48px',fontWeight:700,fontSize:16,
              border:'none',cursor:'pointer',fontFamily:"'Geist',sans-serif",
              position:'relative',transition:'all 0.2s',
            }}
            onMouseEnter={e=>e.currentTarget.style.filter='brightness(1.1)'}
            onMouseLeave={e=>e.currentTarget.style.filter='brightness(1)'}>
              Explore the Platform
            </button>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer style={{
        padding:'48px 32px',
        borderTop:'1px solid rgba(60,73,78,0.2)',
        background:'#0e0e10',
        textAlign:'center',
      }}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:24}}>
          <span style={{fontFamily:"'Geist',sans-serif",fontWeight:700,fontSize:18,color:'#e4e2e4'}}>
            PROJECT SENTINEL
          </span>
          <div style={{display:'flex',gap:32}}>
            {['Documentation','Contact','Privacy Policy'].map(l => (
              <a key={l} href="#" className="mono" style={{fontSize:11,color:'#bbc9cf',textDecoration:'none'}}
                onMouseEnter={e=>e.target.style.color='#a4e6ff'}
                onMouseLeave={e=>e.target.style.color='#bbc9cf'}>{l}</a>
            ))}
          </div>
          <p className="mono" style={{fontSize:11,color:'#bbc9cf',opacity:0.5}}>
            © 2024 Project Sentinel. Built for Global Risk Intelligence Hackathon.
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes pulse {
          0%,100% { opacity:1; }
          50%      { opacity:0.4; }
        }
      `}</style>
    </div>
  )
}
