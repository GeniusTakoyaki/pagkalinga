(function () {
  "use strict";
  document.documentElement.classList.remove("no-js");
  var NS = "http://www.w3.org/2000/svg";
  var geo = window.PH_GEO, PLAN = window.PLAN;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function mk(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function peso(m) { return "₱" + Math.round(m).toLocaleString("en-US") + "M"; }
  function countTo(node, from, to, f, dur) {
    f = f || function (n) { return String(Math.round(n)); };
    if (reduce || from === to) { node.textContent = f(to); return; }
    var t0 = performance.now(); dur = dur || 800;
    (function step(now) {
      var t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
      node.textContent = f(from + (to - from) * e);
      if (t < 1) requestAnimationFrame(step); else node.textContent = f(to);
    })(t0);
  }

  // ---------- projection (Web Mercator) ----------
  var D2R = Math.PI / 180;
  function mercY(lat) { return Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2)); }
  function polysOf(g) { return g.type === "Polygon" ? [g.coordinates] : g.coordinates; }
  var minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  geo.features.forEach(function (f) {
    polysOf(f.geometry).forEach(function (poly) {
      poly[0].forEach(function (p) {
        if (p[0] < minLon) minLon = p[0]; if (p[0] > maxLon) maxLon = p[0];
        if (p[1] < minLat) minLat = p[1]; if (p[1] > maxLat) maxLat = p[1];
      });
    });
  });
  var S = 90, topY = mercY(maxLat);
  function px(lon) { return (lon - minLon) * S; }
  function py(lat) { return ((topY - mercY(lat)) / D2R) * S; }
  var FULL = { minX: 0, minY: 0, maxX: px(maxLon), maxY: py(minLat) };
  var spanX = FULL.maxX, spanY = FULL.maxY;

  function ringPath(ring) {
    var d = "";
    for (var i = 0; i < ring.length; i++) d += (i ? "L" : "M") + px(ring[i][0]).toFixed(1) + " " + py(ring[i][1]).toFixed(1);
    return d + "Z";
  }
  function polysPath(polys) {
    var d = "";
    polys.forEach(function (poly) { poly.forEach(function (ring) { d += ringPath(ring); }); });
    return d;
  }
  function polysBounds(polys) {
    var b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    polys.forEach(function (poly) {
      poly[0].forEach(function (p) {
        var x = px(p[0]), y = py(p[1]);
        if (x < b.minX) b.minX = x; if (x > b.maxX) b.maxX = x;
        if (y < b.minY) b.minY = y; if (y > b.maxY) b.maxY = y;
      });
    });
    return b;
  }
  // area-weighted centroid (in lon/lat) of the largest polygon – used to place region-level markers
  function centroidLonLat(polys) {
    var best = null, bestArea = -1;
    polys.forEach(function (poly) {
      var ring = poly[0], a = 0, cx = 0, cy = 0;
      for (var i = 0; i < ring.length; i++) {
        var p = ring[i], q = ring[(i + 1) % ring.length];
        var c = p[0] * q[1] - q[0] * p[1];
        a += c; cx += (p[0] + q[0]) * c; cy += (p[1] + q[1]) * c;
      }
      if (a !== 0 && Math.abs(a) > bestArea) { bestArea = Math.abs(a); best = [cx / (3 * a), cy / (3 * a)]; }
    });
    return best;
  }
  function labelPoint(polys) {
    var best = null, bestArea = -1;
    polys.forEach(function (poly) {
      var ring = poly[0], a = 0, cx = 0, cy = 0;
      for (var i = 0; i < ring.length; i++) {
        var p = ring[i], q = ring[(i + 1) % ring.length];
        var x0 = px(p[0]), y0 = py(p[1]), x1 = px(q[0]), y1 = py(q[1]);
        var c = x0 * y1 - x1 * y0;
        a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
      }
      var area = Math.abs(a / 2);
      if (area > bestArea && a !== 0) { bestArea = area; best = [cx / (3 * a), cy / (3 * a)]; }
    });
    return best ? { x: best[0], y: best[1], area: bestArea } : null;
  }

  var DATA = {}, CENTROID = {};
  geo.features.forEach(function (f) {
    var id = f.properties.id;
    if (!PLAN.regions[id]) return;
    var polys = polysOf(f.geometry);
    DATA[id] = {
      d: polysPath(polys),
      bounds: polysBounds(polys),
      provs: (f.properties.provinces || []).map(function (pv) { return { name: pv.n, d: polysPath(pv.g), pt: labelPoint(pv.g) }; })
    };
    CENTROID[id] = centroidLonLat(polys);
  });
  var ORDER = Object.keys(DATA).sort(function (a, b) {
    return (DATA[a].bounds.minY + DATA[a].bounds.maxY) - (DATA[b].bounds.minY + DATA[b].bounds.maxY);
  });

  // =====================================================================
  //  MapView – reusable map (hero, pillars, roadmap)
  // =====================================================================
  var uid = 0;
  function MapView(svg, o) {
    o = o || {};
    var n = ++uid, self = {}, regs = {}, markers = [], vb = { x: 0, y: 0, w: 1, h: 1 }, anim = 0, current = null, labelEls = [];
    var box = o.box || svg.parentNode, tip = o.tip || null, interactive = o.interactive !== false;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.setProperty("--lift", "url(#lift" + n + ") brightness(1.08)");

    var defs = mk("defs");
    var filt = mk("filter", { id: "lift" + n, x: "-10%", y: "-10%", width: "120%", height: "120%" });
    filt.appendChild(mk("feDropShadow", { dx: 0, dy: 2, stdDeviation: 3, "flood-color": "#000", "flood-opacity": 0.3 }));
    defs.appendChild(filt);
    svg.appendChild(defs);

    if (o.sea !== false) {
      var grad = mk("linearGradient", { id: "sea" + n, gradientUnits: "userSpaceOnUse", x1: 0, y1: -spanY, x2: 0, y2: spanY * 2 });
      grad.appendChild(mk("stop", { offset: 0, "class": "sea-a" }));
      grad.appendChild(mk("stop", { offset: 1, "class": "sea-b" }));
      defs.appendChild(grad);
      svg.appendChild(mk("rect", { x: -spanX * 3, y: -spanY * 3, width: spanX * 7, height: spanY * 7, fill: "url(#sea" + n + ")" }));
      var gd = "", i;
      for (i = 108; i <= 134; i += 2) gd += "M" + px(i).toFixed(1) + " " + py(30) + "L" + px(i).toFixed(1) + " " + py(-5);
      for (i = -4; i <= 28; i += 2) gd += "M" + px(100) + " " + py(i).toFixed(1) + "L" + px(145) + " " + py(i).toFixed(1);
      var grat = mk("g", { "class": "grat" });
      grat.appendChild(mk("path", { d: gd }));
      svg.appendChild(grat);
      if (o.seaLabels !== false) {
        var sl = mk("g", { "class": "sea-labels" });
        [[["West", "Philippine", "Sea"], 117.1, 15.6, "start"], [["Philippine Sea"], 126.0, 14.2], [["Sulu Sea"], 120.2, 8.6],
         [["Celebes Sea"], 123.6, 5.2], [["Luzon Strait"], 121.4, 20.6]].forEach(function (s) {
          var t = mk("text", { x: px(s[1]).toFixed(1), y: py(s[2]).toFixed(1), "font-size": 28 });
          if (s[3]) t.style.textAnchor = s[3];
          s[0].forEach(function (line, k) {
            var ts = mk("tspan", { x: px(s[1]).toFixed(1) });
            if (k) ts.setAttribute("dy", "1.25em");
            ts.textContent = line;
            t.appendChild(ts);
          });
          sl.appendChild(t);
        });
        svg.appendChild(sl);
      }
    }

    var gReg = mk("g"), selOutline = mk("path", { "class": "sel-outline", fill: "none" });
    var gLab = mk("g", { "class": "plabels" }), gMark = mk("g", { "class": "markers" });
    svg.appendChild(gReg); svg.appendChild(selOutline); svg.appendChild(gLab); svg.appendChild(gMark);

    ORDER.forEach(function (id, idx) {
      var D = DATA[id], r = PLAN.regions[id];
      var g = mk("g", { "class": "region", "data-id": id, role: "button", "aria-label": r.name, tabindex: interactive ? "0" : "-1" });
      g.style.setProperty("--i", idx);
      g.appendChild(mk("path", { "class": "shape", d: D.d }));
      if (o.provinces) {
        var pg = mk("g", { "class": "provs" });
        D.provs.forEach(function (p) {
          var pp = mk("path", { "class": "prov", d: p.d });
          pp.setAttribute("data-name", p.name);
          pg.appendChild(pp);
        });
        g.appendChild(pg);
      }
      if (interactive) {
        g.addEventListener("click", function () { if (o.onClick && current !== id) o.onClick(id); });
        g.addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && o.onClick) { e.preventDefault(); o.onClick(id); } });
        g.addEventListener("mousemove", function (e) {
          if (!tip) return;
          var t = e.target, prov = o.provinces && current === id && t.classList && t.classList.contains("prov");
          showTip(e, o.tipFn ? o.tipFn(id, prov ? t.getAttribute("data-name") : null) : [r.name]);
        });
        g.addEventListener("mouseleave", function () { if (tip) tip.hidden = true; });
      }
      gReg.appendChild(g);
      regs[id] = { g: g };
    });
    if (interactive && o.onBackground) {
      svg.addEventListener("click", function (e) { if (!e.target.closest(".region") && !e.target.closest(".marker")) o.onBackground(); });
    }

    function showTip(e, txt) {
      var r = box.getBoundingClientRect();
      tip.textContent = txt[0];
      if (txt[1]) { var s = document.createElement("small"); s.textContent = txt[1]; tip.appendChild(s); }
      tip.hidden = false;
      var x = e.clientX - r.left + 16, y = e.clientY - r.top + 18;
      x = Math.min(x, box.offsetWidth - tip.offsetWidth - 8);
      tip.style.left = Math.max(8, x) + "px";
      tip.style.top = Math.min(y, box.offsetHeight - tip.offsetHeight - 8) + "px";
    }

    // ----- markers (constant on-screen size at any zoom) -----
    self.addMarker = function (s) {
      var g = mk("g", { "class": "marker " + (s.cls || "") });
      var inner = mk("g", { "class": "mi" });
      g.appendChild(inner);
      if (s.kind === "fac") inner.appendChild(mk("rect", { "class": "fac-sq", x: -7, y: -7, width: 14, height: 14, rx: 3 }));
      else if (s.kind === "ctr") { inner.appendChild(mk("circle", { "class": "pulse", r: 9 })); inner.appendChild(mk("circle", { "class": "ctr-dot", r: 6.5 })); }
      else if (s.kind === "ring") inner.appendChild(mk("circle", { "class": "ring", r: 17 }));
      if (s.label) {
        var left = s.side === "left";
        var t = mk("text", { x: left ? -13 : 13, y: 4.5 });
        t.style.textAnchor = left ? "end" : "start";
        t.textContent = s.label;
        inner.appendChild(t);
      }
      if (interactive) {
        g.addEventListener("click", function () { if (o.onClick && s.region && current !== s.region) o.onClick(s.region); });
        g.addEventListener("mousemove", function (e) { if (tip && s.tip) showTip(e, s.tip); });
        g.addEventListener("mouseleave", function () { if (tip) tip.hidden = true; });
      }
      gMark.appendChild(g);
      markers.push({ g: g, x: px(s.lon), y: py(s.lat) });
      sizeMarkers();
      return g;
    };
    function sizeMarkers() {
      var k = vb.w / (svg.clientWidth || 760);
      markers.forEach(function (m) { m.g.setAttribute("transform", "translate(" + m.x.toFixed(1) + " " + m.y.toFixed(1) + ") scale(" + k.toFixed(4) + ")"); });
    }

    // ----- camera -----
    function fit(b, pad, minW) {
      var W = svg.clientWidth || 600, Hh = svg.clientHeight || 700, ar = W / Hh;
      var extra = (b.maxY - b.minY) * (o.bottomPad || 0);
      b = { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY + extra };
      var bw = b.maxX - b.minX, bh = b.maxY - b.minY;
      var w = Math.max(bw * pad, bh * pad * ar, minW || 0), h = w / ar;
      return { x: (b.minX + b.maxX) / 2 - w / 2, y: (b.minY + b.maxY) / 2 - h / 2, w: w, h: h };
    }
    function fullView() { return fit(FULL, 1.05, 0); }
    function regionView(id) { return fit(DATA[id].bounds, 1.45, fullView().w * 0.06); }
    function setVB(v) {
      vb = v;
      svg.setAttribute("viewBox", v.x.toFixed(2) + " " + v.y.toFixed(2) + " " + v.w.toFixed(2) + " " + v.h.toFixed(2));
      sizeMarkers(); sizeLabels();
    }
    function sizeLabels() {
      if (!labelEls.length) return;
      var fs = (13 * vb.w) / (svg.clientWidth || 600);
      labelEls.forEach(function (t) { t.setAttribute("font-size", fs.toFixed(3)); t.setAttribute("stroke-width", (fs * 0.22).toFixed(3)); });
    }
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function animateTo(target, instant, done) {
      cancelAnimationFrame(anim);
      if (instant || reduce) { setVB(target); if (done) done(); return; }
      var from = { x: vb.x, y: vb.y, w: vb.w, h: vb.h };
      var fcx = from.x + from.w / 2, fcy = from.y + from.h / 2, tcx = target.x + target.w / 2, tcy = target.y + target.h / 2;
      var ratio = target.w / from.w;
      var dist = Math.abs(Math.log(ratio)) + Math.hypot(tcx - fcx, tcy - fcy) / from.w;
      var dur = Math.min(1300, 650 + dist * 380), t0 = performance.now();
      (function frame(now) {
        var t = Math.min(1, (now - t0) / dur), e = ease(t);
        var w = from.w * Math.pow(ratio, e), h = w * (target.h / target.w);
        setVB({ x: fcx + (tcx - fcx) * e - w / 2, y: fcy + (tcy - fcy) * e - h / 2, w: w, h: h });
        if (t < 1) anim = requestAnimationFrame(frame); else { setVB(target); if (done) done(); }
      })(t0);
    }

    // ----- province labels -----
    function clearLabels() {
      gLab.classList.remove("show"); labelEls = [];
      while (gLab.firstChild) gLab.removeChild(gLab.firstChild);
    }
    function buildLabels(id) {
      clearLabels();
      if (!o.provinces) return;
      DATA[id].provs.filter(function (p) { return p.pt; }).sort(function (a, b) { return b.pt.area - a.pt.area; }).forEach(function (p) {
        var t = mk("text", { x: p.pt.x.toFixed(1), y: p.pt.y.toFixed(1) });
        t.textContent = p.name; gLab.appendChild(t); labelEls.push(t);
      });
      sizeLabels();
    }
    function placeLabels() {
      var kept = [];
      labelEls.forEach(function (t) {
        t.style.display = "";
        var r = t.getBoundingClientRect();
        var hit = kept.some(function (k) { return !(r.right + 3 < k.left || r.left - 3 > k.right || r.bottom + 2 < k.top || r.top - 2 > k.bottom); });
        if (hit) t.style.display = "none"; else kept.push(r);
      });
      gLab.classList.add("show");
    }

    // ----- public API -----
    self.select = function (id, instant) {
      clearLabels();
      Object.keys(regs).forEach(function (k) { regs[k].g.classList.toggle("selected", k === id); });
      svg.classList.toggle("zoomed", !!id);
      if (!id) { current = null; selOutline.classList.remove("on"); animateTo(fullView(), instant); return; }
      current = id;
      selOutline.setAttribute("d", DATA[id].d);
      selOutline.classList.remove("on");
      void selOutline.getBoundingClientRect();
      selOutline.classList.add("on");
      buildLabels(id);
      animateTo(regionView(id), instant, placeLabels);
    };
    self.current = function () { return current; };
    self.setState = function (fn) { Object.keys(regs).forEach(function (k) { regs[k].g.setAttribute("data-st", fn(k) || ""); }); };
    self.refit = function () { cancelAnimationFrame(anim); setVB(current ? regionView(current) : fullView()); if (current) placeLabels(); };
    self.svg = svg;
    setVB(fullView());
    if (window.ResizeObserver) {
      var rt = 0;
      new ResizeObserver(function () { clearTimeout(rt); rt = setTimeout(self.refit, 80); }).observe(svg);
    }
    return self;
  }

  // =====================================================================
  //  Derived data
  // =====================================================================
  var Y = PLAN.years.slice().sort(function (a, b) { return a.year - b.year; });
  var est = {};                                   // region id -> year its Center for PPUSQS is established
  Y.forEach(function (e) { (e.centers || []).forEach(function (id) { est[id] = e.year; }); });
  var ALL_CENTERS = Object.keys(est).length;
  var TOTAL_REGIONS = Object.keys(PLAN.regions).length;
  var FAC = {};
  PLAN.facilities.forEach(function (f) { FAC[f.id] = f; });
  function centerName(id) { return PLAN.regions[id].code + " Center for PPUSQS"; }
  function centersBy(year) { return Object.keys(est).filter(function (id) { return est[id] <= year; }).length; }

  // roving-tabindex tab list helper (arrow keys)
  function tabList(container, buttons, onSelect) {
    container.addEventListener("keydown", function (e) {
      var i = buttons.indexOf(document.activeElement);
      if (i < 0) return;
      var d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var j = (i + d + buttons.length) % buttons.length;
      buttons[j].focus(); onSelect(j);
    });
  }

  // =====================================================================
  //  Nav, reveal on scroll
  // =====================================================================
  var nav = $("nav");
  function onScroll() { nav.classList.toggle("solid", window.scrollY > 40); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  if ("IntersectionObserver" in window) {
    var revObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); revObs.unobserve(en.target); } });
    }, { threshold: 0.08 });
    Array.prototype.forEach.call(document.querySelectorAll(".reveal"), function (n) { revObs.observe(n); });
    var links = Array.prototype.slice.call(document.querySelectorAll(".links a"));
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle("on", a.dataset.s === en.target.id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    ["issues", "pillars", "roadmap"].forEach(function (id) { spy.observe($(id)); });
  } else {
    Array.prototype.forEach.call(document.querySelectorAll(".reveal"), function (n) { n.classList.add("in"); });
  }

  // =====================================================================
  //  Hero
  // =====================================================================
  $("heroTitle").textContent = PLAN.title;
  $("footSource").textContent = PLAN.source;
  (function hero() {
    var map = MapView($("heroMap"), { sea: false, interactive: false });
    var order = 0;
    Y.forEach(function (e, yi) {
      (e.centers || []).forEach(function (id) {
        var c = CENTROID[id];
        var g = map.addMarker({ kind: "ctr", cls: "hero on", lon: c[0], lat: c[1] });
        g.style.setProperty("--hd", (order * 0.35).toFixed(2) + "s");
        order++;
      });
    });
    var facts = $("heroFacts");
    [[PLAN.pillars.length, "Pillars"], [Y.length, "Years, " + Y[0].year + "–" + Y[Y.length - 1].year],
     [ALL_CENTERS, "Regional centers by " + Y[Y.length - 1].year], [PLAN.facilities.length, "Main facilities"]].forEach(function (f) {
      var d = el("div"); d.appendChild(el("dt", null, String(f[0]))); d.appendChild(el("dd", null, f[1])); facts.appendChild(d);
    });
  })();

  // =====================================================================
  //  Issues
  // =====================================================================
  (function issues() {
    var COLORS = ["#6a6490", "#b9873f", "#6f8c6b", "#4f8793"];
    $("issuesTitle").textContent = PLAN.issuesTitle;
    $("issuesSub").textContent = PLAN.issuesSubtitle;
    var list = $("issueList"), detail = $("issueDetail"), btns = [];
    function show(i) {
      var it = PLAN.issues[i];
      btns.forEach(function (b, k) { b.setAttribute("aria-selected", String(k === i)); b.tabIndex = k === i ? 0 : -1; });
      detail.style.setProperty("--ic", COLORS[i % COLORS.length]);
      detail.setAttribute("data-n", it.n);
      detail.textContent = "";
      var c = el("div", "in");
      c.appendChild(el("h3", null, it.title));
      if (it.text) c.appendChild(el("p", null, it.text));
      if (it.tags && it.tags.length) {
        var tg = el("div", "tags");
        it.tags.forEach(function (t, k) { var s = el("span", null, t); s.style.setProperty("--i", k); tg.appendChild(s); });
        c.appendChild(tg);
      }
      detail.appendChild(c);
    }
    PLAN.issues.forEach(function (it, i) {
      var b = el("button"); b.type = "button"; b.setAttribute("role", "tab");
      b.style.setProperty("--ic", COLORS[i % COLORS.length]);
      b.appendChild(el("span", "num", String(it.n)));
      b.appendChild(el("span", null, it.title));
      b.addEventListener("click", function () { show(i); });
      list.appendChild(b); btns.push(b);
    });
    tabList(list, btns, show);
    show(0);
  })();

  // =====================================================================
  //  Pillars
  // =====================================================================
  (function pillars() {
    var COLORS = ["#6a6490", "#b9873f", "#4f8793", "#6f8c6b", "#8a7580"];
    var tabs = $("pillarTabs"), detail = $("pillarDetail"), note = $("pillarNote"), btns = [];
    var box = document.querySelector(".pillar-map .mini");
    var map = MapView($("pillarMap"), { interactive: false, seaLabels: false });
    function show(i) {
      var p = PLAN.pillars[i], color = COLORS[i % COLORS.length];
      btns.forEach(function (b, k) { b.setAttribute("aria-selected", String(k === i)); b.tabIndex = k === i ? 0 : -1; });
      detail.style.setProperty("--pc", color);
      box.style.setProperty("--pc", color);
      $("pillarMap").style.setProperty("--pc", color);
      detail.textContent = "";
      var c = el("div", "in");
      c.appendChild(el("div", "pn", "Pillar " + p.n));
      c.appendChild(el("h3", null, p.title));
      if (p.text) c.appendChild(el("p", null, p.text));
      var tg = el("div", "tags"); tg.style.setProperty("--ic", color);
      p.tags.forEach(function (t, k) { var s = el("span", null, t); s.style.setProperty("--i", k); tg.appendChild(s); });
      c.appendChild(tg);
      detail.appendChild(c);
      var set = p.regions === "all" ? null : (p.regions || []);
      map.setState(function (id) { return p.regions === "all" ? "hl" : (set.indexOf(id) >= 0 ? "hl" : "dim"); });
      note.textContent = p.mapNote || "The plan does not specify regions for this pillar.";
    }
    PLAN.pillars.forEach(function (p, i) {
      var b = el("button"); b.type = "button"; b.setAttribute("role", "tab");
      b.style.setProperty("--pc", COLORS[i % COLORS.length]);
      b.appendChild(el("span", "circle", String(p.n)));
      b.appendChild(el("span", "t", p.title));
      b.addEventListener("click", function () { show(i); });
      tabs.appendChild(b); btns.push(b);
    });
    tabList(tabs, btns, show);
    show(0);
  })();

  // =====================================================================
  //  Roadmap (the year mechanic)
  // =====================================================================
  (function roadmap() {
    var yearIdx = 0, selected = null, playing = false, timer = 0;
    var box = $("rmBox"), tip = $("rmTip");
    var lastVals = { cum: 0, nw: 0, third: 0 };

    var map = MapView($("rmMap"), {
      box: box, tip: tip, provinces: true, bottomPad: 0.1,
      onClick: function (id) { stopPlay(); selectRegion(id); },
      onBackground: function () { if (selected) clearRegion(); },
      tipFn: function (id, prov) {
        if (prov) return [prov, PLAN.regions[id].name];
        var yr = Y[yearIdx].year, e = est[id];
        var s = e == null ? "No center in plan" : e > yr ? "Center planned " + e : e === yr ? "New center this year" : "Center since " + e;
        return [PLAN.regions[id].name, s];
      }
    });

    // markers: main facilities (always on), 16 centers, project rings, capacitation rings
    var facMarkers = PLAN.facilities.map(function (f) {
      var g = map.addMarker({ kind: "fac", cls: "on", lon: f.lon, lat: f.lat, label: f.name, side: f.side, region: f.region, tip: [f.name, f.place] });
      return g;
    });
    var centerMarkers = Object.keys(est).map(function (id) {
      var c = CENTROID[id];
      var g = map.addMarker({ kind: "ctr", lon: c[0], lat: c[1], region: id, tip: [centerName(id), "since " + est[id]] });
      return { id: id, g: g };
    });
    var ringMarkers = [];
    Y.forEach(function (e) {
      (e.projects || []).forEach(function (p) {
        var g = map.addMarker({ kind: "ring", cls: p.type, lon: p.lon, lat: p.lat, region: p.region, tip: [p.place, p.name.replace(/^(Construction of|Modernization and Upgrading of|Extension of) /, "") + " · " + peso(p.cost)] });
        ringMarkers.push({ year: e.year, g: g });
      });
      (e.capacitation || []).forEach(function (fid) {
        var f = FAC[fid];
        var g = map.addMarker({ kind: "ring", cls: "capacitation", lon: f.lon, lat: f.lat, region: f.region, tip: [f.name + " – capacitation", f.place] });
        ringMarkers.push({ year: e.year, g: g });
      });
    });

    // ----- scrubber -----
    var track = $("track"), trackBtns = [];
    track.style.setProperty("--n", Y.length);
    Y.forEach(function (e, i) {
      var b = el("button"); b.type = "button"; b.setAttribute("role", "tab");
      b.appendChild(el("span", "dot"));
      b.appendChild(el("span", "yr", String(e.year)));
      b.appendChild(el("span", "cap", e.centers && e.centers.length && !e.funding ? "+" + e.centers.length + " centers" : e.label));
      b.addEventListener("click", function () { stopPlay(); setYear(i); });
      track.appendChild(b); trackBtns.push(b);
    });
    tabList(track, trackBtns, function (i) { stopPlay(); setYear(i); });

    // ----- play -----
    function setPlayUI() { $("playIcon").textContent = playing ? "❚❚" : "▶"; $("playText").textContent = playing ? "Pause" : "Play"; $("play").setAttribute("aria-label", playing ? "Pause the timeline" : "Play the timeline"); }
    function stopPlay() { playing = false; clearInterval(timer); setPlayUI(); }
    function startPlay() {
      if (yearIdx >= Y.length - 1) setYear(0);
      playing = true; setPlayUI();
      timer = setInterval(function () {
        if (yearIdx < Y.length - 1) setYear(yearIdx + 1);
        if (yearIdx >= Y.length - 1) stopPlay();
      }, 4200);
    }
    $("play").addEventListener("click", function () { if (playing) stopPlay(); else startPlay(); });

    // ----- legend -----
    function renderLegend(E) {
      var lg = $("rmLegend"); lg.textContent = "";
      function item(swClass, text, rc) { var d = el("span", "li"); var s = el("span", "sw " + swClass); if (rc) s.style.setProperty("--rc", rc); d.appendChild(s); d.appendChild(document.createTextNode(text)); lg.appendChild(d); }
      item("have", "Center in operation"); item("new", "New center this year"); item("none", "No center yet");
      item("fac", "Main facility"); item("ctr", "Center (region level)");
      var types = {};
      (E.projects || []).forEach(function (p) { types[p.type] = true; });
      if (types.construction) item("ring", "New construction", "var(--construction)");
      if (types.upgrading) item("ring", "Upgrading / extension", "var(--upgrading)");
      if (E.capacitation) item("ring", "Capacitation", "var(--capacitation)");
    }

    // ----- year panel -----
    function kpi(label, small) {
      var d = el("div"), b = el("b", null, "0"); d.appendChild(b); d.appendChild(el("span", null, label));
      if (small) d.appendChild(el("small", null, small));
      return { d: d, b: b };
    }
    function listItem(i, name, place, kindClass, kindText, cost, maxCost, region) {
      var li = el("li"); li.style.setProperty("--i", i); li.tabIndex = 0;
      var top = el("div", "top"); top.appendChild(el("strong", null, name));
      if (cost != null) top.appendChild(el("span", "cost", peso(cost)));
      li.appendChild(top);
      var pl = el("div", "place"); pl.appendChild(el("span", "kind " + kindClass, kindText)); pl.appendChild(el("span", null, place)); li.appendChild(pl);
      if (cost != null) {
        var bar = el("div", "cbar"), fill = el("i"); fill.style.setProperty("--w", (cost / maxCost) * 100 + "%"); fill.style.setProperty("--i", i);
        fill.style.setProperty("--rc", kindClass === "construction" ? "var(--construction)" : "var(--upgrading)");
        bar.appendChild(fill); li.appendChild(bar);
      }
      function go() { stopPlay(); selectRegion(region); }
      li.addEventListener("click", go);
      li.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
      return li;
    }
    function chip(id, cls, i) {
      var b = el("button", cls, PLAN.regions[id].name); b.type = "button"; b.style.setProperty("--i", i);
      b.addEventListener("click", function () { stopPlay(); selectRegion(id); });
      return b;
    }
    function renderYear(E, animate) {
      var yc = $("yContent"); yc.textContent = "";
      var c = el("div", "yc");
      var yh = el("div", "yh"); yh.appendChild(el("div", "yr", String(E.year))); yh.appendChild(el("h3", null, E.kind)); c.appendChild(yh);

      var cum = centersBy(E.year), nw = (E.centers || []).length, kp = el("div", "kp");
      var k1 = kpi("Centers for PPUSQS in operation", "of " + ALL_CENTERS + " by " + Y[Y.length - 1].year);
      var k2 = kpi("New centers this year");
      var third, thirdVal, thirdFmt = null;
      if (E.funding) { third = kpi(E.funding.source, "Funding source"); thirdVal = E.funding.amount; thirdFmt = peso; }
      else { third = kpi("Regions without a center"); thirdVal = TOTAL_REGIONS - cum; }
      kp.appendChild(k1.d); kp.appendChild(k2.d); kp.appendChild(third.d); c.appendChild(kp);
      countTo(k1.b, lastVals.cum, cum); countTo(k2.b, lastVals.nw, nw);
      countTo(third.b, thirdFmt ? 0 : lastVals.third, thirdVal, thirdFmt);
      lastVals = { cum: cum, nw: nw, third: thirdFmt ? lastVals.third : thirdVal };

      if (E.projects && E.projects.length) {
        c.appendChild(el("h4", null, "Planned projects"));
        var maxCost = Math.max.apply(null, E.projects.map(function (p) { return p.cost; })), total = 0;
        var ul = el("ul", "plist");
        E.projects.forEach(function (p, i) {
          total += p.cost;
          ul.appendChild(listItem(i, p.place, p.name, p.type, p.type === "construction" ? "Construction" : "Upgrading", p.cost, maxCost, p.region));
        });
        c.appendChild(ul);
        var nt = el("p", "note"); nt.appendChild(document.createTextNode("The projects listed in the plan total ")); nt.appendChild(el("b", null, peso(total))); nt.appendChild(document.createTextNode(".")); c.appendChild(nt);
      }
      if (E.capacitation && E.capacitation.length) {
        c.appendChild(el("h4", null, "Laboratories for capacitation"));
        var ul2 = el("ul", "plist");
        E.capacitation.forEach(function (fid, i) {
          var f = FAC[fid];
          ul2.appendChild(listItem(i, f.place, f.name + " · existing PPSSD laboratory", "capacitation", "Capacitation", null, 1, f.region));
        });
        c.appendChild(ul2);
      }
      if (nw) {
        c.appendChild(el("h4", null, "New Centers for PPUSQS"));
        var ch = el("div", "chips");
        E.centers.forEach(function (id, i) { ch.appendChild(chip(id, "new", i)); });
        c.appendChild(ch);
      }
      var earlier = Object.keys(est).filter(function (id) { return est[id] < E.year; });
      if (earlier.length) {
        c.appendChild(el("h4", null, "Already in operation"));
        var ch2 = el("div", "chips");
        earlier.forEach(function (id, i) { ch2.appendChild(chip(id, "old", i)); });
        c.appendChild(ch2);
      }
      c.appendChild(el("h4", null, "Main facilities"));
      var ch3 = el("div", "chips");
      PLAN.facilities.forEach(function (f, i) { var s = chip(f.region, "old", i); s.textContent = f.name + " · " + f.place; ch3.appendChild(s); });
      c.appendChild(ch3);
      yc.appendChild(c);
    }

    // ----- region bar -----
    function renderRegionBar() {
      var rb = $("regionBar"); rb.textContent = "";
      if (!selected) return;
      var r = PLAN.regions[selected], E = Y[yearIdx];
      var bar = el("div", "rbar");
      var x = el("button", "x", "✕"); x.type = "button"; x.setAttribute("aria-label", "Clear region"); x.addEventListener("click", clearRegion); bar.appendChild(x);
      bar.appendChild(el("div", "g", r.group)); bar.appendChild(el("h3", null, r.name));
      var yrs = el("div", "rb-years"); yrs.style.setProperty("--n", Y.length);
      Y.forEach(function (e) {
        var d = el("div"), has = est[selected] != null;
        var cls = !has ? "" : est[selected] < e.year ? "have" : est[selected] === e.year ? "new" : "";
        if (cls) d.className = cls; if (e.year === E.year) d.className += " cur";
        d.appendChild(el("b", null, String(e.year)));
        d.appendChild(document.createTextNode(cls === "new" ? "New" : cls === "have" ? "Center" : "—"));
        yrs.appendChild(d);
      });
      bar.appendChild(yrs);
      var ul = el("ul", "rb-list");
      function row(y, text) { var li = el("li"); li.appendChild(el("b", null, y)); li.appendChild(el("span", null, text)); ul.appendChild(li); }
      if (est[selected] != null) row(String(est[selected]), centerName(selected) + " established.");
      else row("—", "No Center for PPUSQS in this plan.");
      PLAN.facilities.filter(function (f) { return f.region === selected; }).forEach(function (f) { row("Now", "Main facility: " + f.name + ", " + f.place + "."); });
      Y.forEach(function (e) {
        (e.projects || []).filter(function (p) { return p.region === selected; }).forEach(function (p) { row(String(e.year), p.name + ", " + p.place + " (" + peso(p.cost) + ")."); });
        (e.capacitation || []).forEach(function (fid) { if (FAC[fid].region === selected) row(String(e.year), "Capacitation of " + FAC[fid].name + " (" + FAC[fid].place + ")."); });
      });
      bar.appendChild(ul);
      rb.appendChild(bar);
    }
    function selectRegion(id) {
      selected = id; map.select(id); renderRegionBar();
      $("reset").hidden = false; writeHash();
    }
    function clearRegion() {
      selected = null; map.select(null); renderRegionBar();
      $("reset").hidden = true; writeHash();
    }
    $("reset").addEventListener("click", function () { stopPlay(); clearRegion(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && selected) clearRegion(); });

    // ----- main entry: change the year -----
    var bigYear = $("bigYear");
    function setYear(i) {
      i = Math.max(0, Math.min(Y.length - 1, i));
      var changed = i !== yearIdx || !bigYear.textContent;
      yearIdx = i;
      var E = Y[i];
      trackBtns.forEach(function (b, k) { b.setAttribute("aria-selected", String(k === i)); b.tabIndex = k === i ? 0 : -1; b.classList.toggle("passed", k < i); });
      $("trackFill").style.width = (Y.length > 1 ? (i / (Y.length - 1)) * 100 : 0) + "%";
      $("trackFill").style.maxWidth = "calc(100% - 100% / " + Y.length + ")";
      $("trackFill").style.width = "calc((100% - 100% / " + Y.length + ") * " + (Y.length > 1 ? i / (Y.length - 1) : 0) + ")";
      map.setState(function (id) { var e = est[id]; return e == null ? "none" : e === E.year ? "new" : e < E.year ? "have" : "none"; });
      centerMarkers.forEach(function (m) { m.g.classList.toggle("on", est[m.id] <= E.year); m.g.classList.toggle("new", est[m.id] === E.year); });
      ringMarkers.forEach(function (m) { m.g.classList.toggle("on", m.year === E.year); });
      if (changed) {
        var by = bigYear.cloneNode(false); by.textContent = String(E.year); bigYear.parentNode.replaceChild(by, bigYear); bigYear = by;
        renderYear(E);
      }
      renderLegend(E); renderRegionBar(); writeHash();
    }

    // ----- URL hash: #year=2028&region=davao -----
    function writeHash() {
      try { history.replaceState(null, "", "#year=" + Y[yearIdx].year + (selected ? "&region=" + selected : "")); } catch (e) { /* ignore */ }
    }
    var m = location.hash.match(/year=(\d{4})/), mr = location.hash.match(/region=([\w-]+)/);
    var startIdx = 0;
    if (m) { var found = Y.findIndex(function (e) { return e.year === +m[1]; }); if (found >= 0) startIdx = found; }
    setYear(startIdx);
    if (mr && DATA[mr[1]]) { selected = mr[1]; map.select(selected, true); renderRegionBar(); $("reset").hidden = false; }
    if (m) setTimeout(function () { $("roadmap").scrollIntoView(); }, 60);
  })();
})();
