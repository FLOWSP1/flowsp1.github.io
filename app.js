/* Áreas Executivas · Flow — o site (GitHub Pages). Os dados ficam na planilha; a API é o Apps Script (config.js). */
'use strict';

var PARAMS = new URLSearchParams(location.search);
var PAGINA = PARAMS.get('pagina') || 'painel';
var ETAPA_NOME = { 'Onboard': 'Welcome Flow', 'Trainee 1': 'Trainee · dia 1', 'Trainee 2': 'Trainee · dia 2', 'Voluntário': 'Voluntário' };
var PERFIL = { core: 'Core', head: 'Head', lider: 'Liderança', lider_area: 'Liderança', lider_zfam: 'Liderança' };
var SEM_AREA = '__sem', A_CONFIRMAR = '__confirmar';
var ABERTAS = ['formularioPublico', 'inscrever', 'cadastrarCrew', 'entrarComCodigo', 'entrarComSenha', 'pedirCodigoEmail', 'confirmarCodigoEmail'];

/* ---------- armazenamento local (só conveniência; tudo tem plano B) ---------- */
function guardar(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { } }
function lembrar(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function guardarSessao(k, v) { try { v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) { } }
function lembrarSessao(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }

/* ---------- estado ---------- */
var S = {
  token: lembrar('aes-token') || '', r: null, tab: lembrar('aes-tab') || null, area: null, zfam: null, areaVer: 'tudo',
  filtroPessoas: 'todos', busca: '', filtroInsc: 'Nova', soAE: true, filtroEquipe: '', buscaEquipe: '', crew: 'pessoas',
  filtroPedidos: 'Pendente', trArea: '', trEtapa: 'todas', login: 'senha', loginMsg: '', loginEmail: '', voltar: null,
  modal: null, pendente: null, perguntas: null, codigoNovo: null, prefAcesso: null, resumoSync: '', form: null, cadastroFeito: null
};

/* ---------- conversa com a API ---------- */
function api(fn) {
  var args = Array.prototype.slice.call(arguments, 1);
  carregando(+1);
  var pedido = { fn: fn, args: args, token: S.token };
  var p = window.SERVIDOR_LOCAL ?
    new Promise(function (ok) { setTimeout(function () { ok(JSON.parse(JSON.stringify(window.SERVIDOR_LOCAL(pedido)))); }, 40); }) :
    fetch(window.FLOW_API, { method: 'POST', body: JSON.stringify(pedido), redirect: 'follow' }).then(function (r) {
      if (!r.ok) throw new Error('O servidor não respondeu (' + r.status + '). Tente de novo.');
      return r.json();
    }, function () { throw new Error('Sem conexão com o servidor. Confira a internet e tente de novo.'); });
  return p.then(function (out) {
    carregando(-1);
    if (!out.ok) {
      if (out.sair && ABERTAS.indexOf(fn) < 0) sairLocal(out.erro);
      throw new Error(out.erro);
    }
    return out.dados;
  }, function (e) { carregando(-1); throw e; });
}
var EM_CURSO = 0;
function carregando(d) {
  EM_CURSO = Math.max(0, EM_CURSO + d);
  var el = document.getElementById('load');
  if (EM_CURSO && !el) { el = document.createElement('div'); el.id = 'load'; el.className = 'carregando'; document.body.appendChild(el); }
  if (!EM_CURSO && el) el.remove();
}
function toast(msg, erro) {
  document.querySelectorAll('.toast').forEach(function (t) { t.remove(); });
  var t = document.createElement('div');
  t.className = 'toast' + (erro ? ' erro' : '');
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function () { t.remove(); }, erro ? 5500 : 2600);
}
function falha(e) { toast((e && e.message) || String(e), true); if (window.SERVIDOR_LOCAL && e && e.stack) console.error(e.stack); }
function copiar(texto, msg) {
  (navigator.clipboard ? navigator.clipboard.writeText(texto) : Promise.reject()).then(function () { toast(msg || 'Copiado'); }, function () { prompt('Copie:', texto); });
}
function sairLocal(msg) {
  guardar('aes-token', null); guardarSessao('aes-r', null);
  S.token = ''; S.r = null; S.voltar = null; S.loginMsg = msg || ''; S.login = 'senha';
  fecharModal(); render();
}

/* ---------- utilidades ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean); }
function lista(s) { return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
function dt(iso) { return iso ? new Date(String(iso).slice(0, 10) + 'T12:00:00') : null; }
function fmtData(iso) { var d = dt(iso); return d && !isNaN(d) ? d.toLocaleDateString('pt-BR') : ''; }
function fmtCurta(iso) { var d = dt(iso); return d && !isNaN(d) ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''; }
function fmtDataHora(s) { s = String(s || ''); return fmtData(s) + (s.length > 10 ? ' ' + s.slice(11, 16) : ''); }
function mesesEntre(a, b) { return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) - (b.getDate() < a.getDate() ? 1 : 0); }
function wa(tel) { var s = String(tel || '').replace(/\D/g, ''); return s ? 'https://wa.me/' + (s.length <= 11 ? '55' + s : s) : ''; }
function waMsg(tel, msg) { return wa(tel) + '?text=' + encodeURIComponent(msg); }
function pct(a, b) { return b ? Math.round(100 * a / b) : 0; }
function porOrdem(a, b) { return Number(a.ordem || 99) - Number(b.ordem || 99); }
function nomeFmt(n) {
  n = String(n || '').trim();
  if (n !== n.toLowerCase() && n !== n.toUpperCase()) return n;
  return n.toLowerCase().split(/\s+/).map(function (w, i) {
    return i > 0 && ['de', 'da', 'do', 'das', 'dos', 'e'].indexOf(w) >= 0 ? w : w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}
function primeiroNome(n) { return nomeFmt(n).split(' ')[0]; }
function nomeBate(curto, completo, ambiguo) {
  var a = norm(curto), b = norm(completo);
  if (!a.length || !b.length) return false;
  var primeiro = a[0] === b[0] || (a[0].length >= 3 && b[0].length >= 3 && (b[0].indexOf(a[0]) === 0 || a[0].indexOf(b[0]) === 0));
  if (!primeiro) return false;
  if (a.length === 1) return a[0] === b[0] && !ambiguo;
  return b.indexOf(a[a.length - 1]) > 0;
}
function opts(l, atual, vazio) {
  return (vazio !== undefined ? '<option value="">' + esc(vazio) + '</option>' : '') + l.map(function (o) {
    var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
    return '<option value="' + esc(v) + '"' + (String(v) === String(atual) ? ' selected' : '') + '>' + esc(t) + '</option>';
  }).join('');
}
function tag(txt, cls, tip) { return '<span class="tag ' + (cls || '') + '"' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '>' + esc(txt) + '</span>'; }
function jsonObj(s, padrao) { try { var v = JSON.parse(s || ''); return v && typeof v === 'object' ? v : padrao; } catch (e) { return padrao; } }

/* ---------- contas em cima dos dados ---------- */
function C() {
  var d = S.r.dados, hoje = dt(S.r.hoje);
  var pessoas = d.pessoas || [], servico = d.servico || [], areas = (d.areas || []).slice().sort(porOrdem);
  var porId = {}, serv = {}, areaId = {}, zfamOk = {};
  pessoas.forEach(function (p) { porId[p.id] = p; serv[p.id] = []; });
  servico.forEach(function (s) { (serv[s.pessoa_id] = serv[s.pessoa_id] || []).push(s); });
  areas.forEach(function (a) { areaId[a.id] = a; });
  (d.nomesZfams || (d.zfams || []).map(function (z) { return z.lider; })).forEach(function (n) { zfamOk[n] = 1; });
  function idade(p) { var n = dt(p.nascimento); return n && !isNaN(n) ? Math.floor(mesesEntre(n, hoje) / 12) : null; }
  function faz18(p) { var n = dt(p.nascimento); if (!n || isNaN(n)) return null; var f = new Date(n); f.setFullYear(n.getFullYear() + 18); return f; }
  function selo18(p) {
    var f = faz18(p); if (!f) return null;
    if (f <= hoje) return { cls: 'bad', txt: '18+ · VOX', ordem: 0, data: f };
    var m = mesesEntre(hoje, f);
    if (m < 6) return { cls: 'warn', txt: 'faz 18 em ' + (m < 1 ? 'menos de 1 mês' : m + (m === 1 ? ' mês' : ' meses')), ordem: 1, data: f };
    if (m < 12) return { cls: 'line', txt: 'faz 18 em ' + m + ' meses', ordem: 2, data: f };
    return null;
  }
  function chegadaMeses(p) {
    var c = String(p.chegada || ''), m = c.match(/^(\d{4})-(\d{2})/);
    if (m) return mesesEntre(new Date(+m[1], +m[2] - 1, 1), hoje);
    m = c.match(/^(\d{4})$/);
    if (m && +m[1] < hoje.getFullYear()) return mesesEntre(new Date(+m[1], 11, 31), hoje);
    return null;
  }
  function apto(p) {
    var i = idade(p);
    if (i !== null && i >= 18) return { ok: false, txt: 'Já tem 18: vai pro VOX', idade: true };
    if (!p.zfam) return { ok: false, txt: 'Sem ZFAM' };
    if (!zfamOk[p.zfam]) return { ok: null, txt: 'Confirmar ZFAM' };
    var m = chegadaMeses(p);
    if (m === null) return { ok: null, txt: 'Confirmar chegada' };
    if (m < 6) return { ok: false, txt: 'Menos de 6 meses no Flow' };
    return { ok: true, txt: 'Pode servir' };
  }
  function situacao(p) {
    var s = serv[p.id] || [];
    if (s.some(function (x) { return x.status !== 'Parado' && x.etapa === 'Voluntário'; })) return 'servindo';
    if (s.some(function (x) { return x.status !== 'Parado'; })) return 'formacao';
    return s.length ? 'parado' : 'nao';
  }
  function statsArea(a) {
    var ss = servico.filter(function (s) { return s.area_id === a.id && porId[s.pessoa_id]; });
    var vol = ss.filter(function (s) { return s.status !== 'Parado' && s.etapa === 'Voluntário'; });
    var form = ss.filter(function (s) { return s.status !== 'Parado' && s.etapa !== 'Voluntário'; });
    var par = ss.filter(function (s) { return s.status === 'Parado'; });
    var ideal = a.ideal === '' || a.ideal == null || isNaN(+a.ideal) ? null : +a.ideal;
    var vox = vol.concat(form).filter(function (s) { var x = selo18(porId[s.pessoa_id]); return x && x.ordem <= 1; });
    return { vol: vol, form: form, par: par, ideal: ideal, gap: ideal === null ? null : vol.length - ideal, vox: vox };
  }
  // trainees = quem está no processo (Welcome Flow e os 2 dias), ativo e numa área que a pessoa vê
  var trainees = servico.filter(function (s) { return s.status !== 'Parado' && s.etapa !== 'Voluntário' && porId[s.pessoa_id]; });
  return { d: d, hoje: hoje, pessoas: pessoas, servico: servico, areas: areas, porId: porId, serv: serv, areaId: areaId, trainees: trainees,
           idade: idade, selo18: selo18, apto: apto, situacao: situacao, statsArea: statsArea, chegadaMeses: chegadaMeses,
           zfamConhecido: function (p) { return !!p.zfam && !!zfamOk[p.zfam]; } };
}
function gestao() { return S.r && (S.r.usuario.perfil === 'core' || S.r.usuario.perfil === 'head'); }
function podeArea(id) { var u = S.r.usuario; return gestao() || (!!id && u.areas.indexOf(id) >= 0); }
function nomeArea(c, id) { return id ? ((c.areaId[id] || {}).nome || id) : 'área a definir'; }
function headCls(h) { return h === 'MM' ? 'mm' : h === 'OP' ? 'op' : ''; }
function tagHead(h) { return h ? tag(h === 'MM' ? 'Multimídia' : 'Operações', headCls(h)) : tag('sem head', 'line'); }
function tagEtapa(s) {
  if (s.status === 'Parado') return tag('Parado · ' + (ETAPA_NOME[s.etapa] || s.etapa), 'par');
  return tag(ETAPA_NOME[s.etapa] || s.etapa, s.etapa === 'Voluntário' ? 'vol' : s.etapa === 'Onboard' ? 'wf' : 'tr');
}
function tagApto(ap) { return tag(ap.txt, ap.ok ? 'ok' : ap.ok === null ? 'warn' : 'bad'); }
function lideresDe(a) { return a ? String(a.lideres || '').trim() : ''; }
/** O próximo passo de quem está no processo: o que fazer e com quem falar. */
function proximoPasso(c, s) {
  var a = c.areaId[s.area_id], lid = lideresDe(a);
  if (s.etapa === 'Trainee 2') return { pronto: true, txt: 'Fez os 2 dias: pode começar como voluntário' + (lid ? '. Falar com ' + lid : (s.area_id ? '' : '. Defina a área')) };
  if (s.etapa === 'Trainee 1') return { txt: 'Falta o 2º dia de trainee' + (s.horario ? ' (' + s.horario + ')' : '') };
  return { txt: s.area_id ? 'Marcar o 1º dia de trainee' + (lid ? ' com ' + lid : '') : 'Escolher a área e marcar o 1º dia' };
}
function escopoDe(a) {
  var o = { areas: [], zfams: [] };
  lista(a.escopo).forEach(function (e) {
    if (e.indexOf('area:') === 0) o.areas.push(e.slice(5));
    else if (e.indexOf('zfam:') === 0) o.zfams.push(e.slice(5));
    else (a.perfil === 'lider_zfam' ? o.zfams : o.areas).push(e);
  });
  return o;
}
function escopoTexto(c, areas, zfams) {
  return areas.map(function (id) { return nomeArea(c, id); }).concat(zfams.map(function (z) { return 'ZFAM ' + z; })).join(' · ');
}

/* ---------- moldura ---------- */
function tabsDoPerfil() {
  var u = S.r.usuario, t = [];
  if (!gestao()) {
    if (u.areas.length) { t.push(['areas', u.areas.length > 1 ? 'Minhas áreas' : 'Minha área']); t.push(['trainees', 'Trainees']); }
    if (u.zfams.length) t.push(['zfams', u.zfams.length > 1 ? 'Meus ZFAMs' : 'Meu ZFAM']);
    return t;
  }
  var pend = (S.r.dados.cadastros || []).filter(function (x) { return x.status === 'Pendente'; }).length;
  var prontos = (S.r.dados.servico || []).filter(function (s) { return s.status !== 'Parado' && s.etapa === 'Trainee 2'; }).length;
  return [['geral', 'Visão geral'], ['areas', 'Áreas'], ['trainees', 'Trainees', prontos], ['zfams', 'ZFAMs'], ['inscricoes', 'Inscrições'],
          ['pessoas', 'Adolescentes'], ['crew', 'CREW FLOW', pend]];
}
function navHtml(tabs) {
  return '<nav class="nav" aria-label="Seções">' + tabs.map(function (t) {
    return '<button class="' + (t[0] === S.tab ? 'on' : '') + '" data-acao="tab" data-v="' + t[0] + '"' + (t[0] === S.tab ? ' aria-current="page"' : '') + '><span>' + t[1] + '</span>' +
      (t[2] ? '<span class="cnt">' + t[2] + '</span>' : '') + '</button>';
  }).join('') + '</nav>';
}
function render() {
  var app = document.getElementById('app');
  esconderTip();
  if (PAGINA !== 'painel') return;
  if (!S.r) { app.innerHTML = S.token ? '<div class="boot"><img src="logo-escuro.png" alt="FLOW" width="88"><p>Carregando o painel…</p></div>' : telaLogin(); return; }
  var tabs = tabsDoPerfil();
  if (!S.tab || !tabs.some(function (t) { return t[0] === S.tab; })) S.tab = tabs[0][0];
  var c = C(), u = S.r.usuario;
  var corpo = { geral: vGeral, areas: vAreas, trainees: vTrainees, zfams: vZfams, inscricoes: vInscricoes, pessoas: vPessoas, crew: vCrew }[S.tab](c);
  var aviso = gestao() && !c.pessoas.length ? '<div class="aviso"><div><b>O painel ainda não tem os adolescentes.</b> Puxe das planilhas antigas (formulário, voluntários e ZFAMs). Não apaga nada.</div>' +
    '<button class="btn primary" data-acao="sync">Puxar das planilhas antigas</button></div>' : '';
  var papel = u.perfil === 'lider' ? 'Liderança · ' + escopoTexto(c, u.areas, u.zfams) : PERFIL[u.perfil];
  app.innerHTML = '<div class="shell"><aside class="side"><div class="brand"><img src="logo-claro.png" alt="FLOW"><span><b>Áreas Executivas</b>gestão de voluntários</span></div>' +
    navHtml(tabs) + '<div class="eu"><b>' + esc(u.nome) + '</b>' + esc(papel) + '<br>' + (S.voltar ? '' : '<button class="lnk" data-acao="sair">Sair</button>') + '</div></aside>' +
    '<div class="main"><header class="topbar"><div class="tb"><img src="logo-claro.png" alt="FLOW"><span class="tt">Áreas Executivas · ' + esc(primeiroNome(u.nome)) + '</span>' +
    (S.voltar ? '' : '<button class="lnk" data-acao="sair">Sair</button>') + '</div>' + navHtml(tabs) + '</header>' +
    (S.voltar ? '<div class="banner">Você está vendo o painel como <b>' + esc(u.nome) + '</b>. <button class="btn sm" data-acao="voltar">Voltar pro meu acesso</button></div>' : '') +
    '<div class="wrap">' + aviso + corpo + '</div></div></div>';
  if (S.modal) abrirModal(S.modal.tipo, S.modal.id, true);
}
function ph(eyebrow, titulo, sub, acts) {
  return '<div class="ph"><div><p class="eyebrow">' + eyebrow + '</p><h1>' + titulo + '</h1>' + (sub ? '<p class="sub">' + sub + '</p>' : '') + '</div>' +
    (acts ? '<div class="acts">' + acts + '</div>' : '') + '</div>';
}
function kpi(l, v, sub, d, extra) {
  return '<div class="kpi' + (extra && extra.cls ? ' ' + extra.cls : '') + '"' + (extra && extra.acao ? ' data-acao="' + extra.acao + '" data-v="' + (extra.v || '') + '" role="button" tabindex="0"' : '') + '>' +
    '<div class="kpi-l">' + l + '</div><div class="kpi-v">' + v + (sub ? '<small> ' + sub + '</small>' : '') + '</div><div class="kpi-d">' + d + '</div></div>';
}
function card(titulo, sub, corpo, acts) {
  return '<div class="card"><div class="card-h"><h3>' + titulo + '</h3>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + (acts || '') + '</div><div class="card-b">' + corpo + '</div></div>';
}
function secao(titulo, sub, corpo, acts) {
  return '<section class="sec"><div class="sec-h"><div><h2>' + titulo + '</h2>' + (sub ? '<p class="sub">' + sub + '</p>' : '') + '</div>' + (acts || '') + '</div>' + corpo + '</section>';
}

/* ---------- entrada ---------- */
function telaLogin() {
  var m = S.login, caixa;
  if (m === 'codigo') {
    caixa = '<h2>Entrar com código</h2><p class="sub">O código pessoal de 6 letras que chegou no seu e-mail.</p>' + msgLogin() +
      '<form data-form="login-codigo"><label class="field">Código de acesso<input type="text" name="codigo" class="codigo" maxlength="12" autocomplete="off" required></label>' +
      '<button class="btn primary full" type="submit">Entrar</button></form>' +
      '<div class="alt"><button class="lnk" data-acao="login-modo" data-v="senha">Entrar com e-mail e senha</button></div>';
  } else if (m === 'email1') {
    caixa = '<h2>Primeiro acesso ou senha esquecida</h2><p class="sub">Digite o e-mail do seu cadastro. Mandamos um código de 6 números pra confirmar e você cria a sua senha.</p>' + msgLogin() +
      '<form data-form="login-email1"><label class="field">E-mail<input type="email" name="email" autocomplete="email" value="' + esc(S.loginEmail) + '" required></label>' +
      '<button class="btn primary full" type="submit">Mandar o código</button></form>' +
      '<div class="alt"><button class="lnk" data-acao="login-modo" data-v="senha">Voltar</button></div>';
  } else if (m === 'email2') {
    caixa = '<h2>Confirme o seu e-mail</h2><p class="sub">Se <b>' + esc(S.loginEmail) + '</b> estiver no nosso cadastro, o código chegou lá (olhe também o spam). Ele vale por 20 minutos.</p>' + msgLogin() +
      formConfirmar('login-email2') +
      '<div class="alt"><button class="lnk" data-acao="login-reenviar">Mandar o código de novo</button><button class="lnk" data-acao="login-modo" data-v="senha">Voltar</button></div>';
  } else {
    caixa = '<h2>Entrar</h2><p class="sub">Use o e-mail do seu cadastro e a sua senha.</p>' + msgLogin() +
      '<form data-form="login-senha"><label class="field">E-mail<input type="email" name="email" autocomplete="username" value="' + esc(S.loginEmail) + '" required></label>' +
      '<label class="field">Senha<input type="password" name="senha" autocomplete="current-password" required></label>' +
      '<button class="btn primary full" type="submit">Entrar</button></form>' +
      '<div class="alt"><button class="lnk" data-acao="login-modo" data-v="email1">Primeiro acesso ou esqueci a senha</button>' +
      '<button class="lnk" data-acao="login-modo" data-v="codigo">Entrar com código de acesso</button></div>';
  }
  return '<div class="login"><div class="lado"><img src="logo-claro.png" alt="FLOW"><div><div class="faixa"></div><h1>Áreas Executivas</h1>' +
    '<p>Gestão de voluntários do Flow: áreas, trainees, ZFAMs e a CREW que serve com a gente.</p></div><p class="rod">Acesso só para a liderança. Os dados dos adolescentes ficam protegidos e cada líder vê só o que lidera.</p></div>' +
    '<div class="form-l"><div class="caixa">' + caixa + '<div class="sep"></div><p class="sub" style="margin-bottom:10px">Serve no Flow e ainda não tem cadastro?</p>' +
    '<a class="btn full" href="?pagina=cadastro">Criar minha conta</a></div></div></div>';
}
function msgLogin() { return S.loginMsg ? '<div class="msg">' + esc(S.loginMsg) + '</div>' : ''; }
function formConfirmar(nome) {
  return '<form data-form="' + nome + '"><label class="field">Código do e-mail<input type="text" name="codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" class="codigo" required></label>' +
    '<label class="field">Crie uma senha<input type="password" name="senha" autocomplete="new-password" minlength="6" required><small>pelo menos 6 caracteres</small></label>' +
    '<label class="field">Repita a senha<input type="password" name="senha2" autocomplete="new-password" minlength="6" required></label>' +
    '<button class="btn primary full" type="submit">Confirmar e entrar</button></form>';
}
function entrou(r, persistir) {
  S.token = r.token;
  if (persistir !== false) guardar('aes-token', r.token);
  S.loginMsg = '';
  aplicar(r);
}

/* ---------- visão geral ---------- */
function vGeral(c) {
  var servindo = c.pessoas.filter(function (p) { return c.situacao(p) === 'servindo'; });
  var stats = c.areas.map(function (a) { return { a: a, s: c.statsArea(a) }; });
  var comIdeal = stats.filter(function (x) { return x.s.ideal !== null; });
  var idealTotal = comIdeal.reduce(function (t, x) { return t + x.s.ideal; }, 0);
  var falta = comIdeal.reduce(function (t, x) { return t + Math.max(0, x.s.ideal - x.s.vol.length); }, 0);
  var volComIdeal = comIdeal.reduce(function (t, x) { return t + Math.min(x.s.vol.length, x.s.ideal); }, 0);
  var porEtapa = { 'Onboard': 0, 'Trainee 1': 0, 'Trainee 2': 0 };
  c.trainees.forEach(function (s) { porEtapa[s.etapa] = (porEtapa[s.etapa] || 0) + 1; });
  var emZ = c.pessoas.filter(function (p) { return p.zfam; });
  var emZserv = emZ.filter(function (p) { var s = c.situacao(p); return s === 'servindo' || s === 'formacao'; });
  var novas = (c.d.inscricoes || []).filter(function (i) { return i.status === 'Nova' && (i.ministerio === 'Áreas Executivas' || i.area_interesse) && !jaServe(c, i); });

  var h = ph('visão geral', 'Como estão as Áreas Executivas', 'Dados de ' + fmtData(S.r.hoje) + '. Clique numa barra ou num número pra abrir.',
    '<button class="btn" data-acao="sync">Atualizar com as planilhas antigas</button>' + (S.r.inboard ? '<button class="btn" data-acao="sync-inboard">Ler o Onboard</button>' : ''));
  h += '<div class="kpis">' +
    kpi('Voluntários servindo', servindo.length, '', idealTotal ? pct(volComIdeal, idealTotal) + '% do ideal preenchido (' + volComIdeal + ' de ' + idealTotal + ')' : 'ideal das áreas a definir') +
    kpi('Em formação', c.trainees.length, '', 'Welcome Flow e trainees', { acao: 'tab', v: 'trainees' }) +
    kpi('Faltam pro ideal', falta, '', (stats.length - comIdeal.length) ? (stats.length - comIdeal.length) + ' área(s) sem ideal definido' : 'somando todas as áreas', { cls: falta ? 'alerta' : '' }) +
    kpi('Prontos pra servir', porEtapa['Trainee 2'], '', 'fizeram os 2 dias de trainee', { acao: 'tab', v: 'trainees', cls: porEtapa['Trainee 2'] ? 'alerta' : '' }) + '</div>';

  // gráficos: voluntários por área (com o ideal) e o funil de entrada
  var ord = stats.slice().sort(function (x, y) { return (x.s.gap === null ? 99 : x.s.gap) - (y.s.gap === null ? 99 : y.s.gap); });
  var max = Math.max.apply(null, [1].concat(ord.map(function (x) { return Math.max(x.s.vol.length, x.s.ideal || 0); })));
  var barras = ord.map(function (x) {
    var v = x.s.vol.length, ideal = x.s.ideal;
    var tip = x.a.nome + ': ' + v + ' voluntário(s)' + (ideal !== null ? ' de ' + ideal + ' (ideal)' : ', ideal a definir') + (x.s.form.length ? ' · ' + x.s.form.length + ' em formação' : '');
    var val = ideal === null ? '<b>' + v + '</b> · ideal ?' : x.s.gap < 0 ? '<b>' + v + '</b>/' + ideal + ' · faltam ' + (-x.s.gap) : '<b>' + v + '</b>/' + ideal + ' · ok';
    return '<div class="crow" data-acao="ir-area" data-v="' + x.a.id + '" data-tip="' + esc(tip) + '"><span class="lab">' + esc(x.a.nome) + '</span>' +
      '<span class="track"><span class="fill ' + (headCls(x.a.head) || 'sem') + '" style="width:' + (100 * v / max) + '%"></span>' +
      (ideal ? '<span class="mark" style="left:calc(' + (100 * ideal / max) + '% - 1px)"></span>' : '') + '</span><span class="val">' + val + '</span></div>';
  }).join('');
  var leg = '<div class="legend"><span><i style="background:var(--mm)"></i>Multimídia</span><span><i style="background:var(--op)"></i>Operações</span>' +
    '<span><i style="background:#8C8FA3"></i>sem head</span><span><i class="mark"></i>ideal da área</span></div>';
  var funil = [['Welcome Flow', porEtapa['Onboard'], 'fizeram o Welcome Flow presencial e esperam o 1º dia'],
               ['Trainee · dia 1', porEtapa['Trainee 1'], 'serviram o 1º dia de trainee'],
               ['Trainee · dia 2', porEtapa['Trainee 2'], 'serviram os 2 dias: prontos pra virar voluntários'],
               ['Voluntários', servindo.length, 'servindo na escala']];
  var fmax = Math.max.apply(null, [1].concat(funil.map(function (f) { return f[1]; })));
  var funilH = '<div class="funil">' + funil.map(function (f) {
    return '<div class="crow" data-tip="' + esc(f[1] + ' ' + f[2]) + '"><span class="lab">' + f[0] + '</span><span class="track alto"><span class="fill" style="width:' + (100 * f[1] / fmax) + '%"></span></span><span class="val">' + f[1] + '</span></div>';
  }).join('') + '</div>';
  h += '<div class="grid-ch" style="margin-top:16px">' + card('Voluntários por área', 'servindo hoje × ideal', barras + leg) +
    card('Funil de entrada', 'onde cada um está no processo', funilH + '<p class="kpi-d" style="margin-top:12px">' + novas.length + ' inscrição(ões) nova(s) esperando contato · <button class="lnk" data-acao="tab" data-v="inscricoes">ver</button></p>') + '</div>';

  // como funciona: o processo e a estrutura
  var passos = [
    ['1', 'Inscrição', 'O adolescente se inscreve pelo formulário. Pra servir: estar num ZFAM e ter 6 meses ou mais de Flow.', novas.length, 'novas'],
    ['2', 'Welcome Flow', 'Encontro presencial de boas-vindas: a visão do Flow e de servir. É o teórico.', porEtapa['Onboard'], 'esperando o dia 1'],
    ['3', 'Trainee · 2 dias', 'Serve 2 cultos junto com um voluntário da área, no horário combinado.', porEtapa['Trainee 1'] + porEtapa['Trainee 2'], 'em trainee'],
    ['4', 'Voluntário', 'Depois do 2º dia o líder da área confirma e ele entra na escala.', servindo.length, 'servindo']
  ];
  h += secao('Como funciona', 'O caminho de quem chega até servir na escala.',
    '<div class="card"><div class="passos">' + passos.map(function (p) {
      return '<div class="passo"><span class="n">Passo ' + p[0] + '</span><h4>' + p[1] + '</h4><p>' + p[2] + '</p><div class="q">' + p[3] + ' <small>' + p[4] + '</small></div></div>';
    }).join('') + '</div></div>');
  var lid = S.r.lideranca || [];
  var nomesDe = function (prefixo) { return lid.filter(function (l) { return String(l[1]).indexOf(prefixo) === 0; }).map(function (l) { return l[0] + (l[1] !== prefixo ? ' (' + l[1].replace('Head ', '') + ')' : ''); }).join(', '); };
  var org = '<div class="org">' +
    '<div class="niv"><b>Core</b><span>' + (esc(nomesDe('Core')) || 'o casal pastor do Flow') + '</span></div>' +
    '<div class="niv"><b>Heads</b><span>' + (esc(nomesDe('Head')) || 'Multimídia, RH e Operações') + '</span></div>' +
    '<div class="niv"><b>Líderes de área</b><span>um ou dois por área, com um auxiliar adolescente</span></div>' +
    '<div class="niv"><b>Voluntários</b><span>adolescentes de ZFAM servindo na escala quinzenal</span></div>' +
    '<div class="niv"><b>Trainees</b><span>no Welcome Flow ou nos 2 dias de trainee</span></div></div>';
  var regras = '<ul class="regras"><li>Só serve quem está num ZFAM e tem 6 meses ou mais de Flow.</li>' +
    '<li>O voluntário entra depois de servir os 2 dias de trainee.</li><li>Aos 18 anos a pessoa vai pro VOX; antes de sair, o líder indica quem assume.</li>' +
    '<li>Multimídia: fotografia, produção de palco, projeção, iluminação, som e livestream. Operações: apoio, recepção, check-in e ronda.</li></ul>';
  h += '<div class="grid-2" style="margin-top:16px">' + card('Estrutura', '', org) + card('Regras', '', regras) + '</div>';

  // metas
  h += secao('Metas', '', '<div class="grid-2">' + ['curto', 'longo'].map(function (prazo) {
    var ms = (c.d.metas || []).filter(function (m) { return m.prazo === prazo; }).sort(porOrdem);
    return card(prazo === 'curto' ? 'Curto prazo' : 'Longo prazo', '', ms.map(function (m) { return cardMeta(m, c); }).join('') || '<p class="vazio">Nenhuma meta.</p>');
  }).join('') + '</div>', '<button class="btn sm" data-acao="meta-nova">+ meta</button>');

  // ZFAM × serviço
  var zf = zfamsResumo(c).filter(function (z) { return z.lider !== '' && z.lider !== A_CONFIRMAR; });
  h += secao('ZFAM × serviço', pct(emZserv.length, emZ.length) + '% dos adolescentes de ZFAM servem ou estão em formação (' + emZserv.length + ' de ' + emZ.length + ').',
    card('Quanto cada ZFAM serve', '% servindo ou em formação', zf.map(function (z) {
      var p = pct(z.serv, z.total);
      return '<div class="crow" data-acao="ir-zfam" data-v="' + esc(z.lider) + '" data-tip="' + esc(z.lider + ': ' + z.serv + ' de ' + z.total + ' servindo ou em formação' + (z.aptos ? ' · ' + z.aptos + ' podem ser convidados' : '')) + '">' +
        '<span class="lab">' + esc(z.lider) + '</span><span class="track"><span class="fill" style="width:' + p + '%"></span></span><span class="val"><b>' + p + '%</b> · ' + z.serv + '/' + z.total + '</span></div>';
    }).join('') || '<p class="vazio">Sem ZFAMs.</p>'));

  // transição VOX
  var vox = c.pessoas.filter(function (p) { var s = c.situacao(p); return (s === 'servindo' || s === 'formacao') && c.selo18(p); })
    .sort(function (a, b) { return c.selo18(a).data - c.selo18(b).data; });
  h += secao('Transição pro VOX', 'Quem serve e faz 18 nos próximos 12 meses. Cada líder indica quem assume quando ele sair.',
    vox.length ? '<div class="tbl-wrap"><table class="tbl"><tr><th>Nome</th><th>18 anos</th><th>Onde serve</th><th>Sucessor indicado</th></tr>' + vox.map(function (p) {
      var x = c.selo18(p), ss = c.serv[p.id] || [];
      return '<tr class="click" data-acao="pessoa" data-id="' + p.id + '"><td><b>' + esc(nomeFmt(p.nome)) + '</b></td><td>' + tag(x.txt, x.cls) + ' <span class="kpi-d">' + x.data.toLocaleDateString('pt-BR') + '</span></td>' +
        '<td>' + ss.map(function (s) { return esc(nomeArea(c, s.area_id)) + ' ' + tagEtapa(s); }).join('<br>') + '</td>' +
        '<td>' + ss.map(function (s) { var a = c.areaId[s.area_id]; return a && a.sucessor ? esc(a.sucessor) : tag('não indicado', 'bad'); }).join('<br>') + '</td></tr>';
    }).join('') + '</table></div>' : '<div class="list"><p class="vazio">Ninguém servindo faz 18 nos próximos 12 meses.</p></div>');

  // correlações
  h += secao('Quem serve, entre os adolescentes de ZFAM', '', '<div class="grid-3">' +
    correlacao(c, emZ, 'Por ano de chegada no Flow', function (p) { var m = String(p.chegada || '').match(/^\d{4}/); return m ? m[0] : 'sem dado'; }) +
    correlacao(c, emZ, 'Por Raízes', function (p) { return p.raizes || 'sem dado'; }) +
    correlacao(c, emZ, 'Por idade', function (p) { var i = c.idade(p); return i === null ? 'sem dado' : i <= 14 ? '14 ou menos' : i >= 18 ? '18+' : i + ' anos'; }) + '</div>');
  return h;
}
function metaAuto(m, c) {
  var vol = c.pessoas.filter(function (p) { return c.situacao(p) === 'servindo'; });
  var st = c.areas.map(function (a) { return c.statsArea(a); });
  switch (m.auto) {
    case 'areas_minimo': var com = st.filter(function (s) { return s.ideal !== null; }); return [com.filter(function (s) { return s.vol.length >= s.ideal; }).length, com.length, 'áreas com o ideal'];
    case 'teorico': return [vol.filter(function (p) { return p.teorico === 'Sim'; }).length, vol.length, 'voluntários com o novo teórico'];
    case 'auxiliar': return [c.areas.filter(function (a) { return a.auxiliar; }).length, c.areas.length, 'áreas com auxiliar adolescente'];
    case 'sucessor': return [c.areas.filter(function (a) { return a.sucessor; }).length, c.areas.length, 'áreas com sucessor indicado'];
    case 'domingo': return [c.pessoas.filter(function (p) { return p.domingo === 'Sim'; }).length, vol.length, 'com escala de domingo'];
    case 'zfam_servindo': var z = c.pessoas.filter(function (p) { return p.zfam; }); return [z.filter(function (p) { var s = c.situacao(p); return s === 'servindo' || s === 'formacao'; }).length, z.length, 'de ZFAM servindo'];
    case 'raizes': return [vol.filter(function (p) { return p.raizes === 'Concluído'; }).length, vol.length, 'voluntários com Raízes concluído'];
  }
  return null;
}
function cardMeta(m, c) {
  var a = metaAuto(m, c), p, txt;
  if (a) { p = pct(a[0], a[1]); txt = a[0] + ' de ' + a[1] + ' ' + a[2]; } else { p = Math.max(0, Math.min(100, Number(m.andamento) || 0)); txt = 'andamento marcado à mão'; }
  return '<div class="meta"><div class="tx">' + esc(m.texto) + '</div><div class="track"><span class="fill' + (p >= 100 ? ' cheia' : '') + '" style="width:' + p + '%"></span></div>' +
    '<div class="ft"><span><b>' + p + '%</b> · ' + txt + (m.responsavel ? ' · resp.: ' + esc(m.responsavel) : '') + (m.data_limite ? ' · até ' + fmtData(m.data_limite) : '') + '</span>' +
    (gestao() ? '<button class="lnk" data-acao="meta" data-id="' + m.id + '">editar</button>' : '') + '</div></div>';
}
function correlacao(c, base, titulo, chave) {
  var g = {};
  base.forEach(function (p) { var k = chave(p); g[k] = g[k] || [0, 0]; g[k][1]++; var s = c.situacao(p); if (s === 'servindo' || s === 'formacao') g[k][0]++; });
  return card(titulo, '', Object.keys(g).sort().map(function (k) {
    return '<div class="crow" style="grid-template-columns:96px 1fr 70px" data-tip="' + esc(k + ': ' + g[k][0] + ' de ' + g[k][1] + ' servem') + '"><span class="lab">' + esc(k) + '</span>' +
      '<span class="track"><span class="fill" style="width:' + pct(g[k][0], g[k][1]) + '%"></span></span><span class="val"><b>' + pct(g[k][0], g[k][1]) + '%</b> ' + g[k][0] + '/' + g[k][1] + '</span></div>';
  }).join(''));
}

/* ---------- linha de pessoa ---------- */
function linhaPessoa(c, p, s, extra, direita) {
  var i = c.idade(p), x = c.selo18(p), ap = c.apto(p);
  var tags = (s ? tagEtapa(s) : '') + (s && s.horario ? tag(s.horario, 'line') : '') + (x ? tag(x.txt, x.cls) : '') +
    (ap.idade || ap.ok ? '' : tagApto(ap)) + (extra || '');
  var tel = p.telefone ? '<a class="tel" href="' + wa(p.telefone) + '" target="_blank" rel="noopener" data-stop="1">WhatsApp</a>' : '<span class="tel">sem telefone</span>';
  return '<div class="item" data-acao="pessoa" data-id="' + p.id + '"><div class="nm"><b>' + esc(nomeFmt(p.nome)) + '</b><span>' + (i !== null ? i + ' anos' : 'idade ?') +
    ' · ' + (p.zfam ? 'ZFAM ' + esc(p.zfam) : 'sem ZFAM') + '</span></div><div class="cs">' + tags + '</div><div class="side-r">' + (direita || '') + tel + '</div></div>';
}
function listaOuVazio(itens, vazio) { return '<div class="list">' + (itens.length ? itens.join('') : '<p class="vazio">' + vazio + '</p>') + '</div>'; }

/* ---------- áreas ---------- */
function vAreas(c) {
  var u = S.r.usuario;
  var vis = c.areas.filter(function (a) { return gestao() || u.areas.indexOf(a.id) >= 0; });
  if (!vis.length) return ph('áreas', 'Nenhuma área', 'Nenhuma área ligada ao seu acesso. Fale com o RH.');
  var semArea = gestao() ? c.servico.filter(function (s) { return !s.area_id && c.porId[s.pessoa_id]; }) : [];
  if (S.area === SEM_AREA && !semArea.length) S.area = null;
  if (!S.area || (S.area !== SEM_AREA && !vis.some(function (a) { return a.id === S.area; }))) S.area = vis[0].id;
  var h = ph(gestao() ? 'áreas executivas' : vis.length > 1 ? 'minhas áreas' : 'minha área', gestao() ? 'Voluntários e trainees por área' : 'Voluntários e trainees', '', '');
  h += '<div class="picks">' + vis.map(function (x) {
    var s = c.statsArea(x);
    return '<button class="' + (x.id === S.area ? 'on' : '') + '" data-acao="area" data-v="' + x.id + '"><span class="dot ' + headCls(x.head) + '"></span>' + esc(x.nome) +
      (s.gap !== null && s.gap < 0 ? '<em>' + s.gap + '</em>' : '') + '</button>';
  }).join('') + (semArea.length ? '<button class="' + (S.area === SEM_AREA ? 'on' : '') + '" data-acao="area" data-v="' + SEM_AREA + '">Sem área definida <em>' + semArea.length + '</em></button>' : '') +
    (gestao() ? '<button data-acao="area-nova">+ área</button>' : '') + '</div>';
  if (S.area === SEM_AREA) return h + vSemArea(c, semArea);
  var a = c.areaId[S.area], st = c.statsArea(a);
  h += '<div class="area-h"><div><h2>' + esc(a.nome) + ' ' + tagHead(a.head) + '</h2><dl>' +
    '<dt>Líderes</dt><dd>' + (esc(a.lideres) || '<span class="falta">a definir</span>') + '</dd>' +
    '<dt>Auxiliar adolescente</dt><dd>' + (esc(a.auxiliar) || '<span class="falta">não tem</span>') + '</dd>' +
    '<dt>Sucessor indicado</dt><dd>' + (esc(a.sucessor) || '<span class="falta">não indicado</span>') + '</dd>' + (a.obs ? '<dt>Obs.</dt><dd>' + esc(a.obs) + '</dd>' : '') + '</dl></div>' +
    (podeArea(a.id) ? '<div class="acts" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-acao="area-editar" data-id="' + a.id + '">Editar área</button>' +
      '<button class="btn" data-acao="trainee-novo" data-v="' + a.id + '">+ trainee</button><button class="btn primary" data-acao="add-area" data-id="' + a.id + '">+ pessoa na área</button></div>' : '') + '</div>';
  var prontos = st.form.filter(function (s) { return s.etapa === 'Trainee 2'; });
  h += '<div class="kpis" style="margin-top:16px">' +
    kpi('Voluntários', st.vol.length, st.ideal !== null ? 'de ' + st.ideal : '', st.ideal === null ? 'ideal a definir (Editar área)' : st.gap < 0 ? 'faltam ' + (-st.gap) : 'área completa', { cls: st.gap < 0 ? 'alerta' : '' }) +
    kpi('Trainees', st.form.length, '', 'Welcome Flow e os 2 dias') +
    kpi('Prontos pra servir', prontos.length, '', 'fizeram os 2 dias', { cls: prontos.length ? 'alerta' : '' }) +
    kpi('18 ou quase', st.vox.length, '', 'transição pro VOX em até 6 meses') + '</div>';
  h += '<div class="filtros" style="margin-top:18px"><div class="seg">' + [['tudo', 'Tudo'], ['vol', 'Voluntários', st.vol.length], ['tr', 'Trainees', st.form.length]].map(function (f) {
    return '<button class="' + (S.areaVer === f[0] ? 'on' : '') + '" data-acao="area-ver" data-v="' + f[0] + '">' + f[1] + (f[2] !== undefined ? ' <em>' + f[2] + '</em>' : '') + '</button>';
  }).join('') + '</div></div>';
  var ordNome = function (l) { return l.slice().sort(function (x, y) { return (c.porId[x.pessoa_id].nome || '').localeCompare(c.porId[y.pessoa_id].nome || ''); }); };
  var ordEtapa = function (l) { return l.slice().sort(function (x, y) { return S.r.etapas.indexOf(y.etapa) - S.r.etapas.indexOf(x.etapa); }); };
  if (S.areaVer !== 'tr') h += secao('Voluntários', 'servindo na escala', listaOuVazio(ordNome(st.vol).map(function (s) { return linhaPessoa(c, c.porId[s.pessoa_id], s); }), 'Ninguém servindo ainda.'));
  if (S.areaVer !== 'vol') h += secao('Trainees', 'no processo: Welcome Flow → 2 dias de trainee → voluntário', listaOuVazio(ordEtapa(st.form).map(function (s) { return linhaTrainee(c, s, true); }), 'Ninguém em formação. Que tal chamar alguém das inscrições?'));
  if (S.areaVer === 'tudo' && st.par.length) h += secao('Parados', 'estão na área mas não servem', listaOuVazio(ordNome(st.par).map(function (s) { return linhaPessoa(c, c.porId[s.pessoa_id], s); }), ''));
  var interessados = (c.d.inscricoes || []).filter(function (i) { return i.area_interesse === a.nome && (i.status === 'Nova' || i.status === 'Aguardando retorno'); });
  if (S.areaVer === 'tudo' && interessados.length) h += secao('Querem servir aqui', 'inscrições abertas', listaOuVazio(interessados.map(function (i) { return linhaInscricao(c, i); }), ''));
  return h;
}
function vSemArea(c, regs) {
  var ord = regs.slice().sort(function (x, y) { return c.porId[x.pessoa_id].nome.localeCompare(c.porId[y.pessoa_id].nome); });
  var areas = c.areas.map(function (a) { return [a.id, a.nome]; });
  return '<div class="area-h"><div><h2>Sem área definida</h2><p class="sub" style="color:var(--muted);margin-top:6px">Estão no processo, mas a área não foi definida. Escolha a área de cada um (a etapa continua a mesma).</p></div></div>' +
    '<div style="margin-top:16px">' + listaOuVazio(ord.map(function (s) {
      return linhaPessoa(c, c.porId[s.pessoa_id], s, '<span data-stop="1"><select data-acao="definir-area" data-servico="' + s.id + '">' + opts(areas, '', 'escolher a área…') + '</select></span>');
    }), '') + '</div>';
}

/* ---------- trainees ---------- */
function linhaTrainee(c, s, semArea) {
  var p = c.porId[s.pessoa_id], pp = proximoPasso(c, s), i = c.idade(p), ap = c.apto(p);
  var datas = [s.welcome ? 'WF ' + fmtCurta(s.welcome) : '', s.dia1 ? 'dia 1 ' + fmtCurta(s.dia1) : '', s.dia2 ? 'dia 2 ' + fmtCurta(s.dia2) : ''].filter(Boolean).join(' · ');
  var tags = tagEtapa(s) + (semArea ? '' : tag(nomeArea(c, s.area_id), s.area_id ? 'line' : 'warn')) + (s.horario ? tag(s.horario, 'line', 'horário em que serve') : tag('horário ?', 'par', 'horário a definir')) +
    (ap.ok || ap.idade ? '' : tagApto(ap)) + (s.origem === 'inboard' ? tag('Onboard', 'line', 'veio do formulário Onboard') : '');
  var botao = s.etapa === 'Trainee 2' && podeArea(s.area_id) && s.area_id ? '<button class="btn sm accent" data-acao="virar-voluntario" data-v="' + s.id + '">Virar voluntário</button>' :
    s.etapa !== 'Trainee 2' && podeArea(s.area_id) && s.area_id ? '<button class="btn sm" data-acao="avancar" data-v="' + s.id + '">' + (s.etapa === 'Onboard' ? 'Fez o dia 1' : 'Fez o dia 2') + '</button>' : '';
  var tel = p.telefone ? '<a class="tel" href="' + wa(p.telefone) + '" target="_blank" rel="noopener" data-stop="1">WhatsApp</a>' : '';
  return '<div class="item" data-acao="pessoa" data-id="' + p.id + '"><div class="nm"><b>' + esc(nomeFmt(p.nome)) + '</b><span>' + (i !== null ? i + ' anos · ' : '') +
    (p.zfam ? 'ZFAM ' + esc(p.zfam) : 'sem ZFAM') + (datas ? ' · ' + datas : '') + '</span></div>' +
    '<div><div class="cs">' + tags + '</div><div class="proximo" style="margin-top:4px">' + (pp.pronto ? '<b>' + esc(pp.txt) + '</b>' : esc(pp.txt)) + '</div></div>' +
    '<div class="side-r" data-stop="1">' + botao + tel + '</div></div>';
}
function vTrainees(c) {
  var u = S.r.usuario;
  var base = c.trainees.filter(function (s) { return gestao() || u.areas.indexOf(s.area_id) >= 0; });
  var areasVis = c.areas.filter(function (a) { return podeArea(a.id); });
  var cont = { todas: base.length, 'Onboard': 0, 'Trainee 1': 0, 'Trainee 2': 0 };
  base.forEach(function (s) { cont[s.etapa]++; });
  var lst = base.filter(function (s) { return (S.trEtapa === 'todas' || s.etapa === S.trEtapa) && (!S.trArea || s.area_id === S.trArea || (S.trArea === SEM_AREA && !s.area_id)); })
    .sort(function (a, b) { return S.r.etapas.indexOf(b.etapa) - S.r.etapas.indexOf(a.etapa) || (c.porId[a.pessoa_id].nome || '').localeCompare(c.porId[b.pessoa_id].nome || ''); });
  var h = ph('trainees', 'Trainees', 'Quem fez o Welcome Flow e está nos 2 dias de trainee. Depois do 2º dia, a pessoa pode começar como voluntária: fale com o líder da área e clique em "Virar voluntário".',
    (areasVis.length ? '<button class="btn primary" data-acao="trainee-novo" data-v="">+ trainee</button>' : '') + (gestao() && S.r.inboard ? '<button class="btn" data-acao="sync-inboard">Ler o Onboard</button>' : ''));
  h += '<div class="kpis">' + kpi('No processo', base.length, '', 'Welcome Flow e trainees') + kpi('Welcome Flow', cont['Onboard'], '', 'esperando o 1º dia') +
    kpi('Dia 1 feito', cont['Trainee 1'], '', 'falta o 2º dia') + kpi('Prontos pra servir', cont['Trainee 2'], '', 'fizeram os 2 dias', { cls: cont['Trainee 2'] ? 'alerta' : '' }) + '</div>';
  var prontos = base.filter(function (s) { return s.etapa === 'Trainee 2' && (!S.trArea || s.area_id === S.trArea || (S.trArea === SEM_AREA && !s.area_id)); });
  if (prontos.length && S.trEtapa === 'todas') {
    h += secao('Prontos pra começar como voluntário', 'Já serviram os 2 dias. Falar com o líder da área e passar pra escala.',
      listaOuVazio(prontos.map(function (s) { return linhaTrainee(c, s); }), ''));
    lst = lst.filter(function (s) { return s.etapa !== 'Trainee 2'; });     // não repete quem já está aí em cima
  }
  h += '<div class="sec"><div class="filtros"><div class="seg">' + [['todas', 'Todos'], ['Onboard', 'Welcome Flow'], ['Trainee 1', 'Dia 1'], ['Trainee 2', 'Dia 2']].map(function (f) {
    return '<button class="' + (S.trEtapa === f[0] ? 'on' : '') + '" data-acao="tr-etapa" data-v="' + f[0] + '">' + f[1] + ' <em>' + cont[f[0]] + '</em></button>';
  }).join('') + '</div>' + (areasVis.length > 1 || gestao() ? '<select data-acao="tr-area" aria-label="Filtrar por área">' +
    opts(areasVis.map(function (a) { return [a.id, a.nome]; }).concat(gestao() ? [[SEM_AREA, 'Sem área definida']] : []), S.trArea, 'Todas as áreas') + '</select>' : '') + '</div>' +
    (S.trEtapa === 'todas' && prontos.length ? '<div class="sec-h"><h2>Em andamento</h2></div>' : '') +
    listaOuVazio(lst.map(function (s) { return linhaTrainee(c, s); }), 'Ninguém aqui.') + '</div>';
  if (gestao() && !S.r.inboard) h += '<p class="kpi-d" style="margin-top:14px">O formulário Onboard ainda não está ligado: quando estiver, as respostas novas entram aqui sozinhas.</p>';
  return h;
}

/* ---------- ZFAMs ---------- */
function grupoZfam(c, p) { if (!p.zfam) return ''; return (c.d.zfams || []).some(function (z) { return z.lider === p.zfam; }) ? p.zfam : A_CONFIRMAR; }
function nomeGrupo(k) { return k === '' ? 'Sem ZFAM' : k === A_CONFIRMAR ? 'ZFAM a confirmar' : k; }
function zfamsResumo(c) {
  var g = {};
  (c.d.zfams || []).forEach(function (z) { g[z.lider] = { lider: z.lider, z: z, total: 0, serv: 0, aptos: 0 }; });
  c.pessoas.forEach(function (p) {
    var k = grupoZfam(c, p);
    if (!g[k]) g[k] = { lider: k, z: null, total: 0, serv: 0, aptos: 0 };
    g[k].total++;
    var s = c.situacao(p);
    if (s === 'servindo' || s === 'formacao') g[k].serv++; else if (c.apto(p).ok) g[k].aptos++;
  });
  if (!gestao()) Object.keys(g).forEach(function (k) { if (S.r.usuario.zfams.indexOf(k) < 0) delete g[k]; });
  var fim = function (l) { return l === '' || l === A_CONFIRMAR ? 1 : 0; };
  return Object.keys(g).map(function (k) { return g[k]; }).filter(function (z) { return z.total || z.z; })
    .sort(function (a, b) { return fim(a.lider) - fim(b.lider) || pct(b.serv, b.total) - pct(a.serv, a.total) || b.total - a.total; });
}
function vZfams(c) {
  var zs = zfamsResumo(c);
  if (!zs.length) return ph('ZFAMs', 'Nenhum ZFAM', 'Nenhum ZFAM ligado ao seu acesso. Fale com o RH.');
  if (S.zfam === null || !zs.some(function (z) { return z.lider === S.zfam; })) S.zfam = zs[0].lider;
  var z = zs.filter(function (x) { return x.lider === S.zfam; })[0];
  var h = ph('ZFAM × serviço', 'Quem serve e quem ainda não serve', 'Pra servir: estar num ZFAM e ter 6 meses ou mais de Flow.');
  if (zs.length > 1) h += '<div class="picks">' + zs.map(function (x) {
    return '<button class="' + (x.lider === z.lider ? 'on' : '') + '" data-acao="zfam" data-v="' + esc(x.lider) + '">' + esc(nomeGrupo(x.lider)) + ' <em>' + pct(x.serv, x.total) + '%</em></button>';
  }).join('') + '</div>';
  var info = z.z || {}, real = z.lider !== '' && z.lider !== A_CONFIRMAR;
  var explica = z.lider === '' ? 'Quem não está em ZFAM não pode servir. Vale encaminhar pra um.' :
    'O ZFAM dessas pessoas foi escrito à mão (ou não foi dito qual) e não bate com nenhum líder da lista. Abra cada uma e corrija.';
  h += '<div class="area-h"><div><h2>' + esc(nomeGrupo(z.lider)) + '</h2>' + (real ? '<dl><dt>Auxiliar</dt><dd>' + (esc(info.auxiliar) || '—') + '</dd><dt>Encontro</dt><dd>' +
    (esc(info.dia) || 'dia ?') + (info.horario ? ', ' + esc(info.horario) : '') + '</dd><dt>Servindo</dt><dd>' + z.serv + ' de ' + z.total + ' (' + pct(z.serv, z.total) + '%)</dd></dl>' :
    '<p style="color:var(--muted);margin-top:6px">' + explica + '</p>') + '</div>' +
    (gestao() && real ? '<button class="btn" data-acao="zfam-editar" data-v="' + esc(z.lider) + '">Editar ZFAM</button>' : '') + '</div>';
  var ps = c.pessoas.filter(function (p) { return grupoZfam(c, p) === z.lider; }).sort(function (a, b) { return a.nome.localeCompare(b.nome); });
  var serv = [], form = [], aptos = [], nao = [], conf = [];
  ps.forEach(function (p) {
    var s = c.situacao(p), ap = c.apto(p);
    if (s === 'servindo') serv.push(p); else if (s === 'formacao') form.push(p); else if (ap.ok) aptos.push(p); else if (ap.ok === null) conf.push(p); else nao.push(p);
  });
  var onde = function (p) { return (c.serv[p.id] || []).map(function (s) { return tag(nomeArea(c, s.area_id), 'line') + tagEtapa(s); }).join(''); };
  h += secao('Servindo', '', listaOuVazio(serv.map(function (p) { return linhaPessoa(c, p, null, onde(p)); }), 'Ninguém deste ZFAM serve ainda.'));
  h += secao('Em formação', 'Welcome Flow e trainees', listaOuVazio(form.map(function (p) { return linhaPessoa(c, p, null, onde(p)); }), 'Ninguém em formação.'));
  h += secao('Não serve · pode convidar', 'em ZFAM e com 6 meses ou mais', listaOuVazio(aptos.map(function (p) { return linhaPessoa(c, p, null, tag('pode servir', 'ok')); }), 'Todo mundo apto já serve.'));
  if (conf.length) h += secao('Não serve · falta confirmar', 'a chegada (a base só tem o ano) ou o ZFAM', listaOuVazio(conf.map(function (p) { return linhaPessoa(c, p); }), ''));
  if (nao.length) h += secao('Não serve · ainda não pode', 'menos de 6 meses de Flow, sem ZFAM ou já com 18', listaOuVazio(nao.map(function (p) { return linhaPessoa(c, p); }), ''));
  return h;
}

/* ---------- inscrições ---------- */
function jaServe(c, i) {
  var p = i.pessoa_id && c.porId[i.pessoa_id];
  if (!p) return '';
  return (c.serv[p.id] || []).filter(function (s) { return s.status !== 'Parado'; }).map(function (s) { return nomeArea(c, s.area_id); }).join(', ');
}
function linhaInscricao(c, i) {
  var serve = jaServe(c, i), anos = i.nascimento ? Math.floor(mesesEntre(dt(i.nascimento), c.hoje) / 12) : null;
  var cls = { 'Nova': 'warn', 'Aguardando retorno': 'wf', 'Encaminhada': 'ok', 'Não vai servir': 'par' }[i.status] || '';
  var cad = i.pessoa_id && c.porId[i.pessoa_id], apt;
  if (cad) apt = tagApto(c.apto(cad));
  else apt = i.em_zfam !== 'Sim' ? tag('sem ZFAM', 'bad') : i.tempo_flow === 'menos de 6 meses' && mesesEntre(dt(i.data), c.hoje) < 6 ? tag('menos de 6 meses', 'bad') : tag('pode servir', 'ok');
  return '<div class="item" data-acao="inscricao" data-id="' + i.id + '"><div class="nm"><b>' + esc(nomeFmt(i.nome)) + '</b><span>' + (anos !== null ? anos + ' anos · ' : '') +
    'inscrição em ' + fmtData(i.data) + (i.tempo_flow ? ' · ' + esc(i.tempo_flow) : '') + '</span></div><div class="cs">' + tag(i.status, cls) +
    (serve ? tag('já serve: ' + serve, 'vol') : apt) + (i.area_interesse ? tag(i.area_interesse, 'line') : '') +
    (i.ministerio && i.ministerio !== 'Áreas Executivas' ? tag(i.ministerio, 'line') : '') + (i.lider_zfam ? tag('ZFAM ' + i.lider_zfam, 'line') : '') + '</div>' +
    '<div class="side-r">' + (i.whatsapp ? '<a class="tel" href="' + wa(i.whatsapp) + '" target="_blank" rel="noopener" data-stop="1">WhatsApp</a>' : '') + '</div></div>';
}
function vInscricoes(c) {
  var todas = (c.d.inscricoes || []).slice().sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });
  var base = todas.filter(function (i) { return !S.soAE || i.ministerio === 'Áreas Executivas' || i.area_interesse; });
  var lst = base.filter(function (i) { return S.filtroInsc === 'todas' || i.status === S.filtroInsc; });
  var h = ph('quem quer servir', 'Inscrições', 'Do formulário do site. Abra uma inscrição pra mudar o status ou encaminhar pro Welcome Flow de uma área.',
    '<button class="btn" data-acao="link-form">Copiar link do formulário</button><button class="btn" data-acao="perguntas" data-v="inscricao">Editar perguntas</button>');
  h += '<div class="filtros"><div class="seg">' + S.r.statusInscricao.concat(['todas']).map(function (s) {
    var n = s === 'todas' ? base.length : base.filter(function (i) { return i.status === s; }).length;
    return '<button class="' + (S.filtroInsc === s ? 'on' : '') + '" data-acao="filtro-insc" data-v="' + s + '">' + (s === 'todas' ? 'Todas' : s) + ' <em>' + n + '</em></button>';
  }).join('') + '</div><label class="checks"><label><input type="checkbox" data-acao="so-ae"' + (S.soAE ? ' checked' : '') + '> só Áreas Executivas</label></label></div>';
  return h + listaOuVazio(lst.map(function (i) { return linhaInscricao(c, i); }), 'Nada aqui.');
}

/* ---------- adolescentes ---------- */
function vPessoas(c) {
  var F = {
    todos: ['Todos', function () { return true; }],
    servindo: ['Servindo', function (p) { return c.situacao(p) === 'servindo'; }],
    formacao: ['Em formação', function (p) { return c.situacao(p) === 'formacao'; }],
    parado: ['Parados', function (p) { return c.situacao(p) === 'parado'; }],
    convidar: ['Pode convidar', function (p) { return c.situacao(p) === 'nao' && c.apto(p).ok; }],
    semzfam: ['Sem ZFAM', function (p) { return !p.zfam; }],
    zfamconf: ['ZFAM a confirmar', function (p) { return p.zfam && !c.zfamConhecido(p); }],
    vox: ['18 ou quase', function (p) { var x = c.selo18(p); return x && x.ordem <= 1; }]
  };
  var q = norm(S.busca).join(' ');
  var lst = c.pessoas.filter(F[S.filtroPessoas][1]).filter(function (p) { return !q || norm(p.nome).join(' ').indexOf(q) >= 0 || norm(p.zfam).join(' ').indexOf(q) >= 0; })
    .sort(function (a, b) { return a.nome.localeCompare(b.nome); });
  var h = ph('todo mundo', 'Adolescentes', c.pessoas.length + ' no cadastro.', '<button class="btn primary" data-acao="pessoa-nova">+ adolescente</button>');
  h += '<div class="filtros"><input type="search" data-acao="busca" placeholder="Buscar por nome ou ZFAM" value="' + esc(S.busca) + '" aria-label="Buscar"><div class="seg">' + Object.keys(F).map(function (k) {
    return '<button class="' + (S.filtroPessoas === k ? 'on' : '') + '" data-acao="filtro-pessoas" data-v="' + k + '">' + F[k][0] + ' <em>' + c.pessoas.filter(F[k][1]).length + '</em></button>';
  }).join('') + '</div></div>';
  return h + listaOuVazio(lst.slice(0, 300).map(function (p) { return linhaPessoa(c, p, null, (c.serv[p.id] || []).map(tagEtapa).join('')); }), 'Ninguém encontrado.');
}

/* ---------- CREW FLOW: carga por responsabilidade ---------- */
function peso(nivel) { return Number((S.r.pesos || {})[nivel]) || 0; }
function lerPapeis(json) {
  var v = jsonObj(json, []);
  var antigo = { core: ['min:Flow (geral)', 'Core'], head_mm: ['min:AE Multimídia', 'Head'], head_rh: ['min:AE RH', 'Head'], head_op: ['min:AE Operações', 'Head'] };
  return (Array.isArray(v) ? v : []).map(function (p) {
    var onde = String(p.onde || ''), nivel = p.nivel || ({ 'Sirvo': 'Voluntário', 'Líder': 'Líder', 'Auxiliar': 'Auxiliar' }[p.funcao] || '');
    if (antigo[onde]) { nivel = antigo[onde][1]; onde = antigo[onde][0]; }
    return { onde: onde, nivel: nivel, zfam: p.zfam || '', texto: p.texto || '' };
  }).filter(function (p) { return p.onde && p.nivel; });
}
function lugarDe(c, p) { return p.onde === 'zfam' ? 'ZFAM ' + p.zfam : p.onde.indexOf('min:') === 0 ? p.onde.slice(4) : nomeArea(c, p.onde); }
/** O que a pessoa faz em cada lugar: o que ela declarou + o que as planilhas dizem (Core, Heads, líderes de área e de ZFAM)
 *  + as áreas e ministérios marcados. Em cada lugar vale a maior responsabilidade. A carga é a soma dos pesos. */
function funcoesDe(c, e, todos) {
  var mapa = {}, ordem = [];
  function por(chave, lugar, nivel, fonte) {
    if (!peso(nivel)) return;
    var at = mapa[chave];
    if (!at) { ordem.push(chave); mapa[chave] = { lugar: lugar, nivel: nivel, fonte: fonte }; }
    else if (peso(nivel) > peso(at.nivel)) { at.nivel = nivel; at.fonte = fonte; }
  }
  lerPapeis(e.funcoes).forEach(function (p) { por(p.onde === 'zfam' ? 'zfam:' + p.zfam : p.onde, lugarDe(c, p), p.nivel, 'declarado'); });
  var primeiros = {};
  todos.forEach(function (x) { var k = norm(x.nome)[0]; primeiros[k] = (primeiros[k] || 0) + 1; });
  var amb = function (curto) { var a = norm(curto); return a.length === 1 && primeiros[a[0]] > 1; };
  var HEAD = { 'Head MM': 'AE Multimídia', 'Head RH': 'AE RH', 'Head OP': 'AE Operações' };
  (S.r.lideranca || []).forEach(function (l) {
    if (!nomeBate(l[0], e.nome, amb(l[0]))) return;
    if (l[1] === 'Core') por('min:Flow (geral)', 'Flow (geral)', 'Core', 'planilha');
    else if (HEAD[l[1]]) por('min:' + HEAD[l[1]], HEAD[l[1]], 'Head', 'planilha');
  });
  c.areas.forEach(function (a) {
    String(a.lideres || '').split(/,| e /).map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (n) {
      if (nomeBate(n, e.nome, amb(n))) por(a.id, a.nome, 'Líder', 'planilha');
    });
  });
  (c.d.zfams || []).forEach(function (z) {
    if (z.lider && nomeBate(z.lider, e.nome, amb(z.lider))) por('zfam:' + z.lider, 'ZFAM ' + z.lider, 'Líder', 'planilha');
    if (z.auxiliar && nomeBate(z.auxiliar, e.nome, amb(z.auxiliar))) por('zfam:' + z.lider, 'ZFAM ' + z.lider, 'Auxiliar', 'planilha');
  });
  lista(e.areas_ae).forEach(function (id) { if (c.areaId[id]) por(id, nomeArea(c, id), 'Voluntário', 'marcado'); });
  var temZfam = ordem.some(function (k) { return k.indexOf('zfam:') === 0; });
  var headDe = { 'AE Multimídia': 'MM', 'AE Operações': 'OP' };
  lista(e.ministerios).forEach(function (m) {
    if (m === 'ZFAM' && temZfam) return;
    if (headDe[m] && ordem.some(function (k) { return c.areaId[k] && c.areaId[k].head === headDe[m]; })) return;
    por('min:' + m, m, 'Voluntário', 'marcado');
  });
  var lst = ordem.map(function (k) { return mapa[k]; }).sort(function (a, b) { return peso(b.nivel) - peso(a.nivel); });
  var carga = lst.reduce(function (t, f) { return t + peso(f.nivel); }, 0);
  var nivel = carga >= (S.r.cargaAlta || 5) ? 'alta' : carga <= (S.r.cargaLeve || 2) ? 'leve' : 'media';
  return { lst: lst, carga: carga, nivel: nivel };
}
function barrinhas(f) {
  var n = Math.min(Math.max(4, f.carga), 12), on = Math.min(f.carga, 12);
  var r = '';
  for (var k = 1; k <= n; k++) r += '<i class="' + (k <= on ? 'on' : '') + '"></i>';
  var txt = { alta: 'sobrecarregado', media: 'equilibrado', leve: 'com espaço' }[f.nivel];
  return '<span class="carga ' + f.nivel + '" data-tip="' + esc('Carga ' + f.carga + ' (' + txt + '): ' + (f.lst.map(function (x) { return x.nivel + ' · ' + x.lugar + ' (' + peso(x.nivel) + ')'; }).join(', ') || 'nada marcado')) + '">' + r + '</span>' +
    '<span class="carga-n">' + f.carga + '</span>';
}
function acessoDoAdulto(c, e) {
  var email = String(e.email || '').toLowerCase();
  return (c.d.acessos || []).filter(function (a) { return (a.equipe_id && a.equipe_id === e.id) || (email && String(a.email).toLowerCase() === email); })[0];
}
function infoCrew(c) {
  var eq = (c.d.equipe || []).slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); });
  return eq.map(function (e) { return { e: e, f: funcoesDe(c, e, eq), acesso: acessoDoAdulto(c, e) }; });
}
function vCrew(c) {
  var cad = c.d.cadastros || [], ac = c.d.acessos || [];
  var pend = cad.filter(function (x) { return x.status === 'Pendente'; }).length;
  var info = infoCrew(c);
  var subs = [['pessoas', 'Pessoas', info.length], ['carga', 'Carga'], ['pedidos', 'Pedidos de acesso', pend], ['acessos', 'Acessos ao painel', ac.length]];
  var h = ph('só Core e Heads', 'CREW FLOW', 'Os adultos que servem no Flow. Vem do Tally e do cadastro do site, e se completa sozinho.',
    '<button class="btn" data-acao="link-cadastro">Copiar link do cadastro</button><button class="btn" data-acao="perguntas" data-v="cadastro">Editar perguntas</button>');
  h += '<div class="filtros"><div class="seg">' + subs.map(function (s) {
    return '<button class="' + (S.crew === s[0] ? 'on' : '') + '" data-acao="crew" data-v="' + s[0] + '">' + s[1] + (s[2] !== undefined ? ' <em>' + s[2] + '</em>' : '') + '</button>';
  }).join('') + '</div></div>';
  return h + { pessoas: crewPessoas, carga: crewCarga, pedidos: crewPedidos, acessos: crewAcessos }[S.crew](c, info);
}
function linhaAdulto(c, x) {
  var e = x.e;
  return '<div class="item" data-acao="adulto" data-id="' + e.id + '"><div class="nm"><b>' + esc(nomeFmt(e.nome)) + '</b><span>' + barrinhas(x.f) + '</span></div>' +
    '<div class="cs">' + x.f.lst.slice(0, 6).map(function (f) { return tag(f.nivel + ' · ' + f.lugar, f.nivel === 'Voluntário' ? 'line' : f.nivel === 'Auxiliar' ? '' : 'navy'); }).join('') +
    (x.f.lst.length > 6 ? tag('+' + (x.f.lst.length - 6), 'line') : '') + (x.acesso ? tag('acesso ao painel', 'ok') : '') + '</div>' +
    '<div class="side-r">' + (e.telefone ? '<a class="tel" href="' + wa(e.telefone) + '" target="_blank" rel="noopener" data-stop="1">WhatsApp</a>' : '') + '</div></div>';
}
function crewPessoas(c, info) {
  var mins = {};
  info.forEach(function (x) { x.f.lst.forEach(function (f) { mins[f.lugar] = (mins[f.lugar] || 0) + 1; }); });
  var filtro = S.filtroEquipe, q = norm(S.buscaEquipe).join(' ');
  var lst = info.filter(function (x) {
    if (q && norm(x.e.nome).join(' ').indexOf(q) < 0) return false;
    if (!filtro) return true;
    if (filtro === '__lid') return x.f.lst.some(function (f) { return f.nivel !== 'Voluntário'; });
    if (filtro === '__acesso') return !!x.acesso;
    return x.f.lst.some(function (f) { return f.lugar === filtro; });
  });
  var lugares = Object.keys(mins).sort(function (a, b) { return mins[b] - mins[a]; });
  var h = '<div class="kpis" style="margin-bottom:16px">' + kpi('Adultos servindo', info.length, '', 'Tally + cadastro do site') +
    kpi('Com liderança', info.filter(function (x) { return x.f.lst.some(function (f) { return f.nivel !== 'Voluntário'; }); }).length, '', 'Core, Head, líder ou auxiliar') +
    kpi('Sobrecarregados', info.filter(function (x) { return x.f.nivel === 'alta'; }).length, '', 'carga ' + (S.r.cargaAlta || 5) + ' ou mais', { acao: 'crew', v: 'carga', cls: 'alerta' }) +
    kpi('Com espaço', info.filter(function (x) { return x.f.nivel === 'leve'; }).length, '', 'carga até ' + (S.r.cargaLeve || 2), { acao: 'crew', v: 'carga' }) + '</div>';
  h += '<div class="filtros"><input type="search" data-acao="busca-equipe" placeholder="Buscar adulto" value="' + esc(S.buscaEquipe) + '" aria-label="Buscar adulto">' +
    '<select data-acao="filtro-equipe" aria-label="Filtrar">' + opts([['__lid', 'Com liderança'], ['__acesso', 'Com acesso ao painel']].concat(lugares.map(function (l) { return [l, l + ' (' + mins[l] + ')']; })), filtro, 'Todos os lugares') + '</select>' +
    '<button class="btn" data-acao="adulto-novo">+ adulto</button></div>';
  return h + listaOuVazio(lst.map(function (x) { return linhaAdulto(c, x); }), 'Ninguém aqui.');
}
function crewCarga(c, info) {
  var alta = info.filter(function (x) { return x.f.nivel === 'alta'; }).sort(function (a, b) { return b.f.carga - a.f.carga; });
  var leve = info.filter(function (x) { return x.f.nivel === 'leve'; }).sort(function (a, b) { return a.f.carga - b.f.carga || a.e.nome.localeCompare(b.e.nome); });
  var pesos = S.r.pesos || {};
  var leg = '<div class="card" style="margin-bottom:16px"><div class="card-b" style="display:flex;gap:18px;flex-wrap:wrap;align-items:center;font-size:13px">' +
    '<span style="color:var(--muted)">Cada lugar soma o peso da responsabilidade:</span>' +
    (S.r.niveis || []).map(function (n) { return '<span><b>' + n + '</b> ' + pesos[n] + '</span>'; }).join('') +
    '<span style="color:var(--muted)">Ex.: Head (3) + voluntário em outra área (1) = 4.</span></div></div>';
  var col = function (titulo, sub, l, vazio) { return card(titulo, sub, l.length ? '<div class="list" style="border:0;background:none">' + l.map(function (x) { return linhaAdulto(c, x); }).join('') + '</div>' : '<p class="vazio">' + vazio + '</p>'); };
  return leg + '<div class="grid-2">' + col('Mais sobrecarregados', 'carga ' + (S.r.cargaAlta || 5) + ' ou mais · ' + alta.length, alta, 'Ninguém sobrecarregado.') +
    col('Menos sobrecarregados', 'carga até ' + (S.r.cargaLeve || 2) + ' · ' + leve.length + ' · podem assumir mais', leve, 'Ninguém com pouca carga.') + '</div>';
}
function descPapel(c, p) { return p.nivel + ' · ' + lugarDe(c, p); }
function conferir(c, x) {
  var ok = [], nao = [];
  lerPapeis(x.papeis).forEach(function (p) {
    var nomes = null;
    if (p.nivel === 'Voluntário') return;
    if (p.onde === 'zfam') { var z = (c.d.zfams || []).filter(function (q) { return q.lider === p.zfam; })[0]; nomes = z ? [z.lider, z.auxiliar] : []; }
    else if (c.areaId[p.onde]) { var a = c.areaId[p.onde]; nomes = String(a.lideres || '').split(/,| e /).concat([a.auxiliar]); }
    else if (p.nivel === 'Core' || p.nivel === 'Head') {
      var alvo = p.nivel;
      nomes = (S.r.lideranca || []).filter(function (l) { return String(l[1]).indexOf(alvo) === 0; }).map(function (l) { return l[0]; });
    }
    if (!nomes) return;
    (nomes.some(function (n) { return n && nomeBate(String(n).trim(), x.nome); }) ? ok : nao).push(descPapel(c, p));
  });
  var e = (c.d.equipe || []).filter(function (q) { return q.id === x.equipe_id; })[0];
  var dig = function (t) { return String(t || '').replace(/\D/g, '').slice(-11); };
  return { ok: ok, nao: nao, emailCrew: e && e.email && String(e.email).toLowerCase() !== String(x.email).toLowerCase() ? e.email : '',
           telCrew: e && e.telefone && x.telefone && dig(e.telefone) !== dig(x.telefone) ? e.telefone : '',
           nomeCrew: e && norm(e.nome).join(' ') !== norm(x.nome).join(' ') ? e.nome : '' };
}
var COR_PEDIDO = { 'Pendente': 'warn', 'Aprovado': 'ok', 'Aprovado (automático)': 'ok', 'Recusado': 'bad', 'Só cadastro': 'par', 'Já tinha acesso': 'ok' };
function crewPedidos(c) {
  var todos = (c.d.cadastros || []).slice().sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });
  var lst = S.filtroPedidos === 'todos' ? todos : todos.filter(function (x) { return x.status === 'Pendente'; });
  var h = '<p class="sub" style="color:var(--muted);margin-bottom:12px;max-width:760px">Quem se cadastrou pelo site. Líder ou auxiliar com o mesmo e-mail do Tally e o nome igual ao da planilha é liberado sozinho. ' +
    'O resto espera aqui. Ao aprovar, a pessoa recebe um e-mail e entra com o e-mail e a senha dela.</p>' +
    '<div class="filtros"><div class="seg">' + [['Pendente', 'Esperando você'], ['todos', 'Todos']].map(function (f) {
      var n = f[0] === 'todos' ? todos.length : todos.filter(function (x) { return x.status === 'Pendente'; }).length;
      return '<button class="' + (S.filtroPedidos === f[0] ? 'on' : '') + '" data-acao="filtro-pedidos" data-v="' + f[0] + '">' + f[1] + ' <em>' + n + '</em></button>';
    }).join('') + '</div></div>';
  return h + listaOuVazio(lst.map(function (x) {
    var conf = conferir(c, x);
    return '<div class="item" data-acao="pedido" data-id="' + x.id + '"><div class="nm"><b>' + esc(nomeFmt(x.nome)) + '</b><span>' + fmtDataHora(x.data) + ' · ' + esc(x.email) + '</span></div>' +
      '<div class="cs">' + tag(x.status, COR_PEDIDO[x.status]) + lerPapeis(x.papeis).map(function (p) { return tag(descPapel(c, p), p.nivel === 'Voluntário' ? 'line' : 'navy'); }).join('') +
      (conf.nao.length ? tag('não bate com a planilha', 'bad') : conf.ok.length ? tag('bate com a planilha', 'ok') : '') +
      (conf.emailCrew ? tag('e-mail diferente do Tally', 'bad') : '') + '</div><div class="side-r">' +
      (x.telefone ? '<a class="tel" href="' + wa(x.telefone) + '" target="_blank" rel="noopener" data-stop="1">WhatsApp</a>' : '') + '</div></div>';
  }), S.filtroPedidos === 'todos' ? 'Ninguém se cadastrou pelo site ainda.' : 'Nenhum pedido esperando.');
}
function crewAcessos(c) {
  var ordem = { core: 0, head: 1 };
  var ac = (c.d.acessos || []).slice().sort(function (a, b) {
    return (a.criado_por === 'teste' ? -1 : 0) - (b.criado_por === 'teste' ? -1 : 0) || (ordem[a.perfil] === undefined ? 2 : ordem[a.perfil]) - (ordem[b.perfil] === undefined ? 2 : ordem[b.perfil]) || a.nome.localeCompare(b.nome);
  });
  var h = '<div class="filtros"><button class="btn primary" data-acao="acesso-novo">+ criar acesso</button><span class="sub" style="color:var(--muted);font-size:13px">"Ver como" abre o painel do jeito que a pessoa vê. Quem é Head não vê o código de quem é Core.</span></div>';
  return h + '<div class="tbl-wrap"><table class="tbl"><tr><th>Nome</th><th>Perfil</th><th>O que vê</th><th>E-mail</th><th>Código</th><th></th></tr>' + ac.map(function (a) {
    var es = escopoDe(a), lider = PERFIL[a.perfil] === 'Liderança', eu = S.r.usuario.nome === a.nome && a.codigo;
    return '<tr><td><b>' + esc(a.nome) + '</b>' + (a.criado_por === 'teste' ? ' ' + tag('teste', 'warn') : '') + '</td>' +
      '<td>' + esc(PERFIL[a.perfil] || a.perfil) + '</td><td>' + (lider ? esc(escopoTexto(c, es.areas, es.zfams)) || tag('nada', 'bad') : 'tudo') + '</td>' +
      '<td>' + (esc(a.email) || '<span style="color:var(--muted)">—</span>') + '</td>' +
      '<td>' + (a.codigo ? '<button class="btn sm" data-acao="ver-codigo" data-v="' + esc(a.codigo) + '">mostrar</button>' : '<span style="color:var(--muted)">só Core vê</span>') + '</td>' +
      '<td><div class="acts">' + (a.codigo && !eu && !S.voltar ? '<button class="btn sm" data-acao="ver-como" data-v="' + esc(a.codigo) + '">ver como</button>' : '') +
      (a.codigo && a.telefone ? '<a class="btn sm" href="' + esc(waMsg(a.telefone, mensagemAcesso(a))) + '" target="_blank" rel="noopener" data-stop="1">WhatsApp</a>' : '') +
      (a.codigo && a.email ? '<button class="btn sm" data-acao="acesso-reenviar" data-v="' + esc(a.codigo) + '">e-mail</button>' : '') +
      (a.codigo ? '<button class="btn sm" data-acao="acesso" data-v="' + esc(a.codigo) + '">editar</button>' : '') +
      (a.codigo && !eu ? '<button class="btn sm danger" data-acao="acesso-apagar" data-v="' + esc(a.codigo) + '">apagar</button>' : '') + '</div></td></tr>';
  }).join('') + '</table></div>';
}
function urlSite() { return location.origin + location.pathname; }
function mensagemAcesso(a) {
  return 'Oi, ' + primeiroNome(a.nome) + '! Seu acesso ao painel das Áreas Executivas do Flow está liberado: ' + urlSite() +
    '\n\nNo primeiro acesso, clique em "Primeiro acesso ou esqueci a senha", confirme o seu e-mail e crie a sua senha. Depois é só e-mail e senha.' +
    (a.codigo ? '\nSe preferir, entre com o seu código pessoal: ' + a.codigo : '');
}

/* ---------- gaveta (detalhes e formulários) ---------- */
function abrirModal(tipo, id, refresh) {
  S.modal = { tipo: tipo, id: id };
  var c = C(), html = { pessoa: mPessoa, inscricao: mInscricao, area: mArea, meta: mMeta, zfam: mZfam, adulto: mAdulto, addArea: mAddArea, trainee: mTrainee,
                        pedido: mPedido, acesso: mAcesso, codigo: mCodigo, perguntas: mPerguntas, sync: mSync }[tipo](c, id);
  var m = document.getElementById('drawer');
  var gaveta = m.querySelector('.drawer'), rol = refresh && gaveta ? gaveta.scrollTop : 0;
  m.innerHTML = '<div class="drawer-bg" data-acao="fundo"><div class="drawer" role="dialog" aria-modal="true">' + html + '</div></div>';
  if (rol) m.querySelector('.drawer').scrollTop = rol;
  if (!refresh) { var f = m.querySelector('.drawer-b input:not([type=hidden]), .drawer .x'); if (f) f.focus(); }
}
function fecharModal() { S.modal = null; S.perguntas = null; var m = document.getElementById('drawer'); if (m) m.innerHTML = ''; }
function cab(eyebrow, titulo, tags) {
  return '<div class="drawer-h"><div class="tt"><p class="eyebrow">' + eyebrow + '</p><h2>' + titulo + '</h2>' + (tags ? '<div class="tags">' + tags + '</div>' : '') + '</div>' +
    '<button class="x" data-acao="fechar" aria-label="Fechar">×</button></div>';
}
function info(l) { return '<div class="info">' + l.map(function (f) { return '<div><small>' + f[0] + '</small><b>' + (esc(f[1]) || '—') + '</b></div>'; }).join('') + '</div>'; }
function extrasDe(json) { var o = jsonObj(json, {}); return Object.keys(o).map(function (k) { return [esc(k), typeof o[k] === 'object' ? JSON.stringify(o[k]) : o[k]]; }); }
function mPessoa(c, id) {
  var u = S.r.usuario, soZfam = !gestao() && !u.areas.length;
  var p = id ? c.porId[id] : { id: '', nome: '', nascimento: '', telefone: '', zfam: soZfam ? u.zfams[0] : '', chegada: '', raizes: '', teorico: '', domingo: '', email: '' };
  if (!p) return cab('adolescente', 'Não encontrado') + '<div class="drawer-b"></div>';
  var x = c.selo18(p), ap = c.apto(p), i = c.idade(p);
  var zfams = c.d.nomesZfams || (c.d.zfams || []).map(function (z) { return z.lider; });
  var h = cab(id ? 'adolescente' : 'novo cadastro', esc(nomeFmt(p.nome)) || 'Novo adolescente',
    id ? (i !== null ? tag(i + ' anos', 'line') : '') + (x ? tag(x.txt, x.cls) : '') + tagApto(ap) : '') + '<div class="drawer-b">';
  if (id) {
    var ss = c.serv[p.id] || [];
    var minhasAreas = c.areas.filter(function (a) { return podeArea(a.id); });
    var etapas = S.r.etapas.map(function (e) { return [e, ETAPA_NOME[e] || e]; });
    h += '<div class="bloco"><h3>Onde serve</h3>' + (ss.length ? ss.map(function (s) {
      var pode = podeArea(s.area_id) || (!s.area_id && gestao());
      var areasOpc = c.areas.filter(function (a) { return a.id === s.area_id || (pode && podeArea(a.id)); }).map(function (a) { return [a.id, a.nome]; });
      var dis = pode ? '' : ' disabled';
      var pp = s.etapa !== 'Voluntário' && s.status !== 'Parado' ? proximoPasso(c, s) : null;
      return '<div class="serv-box" data-servico="' + s.id + '"><div class="serv"><select data-acao="serv-area" aria-label="Área"' + dis + '>' + opts(areasOpc, s.area_id, s.area_id ? undefined : 'área a definir') + '</select>' +
        '<select data-acao="serv-etapa" aria-label="Etapa"' + dis + '>' + opts(etapas, s.etapa) + '</select>' +
        '<select data-acao="serv-status" aria-label="Status"' + dis + '>' + opts(['Ativo', 'Parado'], s.status || 'Ativo') + '</select>' +
        (pode ? '<button class="btn sm danger" data-acao="serv-tirar">tirar</button>' : '<span></span>') + '</div>' +
        '<div class="serv-datas"><label class="field">Horário em que serve<input type="text" data-serv="horario" value="' + esc(s.horario) + '" placeholder="ex.: sábado 19h" list="lhor"' + dis + '></label>' +
        '<label class="field">Welcome Flow<input type="date" data-serv="welcome" value="' + esc(s.welcome) + '"' + dis + '></label>' +
        '<label class="field">Trainee dia 1<input type="date" data-serv="dia1" value="' + esc(s.dia1) + '"' + dis + '></label>' +
        '<label class="field">Trainee dia 2<input type="date" data-serv="dia2" value="' + esc(s.dia2) + '"' + dis + '></label></div>' +
        (pp ? '<div class="nota ' + (pp.pronto ? 'certo' : 'info2') + '" style="margin:0">' + esc(pp.txt) + '</div>' : '') + '</div>';
    }).join('') + datalistHorarios(c) : '<p class="kpi-d">Não serve em nenhuma área ainda.</p>') +
      (minhasAreas.length ? '<div class="serv" style="margin-top:10px"><select data-novo="area" aria-label="Área">' + opts(minhasAreas.map(function (a) { return [a.id, a.nome]; }), '') + '</select>' +
        '<select data-novo="etapa" aria-label="Etapa">' + opts(etapas, 'Onboard') + '</select><span></span>' +
        '<button class="btn sm primary" data-acao="serv-add" data-id="' + p.id + '">+ colocar</button></div>' : '') + '</div>';
  }
  h += '<div class="bloco"><h3>Dados</h3><form data-form="pessoa" class="form"><input type="hidden" name="id" value="' + esc(p.id) + '">' +
    '<label class="field full">Nome completo<input type="text" name="nome" value="' + esc(p.nome) + '" required></label>' +
    '<label class="field">Data de nascimento<input type="date" name="nascimento" value="' + esc(p.nascimento) + '"></label>' +
    '<label class="field">WhatsApp<input type="tel" name="telefone" value="' + esc(p.telefone) + '"></label>' +
    '<label class="field">ZFAM (líder)<input type="text" name="zfam" list="lzf" value="' + esc(p.zfam) + '"' + (soZfam ? ' readonly' : '') + '><small>vazio = sem ZFAM</small></label>' +
    '<label class="field">Chegou no Flow<input type="text" name="chegada" value="' + esc(p.chegada) + '" placeholder="aaaa-mm"><small>mês e ano (ex.: 2025-08)</small></label>' +
    '<label class="field">E-mail<input type="email" name="email" value="' + esc(p.email) + '"></label>' +
    '<label class="field">Raízes<select name="raizes">' + opts(['Concluído', 'Em andamento', 'Pretende', 'Não conhece', 'Outra igreja'], p.raizes, '—') + '</select></label>' +
    '<label class="field">Fez o novo teórico (Welcome Flow)?<select name="teorico">' + opts(['Sim', 'Não'], p.teorico, '—') + '</select></label>' +
    '<label class="field">Já serviu num domingo?<select name="domingo">' + opts(['Sim', 'Não'], p.domingo, '—') + '</select></label>' +
    '<datalist id="lzf">' + zfams.map(function (z) { return '<option value="' + esc(z) + '">'; }).join('') + '</datalist>' +
    '<div class="acoes full"><button class="btn primary" type="submit">Salvar dados</button></div></form></div>';
  if (!id) return h + '</div>';
  var ex = jsonObj(p.extras, null);
  if (ex && ex.Inboard) {
    h += '<div class="bloco"><h3>Respostas do formulário Onboard</h3>' + (ex['respondido em'] ? '<p class="kpi-d" style="margin-bottom:8px">respondido em ' + fmtData(ex['respondido em']) + '</p>' : '') +
      info(Object.keys(ex.Inboard).map(function (k) { return [esc(k), ex.Inboard[k]]; })) + '</div>';
  }
  var obs = (c.d.obs || []).filter(function (o) { return o.pessoa_id === p.id; }).sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });
  h += '<div class="bloco"><h3>Observações</h3>' + obs.map(function (o) { return '<div class="nota">' + esc(o.texto) + '<small>' + esc(o.autor) + ' · ' + esc(o.data) + '</small></div>'; }).join('') +
    '<textarea data-novo="obs" placeholder="Escreva uma observação (fica registrada com seu nome e a data)" aria-label="Nova observação"></textarea>' +
    '<div class="acoes"><button class="btn" data-acao="obs-add" data-id="' + p.id + '">Adicionar observação</button></div></div>';
  return h + '</div>';
}
function datalistHorarios(c) {
  var hs = {};
  c.servico.forEach(function (s) { if (s.horario) hs[s.horario] = 1; });
  return '<datalist id="lhor">' + Object.keys(hs).sort().map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>';
}
function mAddArea(c, areaId) {
  var a = c.areaId[areaId];
  return cab('colocar na área', esc(a.nome)) + '<div class="drawer-b"><p class="kpi-d">Busque quem já está cadastrado ou cadastre alguém novo.</p>' +
    '<input type="search" data-acao="busca-add" placeholder="Digite o nome" style="margin:12px 0" aria-label="Nome">' +
    '<label class="field" style="max-width:260px;margin-bottom:12px">Entra como<select data-novo="etapa">' + opts(S.r.etapas.map(function (e) { return [e, ETAPA_NOME[e]]; }), 'Onboard') + '</select></label>' +
    '<div class="list" id="res-add"><p class="vazio">Digite pelo menos 2 letras.</p></div><div class="acoes"><button class="btn" data-acao="pessoa-nova">Cadastrar alguém novo</button></div></div>';
}
function resultadosAdd(q, alvo, acao) {
  var c = C(), base = S.r.dados.busca && S.r.dados.busca.length ? S.r.dados.busca : c.pessoas, areaId = S.modal.id, ja = {};
  c.servico.forEach(function (s) { if (s.area_id === areaId) ja[s.pessoa_id] = 1; });
  var k = norm(q).join(' ');
  var l = k.length < 2 ? [] : base.filter(function (p) { return !ja[p.id] && norm(p.nome).join(' ').indexOf(k) >= 0; }).slice(0, 12);
  document.getElementById(alvo || 'res-add').innerHTML = l.map(function (p) {
    return '<div class="item" data-acao="' + (acao || 'add-escolher') + '" data-id="' + p.id + '" data-nome="' + esc(nomeFmt(p.nome)) + '"><div class="nm"><b>' + esc(nomeFmt(p.nome)) + '</b><span>' + (p.zfam ? 'ZFAM ' + esc(p.zfam) : 'sem ZFAM') + '</span></div>' +
      '<div class="cs">' + tagApto(c.apto(p)) + '</div><div class="side-r"><span class="btn sm">escolher</span></div></div>';
  }).join('') || '<p class="vazio">' + (k.length >= 2 ? 'Ninguém com esse nome. Preencha como novo.' : 'Digite pelo menos 2 letras.') + '</p>';
}
function mTrainee(c, areaId) {
  var areas = c.areas.filter(function (a) { return podeArea(a.id); });
  var t = S.novoTrainee || {};
  return cab('trainee', 'Novo trainee') + '<div class="drawer-b"><p class="kpi-d" style="margin-bottom:14px">Quem fez o Welcome Flow ou já está nos dias de trainee. Busque o nome; se não achar, preencha como novo.</p>' +
    '<form data-form="trainee" class="form"><input type="hidden" name="pessoa_id" value="' + esc(t.id || '') + '">' +
    '<label class="field full">Nome<input type="search" name="nome" data-acao="busca-trainee" value="' + esc(t.nome || '') + '" autocomplete="off" required>' +
    (t.id ? '<small>' + tag('já cadastrado', 'ok') + ' <button type="button" class="lnk" data-acao="trainee-limpar">trocar</button></small>' : '<small>se já estiver cadastrado, escolha na lista abaixo</small>') + '</label>' +
    (t.id ? '' : '<div class="full list" id="res-trainee" style="max-height:220px;overflow:auto"><p class="vazio">Digite pelo menos 2 letras.</p></div>' +
      '<label class="field">Data de nascimento<input type="date" name="nascimento"></label><label class="field">WhatsApp<input type="tel" name="telefone"></label>' +
      '<label class="field full">ZFAM (líder)<input type="text" name="zfam" list="lzf2"><datalist id="lzf2">' + (c.d.nomesZfams || []).map(function (z) { return '<option value="' + esc(z) + '">'; }).join('') + '</datalist></label>') +
    '<label class="field">Área<select name="area_id" required>' + opts(areas.map(function (a) { return [a.id, a.nome]; }), areaId || (areas.length === 1 ? areas[0].id : ''), 'Escolha') + '</select></label>' +
    '<label class="field">Etapa<select name="etapa">' + opts([['Onboard', 'Welcome Flow (ainda não serviu)'], ['Trainee 1', 'Já fez o dia 1'], ['Trainee 2', 'Já fez os 2 dias']], 'Onboard') + '</select></label>' +
    '<label class="field">Horário em que serve<input type="text" name="horario" placeholder="ex.: sábado 19h" list="lhor">' + datalistHorarios(c) + '</label>' +
    '<label class="field">Data do Welcome Flow<input type="date" name="welcome"></label>' +
    '<div class="acoes full"><button class="btn primary" type="submit">Salvar trainee</button></div></form></div>';
}
function mInscricao(c, id) {
  var i = (c.d.inscricoes || []).filter(function (x) { return x.id === id; })[0];
  if (!i) return cab('inscrição', 'Não encontrada') + '<div class="drawer-b"></div>';
  var campos = [['Data da inscrição', fmtData(i.data)], ['Nascimento', fmtData(i.nascimento)], ['Tempo de Flow', i.tempo_flow], ['Está em ZFAM', i.em_zfam],
                ['Líder de ZFAM', i.lider_zfam], ['Ministério', i.ministerio], ['Área de interesse', i.area_interesse], ['E-mail', i.email], ['WhatsApp', i.whatsapp]].concat(extrasDe(i.respostas));
  var h = cab('inscrição', esc(nomeFmt(i.nome)), tag(i.status, { 'Nova': 'warn', 'Encaminhada': 'ok' }[i.status] || 'line')) + '<div class="drawer-b"><div class="bloco">' + info(campos) +
    (i.obs && !gestao() ? '<div class="nota" style="margin-top:12px">' + esc(i.obs) + '</div>' : '') + '</div>';
  if (!gestao()) return h + '</div>';
  var interesse = (c.areas.filter(function (a) { return a.nome === i.area_interesse; })[0] || {}).id;
  return h + '<div class="bloco"><h3>Encaminhar pro Welcome Flow</h3><p class="kpi-d" style="margin-bottom:10px">A pessoa entra no processo da área (Welcome Flow). Se ainda não estiver cadastrada, o cadastro é criado com os dados da inscrição.</p>' +
    '<div class="serv"><select data-novo="area" aria-label="Área">' + opts(c.areas.map(function (a) { return [a.id, a.nome]; }), interesse, 'área a definir') + '</select><span></span><span></span>' +
    '<button class="btn primary" data-acao="encaminhar" data-id="' + i.id + '">Encaminhar</button></div></div>' +
    '<div class="bloco"><h3>Status</h3><form data-form="inscricao" class="form"><input type="hidden" name="id" value="' + i.id + '">' +
    '<label class="field">Status<select name="status">' + opts(S.r.statusInscricao, i.status) + '</select></label>' +
    '<label class="field full">Observação<textarea name="obs">' + esc(i.obs) + '</textarea></label>' +
    '<div class="acoes full"><button class="btn" type="submit">Salvar</button></div></form></div></div>';
}
function mArea(c, id) {
  var a = id ? c.areaId[id] : { id: '', nome: '', head: '', lideres: '', ideal: '', auxiliar: '', sucessor: '', obs: '', ordem: c.areas.length + 1 };
  return cab(id ? 'editar área' : 'nova área', esc(a.nome) || 'Nova área') + '<div class="drawer-b"><form data-form="area" class="form">' +
    '<input type="hidden" name="id" value="' + esc(a.id) + '"><input type="hidden" name="ordem" value="' + esc(a.ordem) + '">' +
    '<label class="field">Nome<input type="text" name="nome" value="' + esc(a.nome) + '" required' + (gestao() ? '' : ' readonly') + '></label>' +
    '<label class="field">Head<select name="head"' + (gestao() ? '' : ' disabled') + '>' + opts([['MM', 'Multimídia'], ['OP', 'Operações']], a.head, 'sem head') + '</select></label>' +
    (gestao() ? '' : '<input type="hidden" name="head" value="' + esc(a.head) + '">') +
    '<label class="field full">Líderes<input type="text" name="lideres" value="' + esc(a.lideres) + '" placeholder="Nome e Nome"></label>' +
    '<label class="field">Quantidade ideal de voluntários<input type="number" min="0" name="ideal" value="' + esc(a.ideal) + '"><small>vazio = a definir</small></label>' +
    '<label class="field">Auxiliar adolescente<input type="text" name="auxiliar" value="' + esc(a.auxiliar) + '"></label>' +
    '<label class="field full">Sucessor indicado<input type="text" name="sucessor" value="' + esc(a.sucessor) + '"><small>quem assume quando o líder transicionar</small></label>' +
    '<label class="field full">Observação<textarea name="obs">' + esc(a.obs) + '</textarea></label>' +
    '<div class="acoes full"><button class="btn primary" type="submit">Salvar área</button></div></form></div>';
}
function mMeta(c, id) {
  var m = id ? (c.d.metas || []).filter(function (x) { return x.id === id; })[0] : { id: '', prazo: 'curto', texto: '', auto: '', responsavel: '', data_limite: '', andamento: '', obs: '', ordem: 99 };
  return cab(id ? 'editar meta' : 'nova meta', 'Meta') + '<div class="drawer-b"><form data-form="meta" class="form">' +
    '<input type="hidden" name="id" value="' + esc(m.id) + '"><input type="hidden" name="auto" value="' + esc(m.auto) + '"><input type="hidden" name="ordem" value="' + esc(m.ordem) + '">' +
    '<label class="field full">Meta<textarea name="texto" required>' + esc(m.texto) + '</textarea></label>' +
    '<label class="field">Prazo<select name="prazo">' + opts([['curto', 'Curto prazo'], ['longo', 'Longo prazo']], m.prazo) + '</select></label>' +
    '<label class="field">Responsável<input type="text" name="responsavel" value="' + esc(m.responsavel) + '"></label>' +
    '<label class="field">Data limite<input type="date" name="data_limite" value="' + esc(m.data_limite) + '"></label>' +
    (m.auto ? '<p class="kpi-d full">O andamento desta meta é calculado sozinho com os dados do painel.</p>' : '<label class="field">Andamento (%)<input type="number" min="0" max="100" name="andamento" value="' + esc(m.andamento) + '"></label>') +
    '<label class="field full">Observação<textarea name="obs">' + esc(m.obs) + '</textarea></label>' +
    '<div class="acoes full"><button class="btn primary" type="submit">Salvar meta</button></div></form></div>';
}
function mZfam(c, lider) {
  var z = (c.d.zfams || []).filter(function (x) { return x.lider === lider; })[0] || { lider: lider };
  return cab('editar ZFAM', esc(z.lider)) + '<div class="drawer-b"><form data-form="zfam" class="form"><input type="hidden" name="lider" value="' + esc(z.lider) + '">' +
    '<label class="field">Auxiliar<input type="text" name="auxiliar" value="' + esc(z.auxiliar) + '"></label><label class="field">Dia<input type="text" name="dia" value="' + esc(z.dia) + '"></label>' +
    '<label class="field">Horário<input type="text" name="horario" value="' + esc(z.horario) + '"></label>' +
    '<label class="field full">Observação<textarea name="obs">' + esc(z.obs) + '</textarea></label>' +
    '<div class="acoes full"><button class="btn primary" type="submit">Salvar</button></div></form></div>';
}
/** "Onde serve e qual a responsabilidade": uma linha por lugar. F = { areas, zfams, lugares, niveis }. */
function linhaPapel(F, p) {
  p = p || {};
  var outros = (F.lugares || []).map(function (m) { return ['min:' + m, m]; });
  return '<div class="papel"><select data-p="onde" data-acao="papel-onde" aria-label="Onde"><option value="">Onde você serve?</option>' +
    '<optgroup label="Flow">' + opts(outros, p.onde) + '</optgroup>' +
    '<optgroup label="Áreas Executivas">' + opts(F.areas.map(function (a) { return [a.id, a.nome]; }), p.onde) + '</optgroup>' +
    '<optgroup label="ZFAM">' + opts([['zfam', 'ZFAM']], p.onde) + '</optgroup></select>' +
    '<select data-p="nivel" aria-label="Responsabilidade"><option value="">Responsabilidade</option>' + opts(F.niveis || ['Core', 'Head', 'Líder', 'Auxiliar', 'Voluntário'], p.nivel) + '</select>' +
    '<button type="button" class="btn sm" data-acao="papel-tirar" aria-label="Tirar esta linha">×</button>' +
    '<select data-p="zfam" class="zf"' + (p.onde === 'zfam' ? '' : ' hidden') + ' aria-label="Qual ZFAM"><option value="">Qual ZFAM? (nome do líder)</option>' + opts(F.zfams, p.zfam) + '</select>' +
    '<input type="text" data-p="texto" class="tx" placeholder="O que você faz lá? (opcional)" value="' + esc(p.texto) + '"></div>';
}
function ajudaNiveis() {
  return '<div class="niveis-ajuda"><b>Core</b><span>cuida do ministério inteiro (ex.: Core do Flow, Core de Comunicação)</span><b>Head</b><span>cuida de um grupo de áreas (ex.: Head de Multimídia)</span>' +
    '<b>Líder</b><span>lidera uma área ou um ZFAM</span><b>Auxiliar</b><span>ajuda o líder da área ou do ZFAM</span><b>Voluntário</b><span>serve na escala</span></div>';
}
function lerPapeisDe(raiz) {
  return Array.prototype.map.call(raiz.querySelectorAll('.papel'), function (l) {
    var v = function (k) { var el = l.querySelector('[data-p=' + k + ']'); return el && !el.hidden ? el.value.trim() : ''; };
    return { onde: v('onde'), nivel: v('nivel'), zfam: v('zfam'), texto: v('texto') };
  }).filter(function (p) { return p.onde; });
}
function validarPapeis(ps) {
  if (!ps.length) return 'Diga onde você serve (pelo menos um lugar).';
  for (var k = 0; k < ps.length; k++) {
    if (!ps[k].nivel) return 'Em cada lugar, escolha a responsabilidade (Core, Head, Líder, Auxiliar ou Voluntário).';
    if (ps[k].onde === 'zfam' && !ps[k].zfam) return 'Escolha qual ZFAM (o nome do líder).';
  }
  return '';
}
function mAdulto(c, id) {
  var e = id ? (c.d.equipe || []).filter(function (x) { return x.id === id; })[0] : { id: '', nome: '' };
  if (!e) return cab('CREW FLOW', 'Não encontrado') + '<div class="drawer-b"></div>';
  var f = id ? funcoesDe(c, e, c.d.equipe || []) : null;
  var h = cab('CREW FLOW', esc(nomeFmt(e.nome)) || 'Novo adulto', f ? barrinhas(f) : '') + '<div class="drawer-b">';
  if (id) {
    var a = acessoDoAdulto(c, e), es = a && escopoDe(a);
    var origem = { tally: 'Tally', cadastro: 'cadastro do site', painel: 'painel' };
    h += '<div class="bloco"><h3>Responsabilidades e carga</h3>' + (f.lst.length ? '<div class="tbl-wrap"><table class="tbl"><tr><th>Lugar</th><th>Responsabilidade</th><th>Peso</th><th>De onde</th></tr>' +
      f.lst.map(function (x) { return '<tr><td>' + esc(x.lugar) + '</td><td>' + esc(x.nivel) + '</td><td class="n">' + peso(x.nivel) + '</td><td>' + esc(x.fonte) + '</td></tr>'; }).join('') +
      '<tr><td colspan="2"><b>Carga</b></td><td class="n"><b>' + f.carga + '</b></td><td></td></tr></table></div>' : '<p class="kpi-d">Nada marcado ainda.</p>') + '</div>' +
      '<div class="bloco"><h3>Ficha</h3>' + info([['Veio de', lista(String(e.origem || 'tally').replace(/\+/g, ',')).map(function (o) { return origem[o] || o; }).join(' + ')],
        ['Disse no cadastro que faz', e.papeis_declarados], ['Atualizado em', fmtDataHora(e.atualizado_em)]].concat(extrasDe(e.respostas))) + '</div>' +
      '<div class="bloco"><h3>Acesso ao painel</h3>' + (a ? '<p>' + tag(PERFIL[a.perfil] || a.perfil, 'ok') + ' ' + esc(PERFIL[a.perfil] === 'Liderança' ? escopoTexto(c, es.areas, es.zfams) : 'vê tudo') + ' ' +
        (a.codigo ? '<button class="btn sm" data-acao="acesso" data-v="' + esc(a.codigo) + '">editar acesso</button>' : '') + '</p>' :
        '<p class="kpi-d">Não tem acesso ao painel. <button class="btn sm" data-acao="acesso-de-adulto" data-id="' + esc(e.id) + '">criar acesso</button></p>') + '</div>';
  }
  var F = { areas: c.areas, zfams: c.d.nomesZfams || [], lugares: S.r.lugares, niveis: S.r.niveis };
  var ps = lerPapeis(e.funcoes);
  var todosMin = S.r.ministerios.slice();
  lista(e.ministerios).forEach(function (m) { if (todosMin.indexOf(m) < 0) todosMin.push(m); });
  h += '<div class="bloco"><h3>' + (id ? 'Editar' : 'Dados') + '</h3><form data-form="adulto" class="form"><input type="hidden" name="id" value="' + esc(e.id) + '">' +
    '<label class="field full">Nome completo<input type="text" name="nome" value="' + esc(e.nome) + '" required></label>' +
    '<label class="field">WhatsApp<input type="tel" name="telefone" value="' + esc(e.telefone) + '"></label><label class="field">E-mail<input type="email" name="email" value="' + esc(e.email) + '"></label>' +
    '<div class="field full">Onde serve e qual a responsabilidade' + ajudaNiveis() + '<div class="papeis-linhas">' + (ps.length ? ps : [{}]).map(function (p) { return linhaPapel(F, p); }).join('') + '</div>' +
    '<div><button type="button" class="btn sm" data-acao="papel-mais">+ outro lugar</button></div></div>' +
    '<div class="field full">Ministérios marcados no Tally<div class="checks box">' + todosMin.map(function (m) {
      return '<label><input type="checkbox" name="ministerios" value="' + esc(m) + '"' + (lista(e.ministerios).indexOf(m) >= 0 ? ' checked' : '') + '> ' + esc(m) + '</label>';
    }).join('') + '</div><small>contam como voluntário (peso ' + peso('Voluntário') + ') quando o lugar não aparece acima</small></div>' +
    '<div class="field full">Áreas Executivas em que serve<div class="checks box">' + c.areas.map(function (a) {
      return '<label><input type="checkbox" name="areas_ae" value="' + esc(a.id) + '"' + (lista(e.areas_ae).indexOf(a.id) >= 0 ? ' checked' : '') + '> ' + esc(a.nome) + '</label>';
    }).join('') + '</div></div>' +
    '<label class="field full">Quer ou pode servir também em<input type="text" name="disponivel_para" value="' + esc(e.disponivel_para) + '" placeholder="ex.: Check-in, Recepção"></label>' +
    '<label class="field full">Observação<textarea name="obs">' + esc(e.obs) + '</textarea></label>' +
    '<div class="acoes full"><button class="btn primary" type="submit">Salvar</button></div></form></div>';
  return h + '</div>';
}
function mPedido(c, id) {
  var x = (c.d.cadastros || []).filter(function (q) { return q.id === id; })[0];
  if (!x) return cab('pedido de acesso', 'Não encontrado') + '<div class="drawer-b"></div>';
  var conf = conferir(c, x), ps = lerPapeis(x.papeis);
  var h = cab('pedido de acesso', esc(nomeFmt(x.nome)), tag(x.status, COR_PEDIDO[x.status])) + '<div class="drawer-b"><div class="bloco">' +
    info([['Cadastro em', fmtDataHora(x.data)], ['E-mail', x.email], ['WhatsApp', x.telefone], ['Decidido por', x.decidido_por ? x.decidido_por + ' · ' + fmtDataHora(x.decidido_em) : '']].concat(extrasDe(x.respostas))) + '</div>' +
    '<div class="bloco"><h3>Onde serve e responsabilidade</h3>' + ps.map(function (p) { return '<div class="nota"><b>' + esc(descPapel(c, p)) + '</b>' + (p.texto ? '<br>' + esc(p.texto) : '') + '</div>'; }).join('') +
    conf.ok.map(function (t) { return '<div class="nota certo">' + esc(t) + ': o nome bate com a planilha.</div>'; }).join('') +
    conf.nao.map(function (t) { return '<div class="nota alerta">' + esc(t) + ': o nome não aparece com esse papel na planilha. Confira antes de liberar.</div>'; }).join('') +
    (conf.emailCrew ? '<div class="nota alerta">O e-mail que está na CREW (do Tally) é <b>' + esc(conf.emailCrew) + '</b>, diferente do cadastro. Confirme com a pessoa.</div>' : '') +
    (conf.telCrew ? '<div class="nota alerta">O telefone que está na CREW é <b>' + esc(conf.telCrew) + '</b>, diferente do cadastro.</div>' : '') +
    (conf.nomeCrew ? '<div class="nota">Juntado com a ficha <b>' + esc(conf.nomeCrew) + '</b> da CREW.</div>' : '') + '</div>';
  if (['Aprovado', 'Aprovado (automático)', 'Já tinha acesso'].indexOf(x.status) >= 0) return h + '</div>';
  return h + '<form data-form="aprovar" class="bloco"><input type="hidden" name="id" value="' + esc(x.id) + '"><h3>Liberar acesso</h3>' +
    '<p class="kpi-d" style="margin-bottom:10px">Sugestão pelo que a pessoa marcou. Liderança vê só as áreas e os ZFAMs marcados; Head e Core veem tudo.</p>' +
    camposAcesso(c, x.perfil_sugerido || 'lider', x.escopo_sugerido) +
    '<div class="acoes"><button type="button" class="btn danger" data-acao="pedido-decidir" data-v="Recusado" data-id="' + esc(x.id) + '">Recusar</button>' +
    '<button type="button" class="btn" data-acao="pedido-decidir" data-v="Só cadastro" data-id="' + esc(x.id) + '">Só cadastro, sem acesso</button>' +
    '<button class="btn primary" type="submit">Aprovar e avisar por e-mail</button></div></form></div>';
}
function camposAcesso(c, perfil, escopo) {
  var es = lista(escopo), core = S.r.usuario.perfil === 'core';
  var perfis = [['lider', 'Liderança (vê só o que estiver marcado)'], ['head', 'Head (vê tudo)']].concat(core || perfil === 'core' ? [['core', 'Core (vê tudo)']] : []);
  var marca = function (v) { return es.indexOf(v) >= 0 ? ' checked' : ''; };
  return '<div class="form"><label class="field full">Perfil<select name="perfil" data-acao="perfil-acesso">' + opts(perfis, perfil) + '</select></label></div>' +
    '<div class="escopo" style="margin-top:12px;display:flex;flex-direction:column;gap:12px"' + (perfil === 'lider' ? '' : ' hidden') + '>' +
    '<div class="field">Áreas<div class="checks box">' + c.areas.map(function (a) { return '<label><input type="checkbox" name="escopo" value="area:' + esc(a.id) + '"' + marca('area:' + a.id) + '> ' + esc(a.nome) + '</label>'; }).join('') + '</div></div>' +
    '<div class="field">ZFAMs<div class="checks box">' + (c.d.zfams || []).map(function (z) { return '<label><input type="checkbox" name="escopo" value="zfam:' + esc(z.lider) + '"' + marca('zfam:' + z.lider) + '> ' + esc(z.lider) + '</label>'; }).join('') + '</div></div></div>';
}
function mAcesso(c, cod) {
  var a = cod ? (c.d.acessos || []).filter(function (x) { return x.codigo === cod; })[0] : (S.prefAcesso || { nome: '', email: '', telefone: '', perfil: 'lider', escopo: '' });
  if (!a) return cab('acesso', 'Não encontrado') + '<div class="drawer-b"></div>';
  var perfil = a.perfil === 'lider_area' || a.perfil === 'lider_zfam' ? 'lider' : a.perfil, es = escopoDe(a);
  var escopo = es.areas.map(function (x) { return 'area:' + x; }).concat(es.zfams.map(function (x) { return 'zfam:' + x; })).join(', ');
  return cab(cod ? 'editar acesso' : 'novo acesso', esc(a.nome) || 'Novo acesso') + '<div class="drawer-b"><form data-form="acesso"><input type="hidden" name="codigo" value="' + esc(cod || '') + '"><input type="hidden" name="equipe_id" value="' + esc(a.equipe_id || '') + '">' +
    '<div class="form" style="margin-bottom:14px"><label class="field full">Nome<input type="text" name="nome" value="' + esc(a.nome) + '" required></label>' +
    '<label class="field">E-mail<input type="email" name="email" value="' + esc(a.email) + '"><small>é com ele que a pessoa cria a conta e entra</small></label>' +
    '<label class="field">WhatsApp<input type="tel" name="telefone" value="' + esc(a.telefone) + '"></label></div>' + camposAcesso(c, perfil, escopo) +
    (cod ? '' : '<div class="checks" style="margin-top:14px"><label><input type="checkbox" name="enviar" value="1" checked> avisar por e-mail</label></div>') +
    '<div class="acoes"><button class="btn primary" type="submit">' + (cod ? 'Salvar' : 'Criar acesso') + '</button></div></form></div>';
}
function mCodigo() {
  var a = S.codigoNovo;
  if (!a) return cab('acesso', 'Nada aqui') + '<div class="drawer-b"></div>';
  return cab('acesso liberado', esc(a.nome)) + '<div class="drawer-b"><p>' + (a.emailEnviado ? 'Mandamos um e-mail pra <b>' + esc(a.email) + '</b> avisando. ' : 'O aviso não foi por e-mail' + (a.email ? '. ' : ' (sem e-mail no cadastro). ')) +
    'No primeiro acesso a pessoa confirma o e-mail e cria a senha. Ela também pode entrar com o código pessoal:</p>' +
    '<div class="codigo-grande">' + esc(a.codigo) + '</div><div class="acoes" style="justify-content:center">' +
    (a.telefone ? '<a class="btn primary" href="' + esc(waMsg(a.telefone, mensagemAcesso(a))) + '" target="_blank" rel="noopener">Mandar no WhatsApp</a>' : '') +
    '<button class="btn" data-acao="copiar-msg">Copiar mensagem</button></div></div>';
}
function mSync() {
  return cab('sincronização', 'Feito') + '<div class="drawer-b"><p class="kpi-d" style="margin-bottom:12px">Nada do painel foi apagado: entrou só o que faltava, e as etapas só avançam.</p>' +
    '<div class="nota" style="white-space:pre-wrap">' + esc(S.resumoSync) + '</div></div>';
}

/* ---------- editor das perguntas dos formulários ---------- */
var TIPOS_PERG = [['texto', 'Texto curto'], ['paragrafo', 'Texto longo'], ['data', 'Data'], ['telefone', 'Telefone'], ['email', 'E-mail'],
                  ['escolha', 'Escolhe uma opção'], ['multipla', 'Marca várias opções'], ['zfam', 'Lista de ZFAMs'], ['area', 'Lista de áreas']];
var NOME_TIPO = { papeis: 'Onde serve e responsabilidade' };
TIPOS_PERG.forEach(function (t) { NOME_TIPO[t[0]] = t[1]; });
function mPerguntas(c, form) {
  if (!S.perguntas || S.perguntas.form !== form) {
    S.perguntas = { form: form, lista: (c.d.perguntas || []).filter(function (q) { return q.form === form; }).sort(porOrdem).map(function (q) { return Object.assign({}, q); }) };
  }
  var L = S.perguntas.lista;
  return cab('formulário', form === 'inscricao' ? 'Perguntas da inscrição' : 'Perguntas do cadastro da CREW') + '<div class="drawer-b">' +
    '<p class="kpi-d" style="margin-bottom:12px">Mude o texto, a ordem, o que é obrigatório e o que aparece. As perguntas marcadas como "do sistema" podem mudar de texto e ser escondidas, mas não saem.</p>' +
    L.map(function (q, i) { return linhaPergunta(q, i, L.length, form); }).join('') +
    '<div class="acoes"><button class="btn" data-acao="perg-nova">+ pergunta</button><span style="flex:1"></span>' +
    '<button class="btn" data-acao="fechar">Cancelar</button><button class="btn primary" data-acao="perg-salvar">Salvar formulário</button></div></div>';
}
function linhaPergunta(q, i, n, form) {
  var sist = !!q.campo, travada = (S.r.travados[form] || []).indexOf(q.campo) >= 0;
  var temOpc = q.tipo === 'escolha' || q.tipo === 'multipla', opcLivre = !sist || (S.r.opcoesLivres || []).indexOf(q.campo) >= 0;
  return '<div class="perg' + (q.ativa === 'Não' ? ' oculta' : '') + '" data-i="' + i + '"><div class="perg-top"><span class="perg-n">' + (i + 1) + '</span>' +
    '<input type="text" data-q="texto" value="' + esc(q.texto) + '" aria-label="Texto da pergunta">' +
    '<button class="btn sm" data-acao="perg-subir"' + (i ? '' : ' disabled') + ' aria-label="Subir">↑</button>' +
    '<button class="btn sm" data-acao="perg-descer"' + (i < n - 1 ? '' : ' disabled') + ' aria-label="Descer">↓</button>' +
    (sist ? tag('do sistema', 'line') : '<button class="btn sm danger" data-acao="perg-tirar">apagar</button>') + '</div>' +
    '<div class="perg-cfg">' + (sist ? tag(NOME_TIPO[q.tipo] || q.tipo) : '<select data-q="tipo" aria-label="Tipo">' + opts(TIPOS_PERG, q.tipo) + '</select>') +
    '<label><input type="checkbox" data-q="obrigatoria"' + (q.obrigatoria === 'Sim' || travada ? ' checked' : '') + (travada ? ' disabled' : '') + '> obrigatória</label>' +
    '<label><input type="checkbox" data-q="ativa"' + (q.ativa !== 'Não' || travada ? ' checked' : '') + (travada ? ' disabled' : '') + '> aparece no formulário</label></div>' +
    (temOpc ? '<label class="field">Opções (uma por linha)<textarea data-q="opcoes"' + (opcLivre ? '' : ' readonly') + '>' + esc(String(q.opcoes || '').split('|').join('\n')) + '</textarea>' +
      (opcLivre ? '' : '<small>essas opções alimentam as contas do painel e não mudam</small>') + '</label>' : '') +
    '<input type="text" data-q="ajuda" value="' + esc(q.ajuda) + '" placeholder="Texto de ajuda (opcional)" aria-label="Texto de ajuda"></div>';
}
function atualizarPergunta(el) {
  if (!S.perguntas || !el.closest('.perg')) return;
  var q = S.perguntas.lista[+el.closest('.perg').getAttribute('data-i')], k = el.getAttribute('data-q');
  if (el.type === 'checkbox') q[k] = el.checked ? 'Sim' : 'Não';
  else if (k === 'opcoes') q[k] = el.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean).join('|');
  else q[k] = el.value;
}
function moverPergunta(el, d) {
  var L = S.perguntas.lista, i = +el.closest('.perg').getAttribute('data-i'), j = i + d;
  if (j < 0 || j >= L.length) return;
  var t = L[i]; L[i] = L[j]; L[j] = t;
  abrirModal('perguntas', S.perguntas.form, true);
}

/* ---------- dica ao passar o mouse (gráficos e etiquetas) ---------- */
var TIP = null;
function esconderTip() { if (TIP) { TIP.remove(); TIP = null; } }
document.addEventListener('mouseover', function (ev) {
  var el = ev.target.closest && ev.target.closest('[data-tip]');
  if (!el) { esconderTip(); return; }
  if (!TIP) { TIP = document.createElement('div'); TIP.className = 'tip'; document.body.appendChild(TIP); }
  TIP.textContent = el.getAttribute('data-tip');
});
document.addEventListener('mousemove', function (ev) {
  if (!TIP) return;
  var x = ev.clientX + 14, y = ev.clientY + 16, w = TIP.offsetWidth, h = TIP.offsetHeight;
  if (x + w > innerWidth - 8) x = ev.clientX - w - 14;
  if (y + h > innerHeight - 8) y = ev.clientY - h - 12;
  TIP.style.left = x + 'px'; TIP.style.top = y + 'px';
});

/* ---------- ações ---------- */
function aplicar(r) {
  S.r = r;
  if (!S.voltar) guardarSessao('aes-r', JSON.stringify(r));
  render();
}
function salvarServicoCampo(sid, campos, msg) {
  var s = S.r.dados.servico.filter(function (x) { return x.id === sid; })[0];
  api('salvarServico', Object.assign({}, s, campos)).then(function (r) { aplicar(r); toast(msg || 'Atualizado'); }).catch(function (e) { render(); falha(e); });
}
document.addEventListener('click', function (ev) {
  // dentro de [data-stop] (link do WhatsApp, botões da linha) só vale a ação que também está lá dentro, nunca a da linha
  var stop = ev.target.closest('[data-stop]'), el = ev.target.closest('[data-acao]');
  if (!el || (stop && !stop.contains(el))) return;
  var a = el.getAttribute('data-acao'), v = el.getAttribute('data-v'), id = el.getAttribute('data-id');
  if (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
  if (a === 'fundo') { if (ev.target === el) fecharModal(); return; }
  var acoes = {
    sair: function () { api('sair').catch(function () { }); sairLocal(''); },
    tab: function () { S.tab = v; guardar('aes-tab', v); render(); window.scrollTo(0, 0); },
    area: function () { S.area = v; render(); },
    'area-ver': function () { S.areaVer = v; render(); },
    'ir-area': function () { S.tab = 'areas'; S.area = v; render(); window.scrollTo(0, 0); },
    zfam: function () { S.zfam = v; render(); },
    'ir-zfam': function () { S.tab = 'zfams'; S.zfam = v; render(); window.scrollTo(0, 0); },
    pessoa: function () { abrirModal('pessoa', id); },
    'pessoa-nova': function () {
      if (S.modal && S.modal.tipo === 'addArea') S.pendente = { area: S.modal.id, etapa: document.querySelector('.drawer [data-novo=etapa]').value };
      else S.pendente = null;
      abrirModal('pessoa', '');
    },
    inscricao: function () { abrirModal('inscricao', id); },
    'area-editar': function () { abrirModal('area', id); },
    'area-nova': function () { abrirModal('area', ''); },
    'add-area': function () { abrirModal('addArea', id); },
    'trainee-novo': function () { S.novoTrainee = null; abrirModal('trainee', v || (S.tab === 'trainees' ? S.trArea : '')); },
    'trainee-escolher': function () { S.novoTrainee = { id: id, nome: el.getAttribute('data-nome') }; abrirModal('trainee', S.modal.id, true); },
    'trainee-limpar': function () { S.novoTrainee = null; abrirModal('trainee', S.modal.id, true); },
    'virar-voluntario': function () { salvarServicoCampo(v, { etapa: 'Voluntário' }, 'Agora é voluntário'); },
    avancar: function () {
      var s = S.r.dados.servico.filter(function (x) { return x.id === v; })[0];
      salvarServicoCampo(v, { etapa: s.etapa === 'Onboard' ? 'Trainee 1' : 'Trainee 2' }, s.etapa === 'Onboard' ? 'Dia 1 marcado' : 'Dia 2 marcado: pronto pra virar voluntário');
    },
    'tr-etapa': function () { S.trEtapa = v; render(); },
    meta: function () { abrirModal('meta', id); },
    'meta-nova': function () { abrirModal('meta', ''); },
    'zfam-editar': function () { abrirModal('zfam', v); },
    adulto: function () { abrirModal('adulto', id); },
    'adulto-novo': function () { abrirModal('adulto', ''); },
    fechar: function () { fecharModal(); },
    'filtro-insc': function () { S.filtroInsc = v; render(); },
    'filtro-pessoas': function () { S.filtroPessoas = v; render(); },
    'link-form': function () { copiar(urlSite() + '?pagina=inscricao', 'Link do formulário copiado'); },
    'link-cadastro': function () { copiar(urlSite() + '?pagina=cadastro', 'Link do cadastro copiado'); },
    'serv-tirar': function () {
      var sid = el.closest('[data-servico]').getAttribute('data-servico');
      if (confirm('Tirar essa pessoa da área?')) api('excluirServico', sid).then(aplicar).catch(falha);
    },
    'serv-add': function () {
      var box = el.closest('.serv');
      api('salvarServico', { pessoa_id: id, area_id: box.querySelector('[data-novo=area]').value, etapa: box.querySelector('[data-novo=etapa]').value, status: 'Ativo' })
        .then(function (r) { aplicar(r); toast('Colocado na área'); }).catch(falha);
    },
    'add-escolher': function () {
      var etapa = document.querySelector('.drawer [data-novo=etapa]').value;
      api('salvarServico', { pessoa_id: id, area_id: S.modal.id, etapa: etapa, status: 'Ativo' }).then(function (r) { fecharModal(); aplicar(r); toast('Colocado na área'); }).catch(falha);
    },
    'obs-add': function () {
      var t = document.querySelector('.drawer [data-novo=obs]').value;
      api('adicionarObs', id, t).then(function (r) { aplicar(r); toast('Observação salva'); }).catch(falha);
    },
    encaminhar: function () {
      var area = el.closest('.serv').querySelector('[data-novo=area]').value;
      api('encaminharInscricao', id, area).then(function (r) { fecharModal(); aplicar(r); toast('Encaminhada pro Welcome Flow'); }).catch(falha);
    },
    sync: function () {
      toast('Lendo as planilhas antigas… pode levar alguns segundos');
      api('sincronizarPlanilhas').then(function (r) { S.resumoSync = r.resumoSync; aplicar(r); abrirModal('sync'); }).catch(falha);
    },
    'sync-inboard': function () {
      toast('Lendo o Onboard…');
      api('sincronizarInboard').then(function (r) { S.resumoSync = r.resumoSync; aplicar(r); abrirModal('sync'); }).catch(falha);
    },
    crew: function () { S.crew = v; render(); },
    'filtro-pedidos': function () { S.filtroPedidos = v; render(); },
    pedido: function () { abrirModal('pedido', id); },
    'pedido-decidir': function () {
      api('decidirCadastro', id, v).then(function (r) { fecharModal(); aplicar(r); toast(v === 'Recusado' ? 'Pedido recusado' : 'Ficou só o cadastro, sem acesso'); }).catch(falha);
    },
    'acesso-novo': function () { S.prefAcesso = null; abrirModal('acesso', ''); },
    'acesso-de-adulto': function () {
      var e = (S.r.dados.equipe || []).filter(function (x) { return x.id === id; })[0] || {};
      S.prefAcesso = { nome: e.nome, email: e.email, telefone: e.telefone, equipe_id: e.id, perfil: 'lider', escopo: '' };
      abrirModal('acesso', '');
    },
    acesso: function () { S.prefAcesso = null; abrirModal('acesso', v); },
    'ver-codigo': function () { el.outerHTML = '<code class="cod">' + esc(v) + '</code>'; },
    'acesso-reenviar': function () { api('reenviarCodigo', v).then(function (r) { toast('Aviso reenviado pra ' + r.email); }).catch(falha); },
    'acesso-apagar': function () {
      if (confirm('Apagar este acesso? A pessoa não entra mais no painel.')) api('removerAcesso', v).then(function (r) { fecharModal(); aplicar(r); toast('Acesso apagado'); }).catch(falha);
    },
    'ver-como': function () {
      api('verComo', v).then(function (r) {
        S.voltar = { token: S.token, tab: S.tab };
        S.token = r.token; S.tab = null; S.area = null; S.zfam = null;
        fecharModal(); aplicar(r); window.scrollTo(0, 0);
      }).catch(falha);
    },
    voltar: function () {
      var meu = S.voltar;
      api('sair').catch(function () { });
      S.token = meu.token;
      api('sessao').then(function (r) { S.voltar = null; S.tab = 'crew'; S.crew = 'acessos'; S.area = null; S.zfam = null; fecharModal(); aplicar(r); }).catch(falha);
    },
    'copiar-msg': function () { copiar(mensagemAcesso(S.codigoNovo), 'Mensagem copiada'); },
    perguntas: function () { S.perguntas = null; abrirModal('perguntas', v); },
    'perg-subir': function () { moverPergunta(el, -1); },
    'perg-descer': function () { moverPergunta(el, 1); },
    'perg-tirar': function () { S.perguntas.lista.splice(+el.closest('.perg').getAttribute('data-i'), 1); abrirModal('perguntas', S.perguntas.form, true); },
    'perg-nova': function () {
      S.perguntas.lista.push({ id: '', form: S.perguntas.form, campo: '', texto: 'Nova pergunta', tipo: 'texto', opcoes: '', obrigatoria: 'Não', ativa: 'Sim', ajuda: '' });
      abrirModal('perguntas', S.perguntas.form, true);
      var d = document.querySelector('.drawer'); d.scrollTop = d.scrollHeight;
    },
    'perg-salvar': function () {
      var P = S.perguntas;
      api('salvarPerguntas', P.form, P.lista).then(function (r) { fecharModal(); aplicar(r); toast('Formulário salvo'); }).catch(falha);
    },
    'login-modo': function () { S.login = v; S.loginMsg = ''; render(); },
    'login-reenviar': function () { api('pedirCodigoEmail', S.loginEmail).then(function () { S.loginMsg = 'Mandamos de novo.'; render(); }).catch(falha); },
    'papel-mais': function () {
      var box = el.closest('form').querySelector('.papeis-linhas');
      box.insertAdjacentHTML('beforeend', linhaPapel(S.form || { areas: C().areas, zfams: S.r.dados.nomesZfams || [], lugares: S.r.lugares, niveis: S.r.niveis }));
    },
    'papel-tirar': function () {
      var l = el.closest('.papel'), box = l.parentNode;
      if (box.querySelectorAll('.papel').length > 1) l.remove();
      else l.outerHTML = linhaPapel(S.form || { areas: C().areas, zfams: S.r.dados.nomesZfams || [], lugares: S.r.lugares, niveis: S.r.niveis });
    }
  };
  if (acoes[a]) acoes[a]();
});
document.addEventListener('keydown', function (ev) {
  if (ev.key === 'Escape' && S.modal) fecharModal();
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches && ev.target.matches('.kpi[data-acao]')) { ev.preventDefault(); ev.target.click(); }
});
document.addEventListener('change', function (ev) {
  var el = ev.target, a = el.getAttribute('data-acao');
  if (el.hasAttribute('data-q')) {
    atualizarPergunta(el);
    if (el.getAttribute('data-q') === 'tipo') abrirModal('perguntas', S.perguntas.form, true);
    if (el.getAttribute('data-q') === 'ativa') el.closest('.perg').classList.toggle('oculta', !el.checked);
    return;
  }
  if (el.hasAttribute('data-serv')) {
    var sid0 = el.closest('[data-servico]').getAttribute('data-servico'), campo = {};
    campo[el.getAttribute('data-serv')] = el.value;
    return salvarServicoCampo(sid0, campo, 'Salvo');
  }
  var campoServ = { 'serv-etapa': 'etapa', 'serv-status': 'status', 'serv-area': 'area_id', 'definir-area': 'area_id' }[a];
  if (campoServ) {
    if (campoServ === 'area_id' && !el.value) return;
    var sid = el.getAttribute('data-servico') || el.closest('[data-servico]').getAttribute('data-servico'), novo = {};
    novo[campoServ] = el.value;
    salvarServicoCampo(sid, novo, campoServ === 'area_id' ? 'Área definida' : 'Atualizado');
  }
  if (a === 'so-ae') { S.soAE = el.checked; render(); }
  if (a === 'tr-area') { S.trArea = el.value; render(); }
  if (a === 'filtro-equipe') { S.filtroEquipe = el.value; render(); }
  if (a === 'perfil-acesso') { var box = el.closest('form').querySelector('.escopo'); if (box) box.hidden = el.value !== 'lider'; }
  if (a === 'papel-onde') { var l = el.closest('.papel'); l.querySelector('[data-p=zfam]').hidden = el.value !== 'zfam'; }
  if (el.hasAttribute('data-outro')) {
    var inp = el.parentNode.querySelector('[name="' + el.name + '__outro"]');
    if (inp) { inp.hidden = inp.disabled = el.value !== '__outro'; if (!inp.hidden) inp.focus(); }
  }
});
function refocar(sel, t) {
  var pos = t.selectionStart; render();
  var b = document.querySelector(sel); if (b) { b.focus(); try { b.setSelectionRange(pos, pos); } catch (e) { } }
}
document.addEventListener('input', function (ev) {
  var t = ev.target, a = t.getAttribute('data-acao');
  if (t.hasAttribute('data-q')) atualizarPergunta(t);
  if (a === 'busca') { S.busca = t.value; refocar('[data-acao=busca]', t); }
  if (a === 'busca-equipe') { S.buscaEquipe = t.value; refocar('[data-acao=busca-equipe]', t); }
  if (a === 'busca-add') resultadosAdd(t.value);
  if (a === 'busca-trainee' && document.getElementById('res-trainee')) resultadosAdd(t.value, 'res-trainee', 'trainee-escolher');
});
function dadosForm(f) {
  var o = {};
  new FormData(f).forEach(function (v, k) { o[k] = o[k] !== undefined ? o[k] + ', ' + v : v; });
  return o;
}
function juntarOutros(o) {
  Object.keys(o).forEach(function (k) {
    if (!/__outro$/.test(k)) return;
    var b = k.slice(0, -7), v = String(o[k] || '').trim();
    if (o[b] === '__outro') o[b] = v; else if (v) o[b] = o[b] ? o[b] + ', ' + v : v;
    delete o[k];
  });
}
document.addEventListener('submit', function (ev) {
  ev.preventDefault();
  var f = ev.target, tipo = f.getAttribute('data-form'), o = dadosForm(f), botao = f.querySelector('[type=submit]');
  var depois = function (msg, fechar) { return function (r) { if (fechar) fecharModal(); aplicar(r); toast(msg); }; };
  var travar = function () { if (botao) botao.disabled = true; };
  var soltar = function (e) { if (botao) botao.disabled = false; falha(e); };
  if (tipo === 'login-senha') { travar(); S.loginEmail = o.email; api('entrarComSenha', o.email, o.senha).then(entrou).catch(soltar); }
  if (tipo === 'login-codigo') { travar(); api('entrarComCodigo', String(o.codigo || '').trim().toUpperCase()).then(entrou).catch(soltar); }
  if (tipo === 'login-email1') {
    travar(); S.loginEmail = o.email;
    api('pedirCodigoEmail', o.email).then(function () { S.login = 'email2'; S.loginMsg = ''; render(); }).catch(soltar);
  }
  if (tipo === 'login-email2' || tipo === 'confirmar-cadastro') {
    if (o.senha !== o.senha2) return toast('As duas senhas não são iguais.', true);
    var email = tipo === 'login-email2' ? S.loginEmail : S.cadastroFeito.email;
    travar();
    api('confirmarCodigoEmail', email, o.codigo, o.senha, S.cadastroFeito && S.cadastroFeito.nome).then(function (r) {
      S.loginEmail = email;
      if (r.token) { if (PAGINA !== 'painel') { history.replaceState(null, '', urlSite()); PAGINA = 'painel'; } entrou(r); return; }
      if (tipo === 'confirmar-cadastro') { S.cadastroFeito.confirmado = true; telaCadastroFeito(S.cadastroFeito); return; }
      S.login = 'senha';
      S.loginMsg = 'Senha criada. O seu acesso ao painel ainda não foi liberado pelo RH das AEs: você recebe um e-mail quando for.';
      render();
    }).catch(soltar);
  }
  if (tipo === 'pessoa') {
    var nova = !o.id;
    api('salvarPessoa', o).then(function (r) {
      aplicar(r); toast('Dados salvos');
      if (!nova) return;
      if (S.pendente) {
        var pend = S.pendente; S.pendente = null;
        api('salvarServico', { pessoa_id: r.salvo, area_id: pend.area, etapa: pend.etapa, status: 'Ativo' })
          .then(function (r2) { aplicar(r2); abrirModal('pessoa', r.salvo); toast('Cadastrado e colocado na área'); }).catch(falha);
      } else abrirModal('pessoa', r.salvo);
    }).catch(falha);
  }
  if (tipo === 'trainee') {
    travar();
    var pessoa = o.pessoa_id ? { id: o.pessoa_id } : { nome: o.nome, nascimento: o.nascimento, telefone: o.telefone, zfam: o.zfam };
    api('adicionarTrainee', pessoa, { area_id: o.area_id, etapa: o.etapa, horario: o.horario, welcome: o.welcome })
      .then(function (r) { S.novoTrainee = null; fecharModal(); aplicar(r); toast('Trainee salvo'); }).catch(soltar);
  }
  if (tipo === 'area') api('salvarArea', o).then(depois('Área salva', true)).catch(falha);
  if (tipo === 'meta') api('salvarMeta', o).then(depois('Meta salva', true)).catch(falha);
  if (tipo === 'zfam') api('salvarZfam', o).then(depois('ZFAM salvo', true)).catch(falha);
  if (tipo === 'inscricao') api('salvarInscricao', o).then(depois('Inscrição salva', true)).catch(falha);
  if (tipo === 'adulto') {
    var ps = lerPapeisDe(f), erro = ps.length ? validarPapeis(ps) : '';
    if (erro) return toast(erro, true);
    o.funcoes = JSON.stringify(ps);
    o.ministerios = o.ministerios || ''; o.areas_ae = o.areas_ae || '';
    api('salvarEquipe', o).then(depois('Salvo', true)).catch(falha);
  }
  if (tipo === 'acesso') {
    o.enviar = !!o.enviar; o.escopo = o.escopo || '';
    api('salvarAcesso', o).then(function (r) { aplicar(r); if (r.acesso) { S.codigoNovo = r.acesso; abrirModal('codigo'); } else { fecharModal(); toast('Acesso salvo'); } }).catch(falha);
  }
  if (tipo === 'aprovar') api('aprovarCadastro', o.id, o.perfil, o.escopo || '').then(function (r) { aplicar(r); S.codigoNovo = r.acesso; abrirModal('codigo'); }).catch(falha);
  if (tipo === 'inscrever') {
    juntarOutros(o); travar();
    api('inscrever', o).then(function () {
      document.getElementById('app').innerHTML = paginaAberta('Inscrição enviada', 'Recebemos sua inscrição pra servir no Flow. Em breve alguém do time fala com você pelo WhatsApp.');
      window.scrollTo(0, 0);
    }).catch(soltar);
  }
  if (tipo === 'cadastro') {
    juntarOutros(o);
    var papeis = lerPapeisDe(f), err = validarPapeis(papeis);
    if (err) return toast(err, true);
    o.papeis = JSON.stringify(papeis);
    travar();
    api('cadastrarCrew', o).then(telaCadastroFeito).catch(soltar);
  }
});

/* ---------- páginas abertas: inscrição e cadastro da CREW ---------- */
function paginaAberta(titulo, texto, corpo, eyebrow) {
  return '<header class="pub-h"><div class="in"><img src="logo-claro.png" alt="FLOW"><div class="faixa"></div>' + (eyebrow ? '<p class="eyebrow" style="color:var(--navy-ink);font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;margin-bottom:4px">' + eyebrow + '</p>' : '') +
    '<h1>' + titulo + '</h1><p>' + texto + '</p></div></header><main class="pub">' + (corpo || '') + '</main>';
}
function campoPergunta(q, F) {
  var nome = q.campo || 'q_' + q.id, req = q.obrigatoria ? ' required' : '', rot = esc(q.texto) + (q.obrigatoria ? ' *' : '');
  var ajuda = q.ajuda ? '<small>' + esc(q.ajuda) + '</small>' : '', op = String(q.opcoes || '').split('|').filter(Boolean), campo, largo = false;
  switch (q.tipo) {
    case 'paragrafo': campo = '<textarea name="' + nome + '"' + req + '></textarea>'; largo = true; break;
    case 'data': campo = '<input type="date" name="' + nome + '"' + req + '>'; break;
    case 'telefone': campo = '<input type="tel" name="' + nome + '" placeholder="(11) 90000-0000"' + req + '>'; break;
    case 'email': campo = '<input type="email" name="' + nome + '"' + req + '>'; largo = true; break;
    case 'escolha': campo = '<select name="' + nome + '"' + req + '>' + opts(op, '', 'Escolha') + '</select>'; break;
    case 'multipla':
      return '<div class="field full">' + rot + ajuda + '<div class="checks">' + op.map(function (o) {
        return '<label><input type="checkbox" name="' + nome + '" value="' + esc(o) + '"> ' + esc(o) + '</label>';
      }).join('') + '</div><input type="text" name="' + nome + '__outro" placeholder="Outro (opcional)" style="margin-top:6px"></div>';
    case 'zfam':
      campo = '<select name="' + nome + '" data-outro="1"' + req + '>' + opts(F.zfams, '', q.obrigatoria ? 'Escolha' : '—') +
        '<option value="__outro">Outro / não está na lista</option></select><input type="text" name="' + nome + '__outro" placeholder="Nome do líder do seu ZFAM" hidden disabled>';
      largo = true; break;
    case 'area': campo = '<select name="' + nome + '"' + req + '>' + opts(F.areas.map(function (a) { return a.nome; }), '', q.obrigatoria ? 'Escolha' : 'Ainda não sei') + '</select>'; break;
    case 'papeis':
      return '<div class="field full">' + rot + '<small>Uma linha por lugar.</small>' + ajudaNiveis() + '<div class="papeis-linhas">' + linhaPapel(F) + '</div>' +
        '<div><button type="button" class="btn sm" data-acao="papel-mais">+ outro lugar</button></div></div>';
    default: campo = '<input type="text" name="' + nome + '"' + req + '>'; largo = true;
  }
  return '<label class="field' + (largo ? ' full' : '') + '">' + rot + ajuda + campo + '</label>';
}
function telaInscricao(F) {
  return paginaAberta('Quero servir no Flow', 'Preencha pra entrar no processo de voluntários. Pra servir, você precisa estar num ZFAM e ter pelo menos 6 meses de Flow. ' +
    'O caminho é: Welcome Flow (presencial) → 2 dias de trainee → voluntário.',
    '<form data-form="inscrever" class="card form">' + F.perguntas.map(function (q) { return campoPergunta(q, F); }).join('') +
    '<div class="acoes full"><button class="btn primary" type="submit">Enviar inscrição</button></div></form>', 'Áreas Executivas');
}
function iniciarCadastro() {
  api('formularioPublico', 'cadastro').then(function (F) {
    S.form = F;
    document.getElementById('app').innerHTML = paginaAberta('Cadastro de quem serve no Flow',
      'Conte onde você serve e qual a sua responsabilidade em cada lugar. Se você lidera (Core, Head, líder ou auxiliar), este cadastro também cria a sua conta pra entrar no painel: a gente manda um código pro seu e-mail pra confirmar.',
      '<form data-form="cadastro" class="card form">' + F.perguntas.map(function (q) { return campoPergunta(q, F); }).join('') +
      '<div class="acoes full"><button class="btn primary" type="submit">Enviar cadastro</button></div></form>' +
      '<p style="text-align:center;margin-top:18px"><a class="lnk" href="' + urlSite() + '">Já tenho conta: entrar no painel</a></p>', 'CREW FLOW');
    window.scrollTo(0, 0);
  }).catch(falha);
}
function telaCadastroFeito(r) {
  S.cadastroFeito = r;
  var corpo, titulo, texto;
  if (r.confirmar && !r.confirmado) {
    titulo = 'Confirme o seu e-mail';
    texto = 'Mandamos um código de 6 números para <b>' + esc(r.para) + '</b>. Digite aqui e crie a sua senha: depois você entra no painel só com o e-mail e a senha.';
    corpo = '<div class="card" style="max-width:440px">' + formConfirmar('confirmar-cadastro') + '<p class="kpi-d" style="margin-top:12px">Não chegou? Olhe o spam e a aba Promoções. O código vale por 20 minutos.</p></div>';
  } else {
    var T = {
      'Aprovado (automático)': ['Acesso liberado', 'Seus dados bateram com a liderança das planilhas. Entre com o seu e-mail e a sua senha.'],
      'Já tinha acesso': ['Você já tem acesso', 'Entre com o seu e-mail e a sua senha.' + (r.ampliar ? ' Os lugares novos que você marcou vão ser conferidos pelo RH das AEs.' : '')],
      'Pendente': ['Cadastro recebido', 'Como você marcou liderança, o RH das AEs vai conferir e liberar o seu acesso. Você recebe um e-mail quando for liberado e entra com o e-mail e a senha.'],
      'Só cadastro': ['Cadastro feito', 'Seus dados entraram na CREW FLOW. Obrigado por servir com a gente!']
    }[r.status] || ['Cadastro feito', ''];
    titulo = T[0]; texto = T[1];
    corpo = r.status === 'Só cadastro' ? '' : '<a class="btn primary" href="' + urlSite() + '">Ir pro painel</a>';
  }
  document.getElementById('app').innerHTML = paginaAberta(titulo, texto, corpo, 'CREW FLOW');
  window.scrollTo(0, 0);
}

/* ---------- início ---------- */
(function () {
  if (PAGINA === 'inscricao') {
    api('formularioPublico', 'inscricao').then(function (F) { S.form = F; document.getElementById('app').innerHTML = telaInscricao(F); }).catch(falha);
    return;
  }
  if (PAGINA === 'cadastro') { iniciarCadastro(); return; }
  PAGINA = 'painel';
  if (!S.token) { render(); return; }
  // abre na hora com o que já estava nesta aba, e atualiza em seguida
  var antes = lembrarSessao('aes-r');
  if (antes) { try { S.r = JSON.parse(antes); render(); } catch (e) { S.r = null; } }
  render();
  api('sessao').then(aplicar).catch(function (e) { if (!S.r) { S.token = ''; guardar('aes-token', null); render(); } falha(e); });
})();
