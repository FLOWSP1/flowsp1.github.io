# Áreas Executivas · Flow

Site do painel de voluntários das Áreas Executivas do Flow (Zion Church).

Este repositório tem **só o site** (HTML, CSS e JavaScript). Os dados ficam numa planilha do Google, que também guarda o log. O site conversa com ela por uma API em Google Apps Script (o endereço está em `config.js`). Nenhum dado de pessoa fica aqui.

- `index.html`: o painel. Com `?pagina=inscricao`, mostra o formulário de inscrição dos adolescentes. Com `?pagina=cadastro`, mostra o cadastro da CREW.
- `app.js`: as telas, as contas e as chamadas à API.
- `estilo.css`: o visual.
- `config.js`: o endereço da API.

Quem entra usa e-mail e senha (a conta é confirmada com um código mandado pro e-mail) ou o código pessoal de acesso. Cada perfil recebe do servidor só o que pode ver.
