/* 史塔克交易助手：型態偵測（瀏覽器與 node 共用）。改寫自選股網站 patterns.py，加上量度目標價、停損、規則分數與白話說明。
   bars: [{t,o,h,l,c,v}] 由舊到新。回傳 [{n,dir,st,nk,tgt,stop,ht,conf,bt,pts:[[t,價,標籤]],ln:[[t1,p1,t2,p2,標籤]],note,ex}] */
(function(root){
const P={
  D:{k:5,N:150,min:60,tol:.03,minH:.06,sep:10,fresh:10,brk:.01,hsTol:.05,hsHead:.03,boxW:30,boxAmp:.12,boxTouch:.02,maxH:.3,pole:.15,poleMax:10,vol:1.2,triH:.2,triFlat:.015,triWin:60},
  I:{k:4,N:200,min:40,tol:.015,minH:.025,sep:6,fresh:8,brk:.004,hsTol:.02,hsHead:.012,boxW:24,boxAmp:.05,boxTouch:.006,maxH:.15,pole:.05,poleMax:8,vol:1.3,triH:.08,triFlat:.006,triWin:60},
  M5:{k:3,N:80,min:15,tol:.008,minH:.012,sep:5,fresh:6,brk:.003,hsTol:.01,hsHead:.006,boxW:18,boxAmp:.025,boxTouch:.004,maxH:.06,pole:.03,poleMax:6,vol:1.3,triH:.04,triFlat:.003,triWin:40,noHS:1,noTri:1,noFlag:1}
};
const r2=x=>x==null?null:Math.round(x*100)/100, cl=x=>Math.max(0,Math.min(1,x));
function piv(H,L,k){const ph=[],pl=[];
  for(let i=k;i<H.length-k;i++){const wh=H.slice(i-k,i+k+1),wl=L.slice(i-k,i+k+1);
    if(H[i]===Math.max(...wh)&&H[i]>Math.max(...H.slice(i-k,i)))ph.push(i);
    if(L[i]===Math.min(...wl)&&L[i]<Math.min(...L.slice(i-k,i)))pl.push(i)}
  return[ph,pl]}
// 白話說明（{nk}頸線/觸發價、{tgt}目標、{stop}停損）
const EX={
 'W底':p=>`股價兩次跌到差不多的低點都撐住，像字母 W。收盤站上頸線 ${p.nk} 才算成立、可考慮買；目標＝頸線＋(頸線−底)＝${p.tgt}；跌破右邊的底 ${p.stop} 就是失敗要停損。`,
 'M頭':p=>`股價兩次漲到差不多的高點都過不去，像字母 M。收盤跌破頸線 ${p.nk} 才算成立，手上有就該賣、或可放空；目標＝頸線−(頭−頸線)＝${p.tgt}；漲回右邊的頭 ${p.stop} 以上就是失敗。`,
 '頭肩底':p=>`中間低、兩邊較高的三個底（像倒過來的人頭和肩膀），是跌深打底。站上頸線 ${p.nk} 可考慮買；目標＝頸線＋(頸線−頭)＝${p.tgt}；跌破右肩 ${p.stop} 停損。`,
 '頭肩頂':p=>`中間高、兩邊較低的三個高點（像人頭和肩膀），是漲多做頭。跌破頸線 ${p.nk} 該賣或可空；目標＝頸線−(頭−頸線)＝${p.tgt}；漲回右肩 ${p.stop} 以上就失敗。`,
 '箱型整理':p=>`股價在 ${p.nk2}～${p.nk} 之間來回，像關在箱子裡。往上突破 ${p.nk} 偏多，目標 ${p.tgt}；往下跌破 ${p.nk2} 偏空，目標 ${p.tgt2}。還沒突破前先不追。`,
 '箱型突破':p=>`股價衝出箱子上緣 ${p.nk}，代表買方贏了，可考慮買；目標＝箱頂＋箱子高度＝${p.tgt}；跌回箱子中間 ${p.stop} 以下就是假突破要停損。`,
 '箱型跌破':p=>`股價掉出箱子下緣 ${p.nk}，代表賣方贏了，該賣或可空；目標＝箱底−箱子高度＝${p.tgt}；漲回箱子中間 ${p.stop} 以上就失敗。`,
 '對稱三角':p=>`高點越來越低、低點越來越高，像越收越窄的三角形，快要選方向。往上突破 ${p.nk} 偏多，目標 ${p.tgt}；跌破 ${p.nk2} 偏空，目標 ${p.tgt2}。`,
 '上升三角':p=>`上面有一條平的壓力 ${p.nk}，低點卻一次比一次高，買方越來越急，通常往上突破。站上 ${p.nk} 可考慮買，目標 ${p.tgt}；跌破 ${p.nk2} 就失敗。`,
 '下降三角':p=>`下面有一條平的支撐 ${p.nk2}，高點卻一次比一次低，賣方越來越強，通常往下跌破。跌破 ${p.nk2} 該賣，目標 ${p.tgt2}；站上 ${p.nk} 就失敗。`,
 '三角突破':p=>`收斂的三角形往上突破 ${p.nk}，可考慮買；目標＝突破點＋三角形最寬處的高度＝${p.tgt}；跌破最近低點 ${p.stop} 停損。`,
 '三角跌破':p=>`收斂的三角形往下跌破 ${p.nk}，該賣或可空；目標＝跌破點−三角形最寬處的高度＝${p.tgt}；漲回最近高點 ${p.stop} 以上就失敗。`,
 '上升旗形':p=>`先大漲一段（旗桿），再小幅橫盤回檔（旗子），是休息後再漲的型態。站上旗子上緣 ${p.nk} 可考慮買；目標＝突破點＋旗桿長度＝${p.tgt}；跌破旗子下緣 ${p.stop} 停損。`,
 '下降旗形':p=>`先大跌一段（旗桿），再小幅反彈（旗子），是休息後再跌的型態。跌破旗子下緣 ${p.nk} 該賣；目標＝跌破點−旗桿長度＝${p.tgt}；漲回旗子上緣 ${p.stop} 以上就失敗。`,
 '多頭趨勢':p=>`高點一個比一個高、低點也一個比一個高，是上漲趨勢，拉回不破前低可以續抱或找買點。沒有量度目標；收盤跌破最近的底 ${p.stop} 趨勢就破壞。`,
 '空頭趨勢':p=>`高點一個比一個低、低點也一個比一個低，是下跌趨勢，不要接刀子。沒有量度目標；收盤站上最近的頭 ${p.stop} 才算止跌。`
};
function detect(bars,mode){
  const o=P[mode||'D'];const b=bars.filter(x=>x&&x.h!=null&&x.l!=null&&x.c!=null).slice(-o.N);
  if(b.length<o.min)return[];
  const T=b.map(x=>x.t),H=b.map(x=>x.h),L=b.map(x=>x.l),C=b.map(x=>x.c),V=b.map(x=>x.v||0),n=b.length,p=C[n-1];
  const vr=i=>{const a=V.slice(Math.max(mode==='M5'?1:0,i-20),i);if(!a.length)return 0;const m=a.reduce((x,y)=>x+y,0)/a.length;return m>0?V[i]/m:0};
  const brk=(lv,up,since)=>{for(let i=since+1;i<n;i++){const v=typeof lv==='function'?lv(i):lv;if(up?C[i]>v*(1+o.brk):C[i]<v*(1-o.brk))return i}return null};
  const [ph,pl]=piv(H,L,o.k);const out=[];
  const mx=(a,f)=>a.reduce((m,i)=>f(i)>f(m)?i:m,a[0]),mn=(a,f)=>a.reduce((m,i)=>f(i)<f(m)?i:m,a[0]);
  // 規則分數：對稱 30 + 突破量 30 + 深度 20 + 時間 20（不是勝率）
  function score(sym,bi,ht,ref,span){const v=bi==null?0:cl((vr(bi)-.8)/1.2);return{sym:Math.round(cl(sym)*30),vol:Math.round(v*30),dep:Math.round(cl(ht/ref/(3*o.minH))*20),dur:Math.round(cl(span/(3*o.sep))*20)}}
  function push(name,dir,nk,ht,stop,bi,span,sym,G,note){
    if(!(ht>0)||ht/nk>o.maxH)return;const tgt=r2(nk+dir*ht);let st;
    if(bi==null){if(dir>0?p<nk:p>nk)st='成形中';else return}
    else{if(n-1-bi>o.fresh)return;
      const back=dir>0?p<nk*(1-o.brk):p>nk*(1+o.brk);
      st=back?'失敗':(dir>0&&vr(bi)<o.vol?'量不足':(dir>0?'已突破':'已跌破'));
      if(!back&&(dir>0?p>=tgt:p<=tgt))st='已達標'}
    const s=score(sym,bi,ht,nk,span);let conf=s.sym+s.vol+s.dep+s.dur;if(st==='失敗')conf=Math.min(conf,15);
    out.push(Object.assign({n:name,dir,st,nk:r2(nk),tgt,stop:r2(stop),ht:r2(ht),conf,sc:s,bt:bi==null?null:T[bi],note},G))}
  function info(name,dir,nk,nk2,ht,stop,sym,span,G,note){if(!(ht>0)||ht/nk>o.maxH)return;const s=score(sym,null,ht,nk,span);
    out.push(Object.assign({n:name,dir,st:'成形中',nk:r2(nk),nk2:r2(nk2),tgt:r2(nk+ht),tgt2:r2(nk2-ht),stop:r2(stop),ht:r2(ht),conf:s.sym+s.vol+s.dep+s.dur,sc:s,bt:null,note},G))}
  // W底
  if(pl.length>=2){const a=pl[pl.length-2],c=pl[pl.length-1],mids=ph.filter(i=>a<i&&i<c);
    if(mids.length&&c-a>=o.sep){const d=Math.abs(L[a]-L[c])/Math.min(L[a],L[c]);
      if(d<=o.tol){const m=mx(mids,i=>H[i]),nk=H[m],lo=Math.min(L[a],L[c]);
        if(nk>=lo*(1+o.minH)&&Math.min(...L.slice(c))>=lo*(1-o.tol))
          push('W底',1,nk,nk-lo,L[c],brk(nk,1,c),c-a,1-d/o.tol,{pts:[[T[a],L[a],'底1'],[T[m],H[m],'頸'],[T[c],L[c],'底2']],ln:[[T[m],nk,T[n-1],nk,'頸線']]},`兩低 ${r2(L[a])}/${r2(L[c])}`)}}}
  // M頭
  if(ph.length>=2){const a=ph[ph.length-2],c=ph[ph.length-1],mids=pl.filter(i=>a<i&&i<c);
    if(mids.length&&c-a>=o.sep){const d=Math.abs(H[a]-H[c])/Math.min(H[a],H[c]);
      if(d<=o.tol){const m=mn(mids,i=>L[i]),nk=L[m],hi=Math.max(H[a],H[c]);
        if(nk<=hi/(1+o.minH)&&Math.max(...H.slice(c))<=hi*(1+o.tol))
          push('M頭',-1,nk,hi-nk,H[c],brk(nk,0,c),c-a,1-d/o.tol,{pts:[[T[a],H[a],'頭1'],[T[m],L[m],'頸'],[T[c],H[c],'頭2']],ln:[[T[m],nk,T[n-1],nk,'頸線']]},`兩高 ${r2(H[a])}/${r2(H[c])}`)}}}
  if(!o.noHS){
    if(pl.length>=3){const [s1,hd,s2]=pl.slice(-3);const t0=ph.filter(i=>s1<i&&i<hd),t1=ph.filter(i=>hd<i&&i<s2);
      if(t0.length&&t1.length){const a=mx(t0,i=>H[i]),c=mx(t1,i=>H[i]),d=Math.abs(L[s1]-L[s2])/Math.min(L[s1],L[s2]);
        if(d<=o.hsTol&&L[hd]<=Math.min(L[s1],L[s2])/(1+o.hsHead)&&Math.abs(H[a]-H[c])/Math.min(H[a],H[c])<=o.hsTol&&s2-s1>=o.sep*1.5&&Math.min(...L.slice(s2))>=L[hd]){
          const sl=(H[c]-H[a])/(c-a),nkf=i=>H[a]+sl*(i-a);const bi=brk(nkf,1,s2),nk=nkf(bi==null?n-1:bi);
          push('頭肩底',1,nk,nk-L[hd],L[s2],bi,s2-s1,1-d/o.hsTol,{pts:[[T[s1],L[s1],'左肩'],[T[a],H[a],'頸'],[T[hd],L[hd],'頭'],[T[c],H[c],'頸'],[T[s2],L[s2],'右肩']],ln:[[T[a],H[a],T[n-1],nkf(n-1),'頸線']]},`頭 ${r2(L[hd])}`)}}}
    if(ph.length>=3){const [s1,hd,s2]=ph.slice(-3);const t0=pl.filter(i=>s1<i&&i<hd),t1=pl.filter(i=>hd<i&&i<s2);
      if(t0.length&&t1.length){const a=mn(t0,i=>L[i]),c=mn(t1,i=>L[i]),d=Math.abs(H[s1]-H[s2])/Math.min(H[s1],H[s2]);
        if(d<=o.hsTol&&H[hd]>=Math.max(H[s1],H[s2])*(1+o.hsHead)&&Math.abs(L[a]-L[c])/Math.min(L[a],L[c])<=o.hsTol&&s2-s1>=o.sep*1.5&&Math.max(...H.slice(s2))<=H[hd]){
          const sl=(L[c]-L[a])/(c-a),nkf=i=>L[a]+sl*(i-a);const bi=brk(nkf,0,s2),nk=nkf(bi==null?n-1:bi);
          push('頭肩頂',-1,nk,H[hd]-nk,H[s2],bi,s2-s1,1-d/o.hsTol,{pts:[[T[s1],H[s1],'左肩'],[T[a],L[a],'頸'],[T[hd],H[hd],'頭'],[T[c],L[c],'頸'],[T[s2],H[s2],'右肩']],ln:[[T[a],L[a],T[n-1],nkf(n-1),'頸線']]},`頭 ${r2(H[hd])}`)}}}}
  // 箱型
  if(n>=o.boxW+3){const s=n-3-o.boxW,W=b.slice(s,n-3),top=Math.max(...W.map(x=>x.h)),bot=Math.min(...W.map(x=>x.l)),amp=(top-bot)/bot;
    if(amp<=o.boxAmp&&amp>=o.minH/2){const [h3,l3]=piv(W.map(x=>x.h),W.map(x=>x.l),Math.min(3,o.k));
      const th=h3.filter(i=>W[i].h>=top*(1-o.boxTouch)).length,tl=l3.filter(i=>W[i].l<=bot*(1+o.boxTouch)).length;
      if(th>=2&&tl>=2){const ht=top-bot,G={pts:[],ln:[[T[s],top,T[n-1],top,'箱頂'],[T[s],bot,T[n-1],bot,'箱底']]},nt=`箱 ${r2(bot)}–${r2(top)}`,sym=cl((Math.min(th,tl)-1)/2);
        const bu=brk(top,1,n-4),bd=brk(bot,0,n-4);
        if(bu!=null)push('箱型突破',1,top,ht,(top+bot)/2,bu,o.boxW,sym,G,nt);
        else if(bd!=null)push('箱型跌破',-1,bot,ht,(top+bot)/2,bd,o.boxW,sym,G,nt);
        else if(p<=top&&p>=bot)info('箱型整理',0,top,bot,ht,(top+bot)/2,sym,o.boxW,G,nt)}}}
  // 三角（對稱／上升／下降）：用最近兩個高點連線、兩個低點連線
  if(!o.noTri&&ph.length>=2&&pl.length>=2&&Math.min(ph[ph.length-2],pl[pl.length-2])>=n-o.triWin){
    const i1=ph[ph.length-2],i2=ph[ph.length-1],j1=pl[pl.length-2],j2=pl[pl.length-1],h1=H[i1],h2=H[i2],l1=L[j1],l2=L[j2];
    const flatT=Math.abs(h2-h1)/h1<=o.triFlat,flatB=Math.abs(l2-l1)/l1<=o.triFlat,hiDn=h2<h1*(1-o.triFlat),loUp=l2>l1*(1+o.triFlat);
    let kind=null;if(hiDn&&loUp)kind='對稱三角';else if(flatT&&loUp)kind='上升三角';else if(flatB&&hiDn)kind='下降三角';
    const ht=Math.max(h1,h2)-Math.min(l1,l2);
    if(kind&&(h2-l2)<=.7*ht&&ht/h2<=o.triH){const since=Math.max(i2,j2);
      const tf=i=>flatT?Math.max(h1,h2):h1+(h2-h1)*(i-i1)/(i2-i1),bf=i=>flatB?Math.min(l1,l2):l1+(l2-l1)*(i-j1)/(j2-j1);
      const G={pts:[[T[i1],h1,'高1'],[T[i2],h2,'高2'],[T[j1],l1,'低1'],[T[j2],l2,'低2']],ln:[[T[i1],tf(i1),T[n-1],tf(n-1),'壓力線'],[T[j1],bf(j1),T[n-1],bf(n-1),'支撐線']]},nt=`高 ${r2(h1)}→${r2(h2)}、低 ${r2(l1)}→${r2(l2)}`;
      const bu=brk(tf,1,since),bd=brk(bf,0,since),span=since-Math.min(i1,j1),sym=cl(1-(h2-l2)/ht);
      if(bu!=null&&tf(n-1)>bf(n-1)&&(bd==null||bu>bd))push('三角突破',1,tf(bu),ht,l2,bu,span,sym,G,nt+`（${kind}）`);
      else if(bd!=null&&tf(n-1)>bf(n-1))push('三角跌破',-1,bf(bd),ht,h2,bd,span,sym,G,nt+`（${kind}）`);
      else if(p<=tf(n-1)&&p>=bf(n-1))info(kind,0,tf(n-1),bf(n-1),ht,bf(n-1),sym,span,G,nt)}}
  // 旗形：旗桿 ≤poleMax 根漲（跌）≥pole，之後 3–15 根反向整理不超過旗桿一半
  if(!o.noFlag){
    for(const up of[1,0]){for(let t=n-5;t>=n-16&&t>0;t--){
      const rng=[...Array(Math.min(o.poleMax,t)).keys()].map(j=>t-1-j);const s=up?mn(rng,i=>L[i]):mx(rng,i=>H[i]);
      const pole=up?H[t]-L[s]:H[s]-L[t];const ext=up?H[t]===Math.max(...H.slice(s,n-1)):L[t]===Math.min(...L.slice(s,n-1));
      if(!ext||pole/(up?L[s]:H[s])<o.pole)continue;
      const F=b.slice(t+1,n-1);if(F.length<3)continue;const fl=Math.min(...F.map(x=>x.l)),fh=Math.max(...F.map(x=>x.h));
      const retr=up?(H[t]-fl)/pole:(fh-L[t])/pole;if(retr>.5)break;
      const pv=V.slice(s,t+1),fv=F.map(x=>x.v||0),avg=z=>z.reduce((x,y)=>x+y,0)/z.length;if(avg(fv)>=avg(pv)*.8||(fh-fl)>pole*.5)break;
      const nk=up?Math.max(H[t],fh):Math.min(L[t],fl),stop=up?fl:fh;
      const G={pts:[[T[s],up?L[s]:H[s],'旗桿起'],[T[t],up?H[t]:L[t],'旗桿頂']],ln:[[T[t],up?nk:fh,T[n-1],up?nk:fh,'旗上緣'],[T[t],up?fl:nk,T[n-1],up?fl:nk,'旗下緣']]};
      const bi=(up?C[n-1]>nk*(1+o.brk):C[n-1]<nk*(1-o.brk))?n-1:null;
      push(up?'上升旗形':'下降旗形',up?1:-1,nk,pole,stop,bi,t-s+F.length,1-retr,G,`旗桿 ${r2(up?L[s]:H[s])}→${r2(up?H[t]:L[t])}`);break}}}
  // 趨勢（頭頭高底底高）
  if(ph.length>=3&&pl.length>=3){const A=ph.slice(-3),Bq=pl.slice(-3),a=A.map(i=>H[i]),bb=Bq.map(i=>L[i]);
    const pts=[...A.map((i,j)=>[T[i],H[i],j?'頭'+(j+1):'頭1']),...Bq.map((i,j)=>[T[i],L[i],'底'+(j+1)])];
    if(a[0]<a[1]&&a[1]<a[2]&&bb[0]<bb[1]&&bb[1]<bb[2]&&p>bb[2])out.push({n:'多頭趨勢',dir:1,st:'趨勢中',nk:r2(a[2]),tgt:null,stop:r2(bb[2]),ht:null,conf:null,bt:null,pts,ln:[],note:`最近底 ${r2(bb[2])}`});
    else if(a[0]>a[1]&&a[1]>a[2]&&bb[0]>bb[1]&&bb[1]>bb[2]&&p<a[2])out.push({n:'空頭趨勢',dir:-1,st:'趨勢中',nk:r2(bb[2]),tgt:null,stop:r2(a[2]),ht:null,conf:null,bt:null,pts,ln:[],note:`最近頭 ${r2(a[2])}`})}
  out.forEach(q=>{q.ex=EX[q.n]?EX[q.n](q):''});
  const ord={'已突破':0,'已跌破':0,'量不足':1,'成形中':2,'已達標':3,'趨勢中':4,'失敗':5};
  return out.sort((x,y)=>(ord[x.st]-ord[y.st])||((y.conf||0)-(x.conf||0)))}
const api={detect,P,EX};
if(typeof module!=='undefined')module.exports=api;else root.PAT=api;
})(this);
