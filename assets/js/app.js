/* поведение страницы: тема, шапка, прогресс чтения, скроллбар, буквица, счётчик цифр на обложке, появление блоков, боковое оглавление */
(function(){
  var THEME_KEY='ag1-theme';
  var TOP_THRESHOLD=8;          // px прокрутки, до которых шапка прозрачна поверх обложки
  var DROP_CAP_MIN_CHARS=220;   // буквица — только у длинного абзаца
  var DROP_CAP_SEARCH=3;        // ищем такой абзац среди первых трёх
  var REVEAL_STAGGER=70;        // мс между соседями при появлении
  var REVEAL_CLEANUP=1100;      // мс, после которых задержка больше не нужна
  var REVEAL_SELECTOR='.overview>h2,.overview>.ov-lead,.ov-list>li,.now-h,.tbl-wrap,.now>.brief,.sec-title:not([id]),.card,.a-head,.brief,.rg>h2,.rg-lead,.rg-h,.rg-learn>li,.rg-fit>div,.fw,.rg-step,.ladder,.rg-fix>li,.rg-metrics>li';
  var TOC_PAD=24;               // px запаса до края бокового оглавления
  var COUNT_DELAY=1000;         // мс: счётчик на обложке стартует, когда таймлайн уже проявился
  var COUNT_DURATION=1300;      // мс докрутки чисел таймлайна
  var SB_DARK_SELECTOR='.hero,.rg,.foot'; // тёмные блоки: если доходят до правого края, ползунок над ними лаймовый

  var root=document.documentElement, topbar=document.querySelector('.bar');

  function initTheme(){
    var btn=document.getElementById('theme');
    function get(){try{return localStorage.getItem(THEME_KEY)}catch(e){return null}}
    function set(v){try{localStorage.setItem(THEME_KEY,v)}catch(e){}}
    function isDark(){var t=root.getAttribute('data-theme');return t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches}
    function label(){btn.textContent=isDark()?'☀ Светлая':'☾ Тёмная'}
    var saved=get(); if(saved) root.setAttribute('data-theme',saved);
    label();
    btn.addEventListener('click',function(){var v=isDark()?'light':'dark';root.setAttribute('data-theme',v);set(v);label()});
  }

  // прозрачная шапка на обложке + её высота в --bar-h (обложка заходит под шапку)
  function initTopBar(){
    function barTop(){topbar.classList.toggle('top',scrollY<TOP_THRESHOLD)}
    function barH(){root.style.setProperty('--bar-h',topbar.offsetHeight+'px')}
    barTop(); addEventListener('scroll',barTop,{passive:true});
    barH(); if('ResizeObserver' in window) new ResizeObserver(barH).observe(topbar); else addEventListener('resize',barH);
  }

  function initProgress(){
    var bar=document.getElementById('progress');
    addEventListener('scroll',function(){bar.style.width=(root.scrollTop/(root.scrollHeight-root.clientHeight)*100)+'%'},{passive:true});
  }

  // свой ползунок поверх страницы вместо системного скроллбара (см. style.css)
  function initScrollbar(){
    if(matchMedia('(pointer: coarse)').matches) return;
    var sb=document.createElement('div'), thumb=document.createElement('div');
    sb.className='sb'; sb.setAttribute('aria-hidden','true'); thumb.className='sb-thumb'; sb.appendChild(thumb);
    document.body.appendChild(sb);
    var darks=document.querySelectorAll(SB_DARK_SELECTOR), h=0, max=0, dragY=null, dragTop=0, raf=0;
    function range(){return innerHeight-h}
    function update(){
      raf=0;
      max=root.scrollHeight-innerHeight;
      if(max<=0){sb.hidden=true;return}
      sb.hidden=false;
      h=Math.max(40,innerHeight*innerHeight/root.scrollHeight);
      var top=root.scrollTop/max*range(), mid=top+h/2, dark=false;
      thumb.style.height=h+'px'; thumb.style.transform='translateY('+top+'px)';
      for(var i=0;i<darks.length;i++){var r=darks[i].getBoundingClientRect();if(r.top<=mid&&r.bottom>=mid&&r.right>=innerWidth-1){dark=true;break}}
      sb.classList.toggle('on-dark',dark);
    }
    function schedule(){if(!raf) raf=requestAnimationFrame(update)}
    function jump(y){window.scrollTo({top:Math.max(0,Math.min(max,y)),behavior:'instant'})}
    thumb.addEventListener('pointerdown',function(e){
      e.preventDefault(); e.stopPropagation();
      dragY=e.clientY; dragTop=root.scrollTop; thumb.setPointerCapture(e.pointerId);
      sb.classList.add('drag'); root.classList.add('sb-dragging');
    });
    thumb.addEventListener('pointermove',function(e){if(dragY!==null) jump(dragTop+(e.clientY-dragY)*max/range())});
    function endDrag(){dragY=null; sb.classList.remove('drag'); root.classList.remove('sb-dragging')}
    thumb.addEventListener('pointerup',endDrag); thumb.addEventListener('pointercancel',endDrag);
    // клик по дорожке — прыжок к этому месту
    sb.addEventListener('pointerdown',function(e){if(e.target===sb) jump((e.clientY-h/2)/range()*max)});
    addEventListener('scroll',schedule,{passive:true}); addEventListener('resize',schedule);
    if('ResizeObserver' in window) new ResizeObserver(schedule).observe(document.body);
    update();
  }

  function initDropCaps(){
    document.querySelectorAll('.prose').forEach(function(pr){
      var ps=pr.querySelectorAll(':scope>p');
      for(var i=0;i<Math.min(ps.length,DROP_CAP_SEARCH);i++){if(ps[i].textContent.trim().length>DROP_CAP_MIN_CHARS){ps[i].classList.add('dc');break}}
    });
  }

  function initReveal(){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var rv=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){
      var t=e.target; t.classList.add('in'); rv.unobserve(t);
      setTimeout(function(){t.style.transitionDelay=''},REVEAL_CLEANUP);
    }})},{rootMargin:'0px 0px -8% 0px'});
    document.querySelectorAll(REVEAL_SELECTOR).forEach(function(el){
      var sib=el.parentNode?Array.prototype.indexOf.call(el.parentNode.children,el):0;
      el.classList.add('reveal'); el.style.transitionDelay=(sib%4)*REVEAL_STAGGER+'ms'; rv.observe(el);
    });
  }

  // активный пункт всегда виден в боковом оглавлении
  function keepTocItemVisible(on){
    var side=on&&on.closest('.side');
    if(!side||side.scrollHeight<=side.clientHeight) return;
    var st=side.scrollTop, top=on.getBoundingClientRect().top-side.getBoundingClientRect().top+st;
    if(top<st+TOC_PAD||top+on.offsetHeight>st+side.clientHeight-TOC_PAD) side.scrollTo({top:Math.max(0,top-side.clientHeight/2+on.offsetHeight/2),behavior:'smooth'});
  }

  function initTocSpy(){
    var links={}; document.querySelectorAll('#toc a').forEach(function(a){links[a.dataset.id]=a});
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){
      Object.keys(links).forEach(function(k){links[k].classList.toggle('on',k===e.target.id)});
      keepTocItemVisible(links[e.target.id]);
    }})},{rootMargin:'-40% 0px -55% 0px'});
    document.querySelectorAll('.article,#now,#rungel,#glossary').forEach(function(a){io.observe(a)});
  }

  // «AG1 в цифрах»: числа таймлайна докручиваются до своих значений; в разметке уже финальное значение
  function initCountUp(){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var els=document.querySelectorAll('.tl-v[data-to]');
    function fmt(el,v){
      var dec=+(el.dataset.dec||0), n=v.toFixed(dec).split('.');
      n[0]=n[0].replace(/\B(?=(\d{3})+(?!\d))/g,' '); // узкий неразрывный пробел между тысячами
      el.textContent=(el.dataset.pre||'')+n.join(',')+(el.dataset.suf||'');
    }
    els.forEach(function(el){fmt(el,+el.dataset.from)});
    setTimeout(function(){
      var t0=performance.now();
      (function tick(t){
        var k=Math.min(1,(t-t0)/COUNT_DURATION), e=1-Math.pow(1-k,3);
        els.forEach(function(el){var a=+el.dataset.from,b=+el.dataset.to;fmt(el,a+(b-a)*e)});
        if(k<1) requestAnimationFrame(tick);
      })(t0);
    },COUNT_DELAY);
  }

  initTheme();
  initTopBar();
  initProgress();
  initScrollbar();
  initDropCaps();
  initCountUp();
  if('IntersectionObserver' in window){
    initReveal();
    initTocSpy();
  }
})();
