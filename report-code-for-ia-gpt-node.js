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
  return `_report-code-for-ia-gpt-${ts}.txt`;
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

// ================= SELECT CLI =================
function selecionarPastasCLI(base, lang) {
  return new Promise((resolve) => {
    const dirs = fs
      .readdirSync(base)
      .filter((item) => fs.statSync(path.join(base, item)).isDirectory());

    if (!process.stdin.isTTY) {
      console.log('Terminal não suporta modo interativo');
      return resolve(ignorarPastas);
    }

    let index = 0;
    let selecionadas = new Set(ignorarPastas);

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    function render() {
      console.clear();
      console.log(
        lang === 'pt'
          ? '↑ ↓ navegar | espaço marcar | enter confirmar\n'
          : '↑ ↓ navigate | space toggle | enter confirm\n'
      );

      dirs.forEach((dir, i) => {
        const cursor = i === index ? '❯' : ' ';
        const checked = selecionadas.has(dir) ? '◉' : '◯';
        console.log(`${cursor} ${checked} ${dir}`);
      });
    }

    function cleanup() {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('keypress', onKeypress);
    }

    function onKeypress(str, key) {
      if (!key) return;

      if (key.name === 'down') {
        index = (index + 1) % dirs.length;
      } else if (key.name === 'up') {
        index = (index - 1 + dirs.length) % dirs.length;
      } else if (key.name === 'space') {
        const dir = dirs[index];
        if (selecionadas.has(dir)) selecionadas.delete(dir);
        else selecionadas.add(dir);
      } else if (key.name === 'return') {
        cleanup();
        console.clear();
        return resolve([...selecionadas]);
      } else if (key.ctrl && key.name === 'c') {
        cleanup();
        process.exit();
      }

      render();
    }

    process.stdin.on('keypress', onKeypress);

    render();
  });
}

// ================= I18N =================
function t(lang, key) {
  const dict = {
    pt: {
      header: `\n🚀 ${APP_NAME}\nPreparando seu projeto para IA\n`,
      pasta: 'Pasta alvo (enter = ./): ',
      ignoradas: 'Pastas ignoradas:',
      git: 'Ignorar arquivos gerados no .gitignore? (s/N): ',
      gerando: 'Gerando contexto...',
      pronto: 'Arquivo gerado:',
      git_nao_existe: '.gitignore não encontrado',
      ja_existe: 'Já existe no .gitignore',
      adicionado: 'Regra adicionada ao .gitignore',
    },
    en: {
      header: `\n🚀 ${APP_NAME}\nPreparing your project for AI\n`,
      pasta: 'Target folder (enter = ./): ',
      ignoradas: 'Ignored folders:',
      git: 'Ignore generated files in .gitignore? (y/N): ',
      gerando: 'Generating context...',
      pronto: 'File generated:',
      git_nao_existe: '.gitignore not found',
      ja_existe: 'Already exists in .gitignore',
      adicionado: 'Rule added to .gitignore',
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
function atualizarGitignore(lang) {
  const gitPath = path.join(process.cwd(), '.gitignore');
  const regra = '_report-code-for-ia-gpt-*';

  if (!fs.existsSync(gitPath)) {
    console.log(t(lang, 'git_nao_existe'));
    return;
  }

  const conteudo = fs.readFileSync(gitPath, 'utf8');

  if (conteudo.includes(regra)) {
    console.log(t(lang, 'ja_existe'));
    return;
  }

  fs.appendFileSync(gitPath, `\n${regra}\n`);
  console.log(t(lang, 'adicionado'));
}

// ================= EXEC =================
async function main() {
  const langInput = await perguntar('Idioma / Language (pt/en) [pt]: ');
  const lang = langInput.trim().toLowerCase() === 'en' ? 'en' : 'pt';

  console.log(t(lang, 'header'));

  const pasta = await perguntar(t(lang, 'pasta'));
  const base = path.resolve(pasta || './');

  const selecionadas = await selecionarPastasCLI(base, lang);
  ignorarPastas = selecionadas;

  console.log('\n' + t(lang, 'ignoradas'));
  console.log(ignorarPastas.join(', '));

  const gitResp = await perguntar('\n' + t(lang, 'git'));
  if (['s', 'y'].includes(gitResp.toLowerCase())) {
    atualizarGitignore(lang);
  }

  console.log('\n' + t(lang, 'gerando'));

  let output = `${APP_NAME}\n====================\n`;
  output += `Generated at: ${new Date().toISOString()}\n\n`;
  output += coletar(base);

  fs.writeFileSync(outputFile, output, 'utf8');

  console.log(`${t(lang, 'pronto')} ${outputFile}\n`);
}

main();
