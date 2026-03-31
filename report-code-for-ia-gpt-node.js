#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';

// ================= BRAND =================
const APP_NAME = 'report-code-for-ia-gpt-node';

// ================= CONFIG =================
let ignorarPastas = ['node_modules', '.git', 'dist', 'build', '.next', '.cache'];

let extensoesPermitidas = ['.js', '.ts', '.jsx', '.tsx', '.json'];
let TAMANHO_MAX = 200 * 1024;

let outputFile = gerarNomeArquivo();

// ================= UTIL =================
function gerarNomeArquivo() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `_repost-code-for-ia-gpt-${ts}.txt`;
}

function limparCodigo(txt = '') {
  return txt
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function ehTexto(buffer) {
  return !buffer.includes(0);
}

function perguntar(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) =>
    rl.question(q, (ans) => {
      rl.close();
      res(ans);
    })
  );
}

// ================= I18N =================
function t(lang, key) {
  const dict = {
    pt: {
      header: `\n🚀 ${APP_NAME}\nPreparando seu projeto para IA\n`,
      pasta: 'Pasta alvo (enter = ./): ',
      ignorar: 'Pastas para ignorar (use espaço): ',
      ignoradas: 'Pastas ignoradas:',
      git: 'Adicionar regra no .gitignore? (s/N): ',
      wildcard: 'Digite wildcard (ex: *.log): ',
      gerando: 'Gerando contexto...',
      pronto: 'Arquivo gerado:',
      git_nao_existe: '.gitignore não encontrado',
      ja_existe: 'Já existe no .gitignore',
      adicionado: 'Adicionado ao .gitignore',
    },
    en: {
      header: `\n🚀 ${APP_NAME}\nPreparing your project for AI\n`,
      pasta: 'Target folder (enter = ./): ',
      ignorar: 'Folders to ignore (space separated): ',
      ignoradas: 'Ignored folders:',
      git: 'Add rule to .gitignore? (y/N): ',
      wildcard: 'Enter wildcard (e.g. *.log): ',
      gerando: 'Generating context...',
      pronto: 'File generated:',
      git_nao_existe: '.gitignore not found',
      ja_existe: 'Already exists in .gitignore',
      adicionado: 'Added to .gitignore',
    },
  };

  return dict[lang][key];
}

// ================= CORE =================
function coletar(dir) {
  let out = '';
  const itens = fs.readdirSync(dir);

  for (const item of itens) {
    if (ignorarPastas.includes(item)) continue;

    const full = path.join(dir, item);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      out += coletar(full);
    } else {
      const ext = path.extname(item);
      if (!extensoesPermitidas.includes(ext)) continue;
      if (stat.size > TAMANHO_MAX) continue;

      try {
        const buf = fs.readFileSync(full);
        if (!ehTexto(buf)) continue;

        let conteudo = limparCodigo(buf.toString());
        if (conteudo.length < 50) continue;

        out += `\n### FILE: ${full}\n\n${conteudo}\n`;
      } catch {}
    }
  }

  return out;
}

// ================= GITIGNORE =================
function atualizarGitignore(wildcard, lang) {
  const gitPath = path.join(process.cwd(), '.gitignore');

  if (!fs.existsSync(gitPath)) {
    console.log(t(lang, 'git_nao_existe'));
    return;
  }

  const conteudo = fs.readFileSync(gitPath, 'utf8');

  if (conteudo.includes(wildcard)) {
    console.log(t(lang, 'ja_existe'));
    return;
  }

  fs.appendFileSync(gitPath, `\n${wildcard}\n`);
  console.log(t(lang, 'adicionado'));
}

// ================= EXEC =================
async function main() {
  const langInput = await perguntar('Idioma / Language (pt/en) [pt]: ');
  const lang = langInput.trim().toLowerCase() === 'en' ? 'en' : 'pt';

  console.log(t(lang, 'header'));

  const pasta = await perguntar(t(lang, 'pasta'));
  const base = path.resolve(pasta || './');

  const ignorar = await perguntar(t(lang, 'ignorar'));
  if (ignorar.trim()) {
    const extras = ignorar
      .split(' ')
      .map((s) => s.trim())
      .filter(Boolean);
    ignorarPastas = [...ignorarPastas, ...extras];
  }

  console.log('\n' + t(lang, 'ignoradas'));
  console.log(ignorarPastas.join(', '));

  const gitResp = await perguntar('\n' + t(lang, 'git'));
  if (['s', 'y'].includes(gitResp.toLowerCase())) {
    const wildcard = await perguntar(t(lang, 'wildcard'));
    if (wildcard.trim()) atualizarGitignore(wildcard.trim(), lang);
  }

  console.log('\n' + t(lang, 'gerando'));

  let output = `${APP_NAME}\n====================\n`;
  output += `Generated at: ${new Date().toISOString()}\n\n`;
  output += coletar(base);

  fs.writeFileSync(outputFile, output, 'utf8');

  console.log(`${t(lang, 'pronto')} ${outputFile}\n`);
}

main();
