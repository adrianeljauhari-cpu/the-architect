// uso: node render.cjs posts.json salida_dir   (renderiza post 1080x1350 e historia 1080x1920 por elemento)
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const items=JSON.parse(fs.readFileSync(process.argv[2]));const out=process.argv[3];
const dama='data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'dama.png')).toString('base64');
const css=`@import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@700&family=Inter:wght@400;600&display=swap');
*{margin:0;box-sizing:border-box}body{background:#14213d;font-family:Inter,sans-serif;color:#e8e9ee}
.f{position:absolute;inset:40px;border:2px solid #8a7340;border-radius:28px;padding:56px 60px;display:flex;flex-direction:column}
.h{display:flex;justify-content:space-between;align-items:center}.b{display:flex;align-items:center;gap:14px;font:700 46px 'Libre Baskerville',serif;color:#fff}.b img{height:76px}.b span{color:#c9a54b}.at{font:600 28px Inter;color:#b8bccb}
.tag{align-self:flex-start;margin-top:60px;background:#c9a54b;color:#14213d;font:600 28px Inter;letter-spacing:3px;padding:12px 26px;border-radius:40px}
h1{font:700 64px/1.18 'Libre Baskerville',serif;color:#fff;margin-top:36px}
ul{list-style:none;margin-top:48px}li{position:relative;padding-left:48px;font-size:33px;line-height:1.38;margin-bottom:30px}li:before{content:'';position:absolute;left:0;top:18px;width:20px;height:20px;border-radius:50%;background:#c9a54b}
.ft{margin-top:auto;border-top:2px solid #8a7340;padding-top:34px}.src{font:600 31px Inter;color:#c9a54b}.cta{font:600 36px Inter;color:#fff;margin-top:16px}.cta span{color:#c9a54b}.dis{font-size:22px;color:#9aa0b4;margin-top:34px}
.st h1{font-size:76px;margin-top:60px}.st li{font-size:38px}.st .cta{font-size:42px}`;
(async()=>{const br=await chromium.launch();
for(const it of items){for(const [kind,w,h] of [['post',1080,1350],['historia',1080,1920]]){
 const p=await br.newPage({viewport:{width:w,height:h}});
 const html=`<html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="f ${kind=='historia'?'st':''}"><div class="h"><div class="b"><img src="${dama}"><div>Legal<span>.ia</span></div></div><div class="at">@legalia.ve</div></div><div class="tag">${it.tag}</div><h1>${it.titulo}</h1><ul>${it.puntos.map(x=>'<li>'+x+'</li>').join('')}</ul><div class="ft"><div class="src">Fuente: ${it.fuente}</div><div class="cta">👉 ${kind=='historia'?'Pregúntale a Rick, gratis 3 días':'Entra gratis a la app'}: <span>enlace en el perfil</span></div><div class="dis">Material informativo basado en textos oficiales. No sustituye la asesoría de un abogado.</div></div></div></body></html>`;
 await p.setContent(html,{waitUntil:'networkidle'});await p.screenshot({path:path.join(out,`${kind}_${it.id}.jpg`),type:'jpeg',quality:92});await p.close();}}
await br.close();})();
