/* словарь терминов: подсказки в тексте + раздел #glossary. Данные — window.AG1_TERMS (glossary-terms.js) */
(function(){
  var G=window.AG1_TERMS||[];
  var BLOCKS='#overview,#now,#rungel,.article';  // где размечаем термины
  var SKIP='a,h1,h2,h3,h4,figure,figcaption,.refs,.kicker,.a-meta,.a-orig,.a-num,.a-foot,th,summary,.now-src,.brief-label,.term,cite,button,script,style';
  var SHOW_DELAY=120, HIDE_DELAY=160;    // мс: задержки подсказки при наведении мышью
  var EDGE=12, GAP=10, ARROW_MIN=14;     // px: отступ от краёв окна, от термина, крайнее положение стрелки

  var byKey={};
  G.forEach(function(g){byKey[g.k]=g});

  // одна регулярка на все термины: группа g<i> — i-й термин; пробел в шаблоне совпадает и с неразрывным
  function buildTermRegex(){
    var alt=G.map(function(g,i){return '(?<g'+i+'>'+g.p.replace(/ /g,'[ \\u00a0]')+')'});
    try{return new RegExp('(?<![\\p{L}\\p{N}])(?:'+alt.join('|')+')(?![\\p{L}\\p{N}])','giu')}catch(e){return null}
  }

  // размечает первое вхождение каждого термина в блоке
  function markTerms(block,RE){
    var used={}, nodes=[];
    var w=document.createTreeWalker(block,NodeFilter.SHOW_TEXT,{acceptNode:function(n){
      var p=n.parentElement;
      return p&&!p.closest(SKIP)&&p.closest(BLOCKS)===block&&n.data.trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
    }});
    while(w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(function(n){
      var s=n.data, m, last=0, frag=null;
      RE.lastIndex=0;
      while((m=RE.exec(s))){
        var i=0; while(m.groups['g'+i]===undefined) i++;
        var g=G[i];
        if(used[g.k]||(g.c&&m[0]!==m[0].toUpperCase())) continue;
        used[g.k]=1;
        frag=frag||document.createDocumentFragment();
        frag.appendChild(document.createTextNode(s.slice(last,m.index)));
        var el=document.createElement('span');
        el.className='term'; el.dataset.t=g.k; el.tabIndex=0; el.setAttribute('role','button');
        el.textContent=m[0]; frag.appendChild(el);
        last=m.index+m[0].length;
      }
      if(frag){frag.appendChild(document.createTextNode(s.slice(last))); n.parentNode.replaceChild(frag,n)}
    });
  }

  // раздел «Словарь терминов»: по алфавиту, скрыт, пока JS не заполнит
  function renderGlossary(){
    var sec=document.getElementById('glossary'), list=document.getElementById('gl-list');
    if(!sec||!list) return;
    G.slice().sort(function(a,b){return a.t.localeCompare(b.t,'ru')}).forEach(function(g){
      var it=document.createElement('div'); it.className='gl-item'; it.id='g-'+g.k;
      var dt=document.createElement('dt'); dt.textContent=g.t;
      var dd=document.createElement('dd'); dd.textContent=g.d;
      it.appendChild(dt); it.appendChild(dd); list.appendChild(it);
    });
    sec.hidden=false;
  }

  // всплывающая подсказка: наведение мышью, клик/Enter закрепляет, Esc закрывает
  function initTooltip(){
    var tip=document.createElement('div');
    tip.className='tip'; tip.id='term-tip'; tip.setAttribute('role','tooltip'); tip.hidden=true;
    tip.innerHTML='<b class="tip-t"></b><span class="tip-d"></span><a class="tip-a" href="#glossary">Открыть в словаре →</a>';
    document.body.appendChild(tip);
    var tT=tip.querySelector('.tip-t'), tD=tip.querySelector('.tip-d'), tA=tip.querySelector('.tip-a');
    var cur=null, pinned=false, showT=0, hideT=0, raf=0, bar=document.querySelector('.bar');

    // над термином, а если не помещается под шапкой — под ним; стрелка смотрит на центр термина
    function place(){
      if(!cur) return;
      var rs=cur.getClientRects(); if(!rs.length){hide();return}
      var r=rs[0], vw=document.documentElement.clientWidth, top=(bar?bar.offsetHeight:0)+8;
      if(r.bottom<top||r.top>innerHeight){hide();return}
      var w=tip.offsetWidth, h=tip.offsetHeight, cx=r.left+r.width/2;
      var x=Math.max(EDGE,Math.min(cx-w/2,vw-EDGE-w)), y=r.top-h-GAP, below=y<top;
      if(below) y=r.bottom+GAP;
      tip.style.left=x+'px'; tip.style.top=y+'px';
      tip.style.setProperty('--ax',Math.max(ARROW_MIN,Math.min(cx-x,w-ARROW_MIN))+'px');
      tip.classList.toggle('below',below);
    }
    function release(el){el.classList.remove('is-on');el.removeAttribute('aria-describedby')}
    function show(el){
      clearTimeout(hideT); clearTimeout(showT);
      var g=byKey[el.dataset.t]; if(!g) return;
      if(cur&&cur!==el) release(cur);
      cur=el; el.classList.add('is-on'); el.setAttribute('aria-describedby','term-tip');
      tT.textContent=g.t; tD.textContent=g.d; tA.href='#g-'+g.k;
      tip.hidden=false; place();
      requestAnimationFrame(function(){tip.classList.add('on')});
    }
    function hide(){
      clearTimeout(hideT); clearTimeout(showT);
      tip.classList.remove('on'); tip.hidden=true; pinned=false;
      if(cur) release(cur);
      cur=null;
    }
    function later(){clearTimeout(hideT); if(!pinned) hideT=setTimeout(hide,HIDE_DELAY)}
    function toggle(el){ if(cur===el&&pinned) hide(); else {show(el); pinned=true} }
    function termOf(e){return e.target.closest&&e.target.closest('.term')}

    document.addEventListener('pointerover',function(e){
      if(e.pointerType!=='mouse') return;
      var el=termOf(e);
      if(el){ if(pinned&&cur!==el) return; clearTimeout(hideT); if(cur!==el){clearTimeout(showT); showT=setTimeout(function(){show(el)},SHOW_DELAY)} }
      else if(tip.contains(e.target)) clearTimeout(hideT);
    });
    document.addEventListener('pointerout',function(e){
      if(e.pointerType!=='mouse') return;
      var to=e.relatedTarget;
      if(to&&(tip.contains(to)||(to.closest&&to.closest('.term')===cur))) return;
      if(termOf(e)||tip.contains(e.target)){clearTimeout(showT); later()}
    });
    document.addEventListener('click',function(e){
      var el=termOf(e);
      if(el){e.preventDefault(); toggle(el); return}
      if(tip.contains(e.target)){ if(e.target.closest('.tip-a')) setTimeout(hide,0); return }
      if(cur) hide();
    });
    document.addEventListener('keydown',function(e){
      var el=termOf(e);
      if(el&&(e.key==='Enter'||e.key===' ')){e.preventDefault(); toggle(el)}
      else if(e.key==='Escape'&&cur){var c=cur; hide(); c.focus()}
    });
    document.addEventListener('focusin',function(e){var el=termOf(e); if(el&&el.matches(':focus-visible')) show(el)});
    document.addEventListener('focusout',function(e){
      if(termOf(e)&&!pinned&&!(e.relatedTarget&&tip.contains(e.relatedTarget))) hide();
    });
    addEventListener('scroll',function(){ if(cur&&!raf) raf=requestAnimationFrame(function(){raf=0; place()}) },{passive:true});
    addEventListener('resize',function(){ if(cur) hide() });
  }

  // без поддержки lookbehind/\p{L} — выходим молча, словарь остаётся скрытым
  var RE=buildTermRegex();
  if(!RE) return;
  document.querySelectorAll(BLOCKS).forEach(function(b){markTerms(b,RE)});
  renderGlossary();
  initTooltip();
})();
