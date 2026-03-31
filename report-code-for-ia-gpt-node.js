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

    if (!process.stdin.isTTY) return resolve(ignorarPastas);

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

      if (key.name === 'down') index = (index + 1) % dirs.length;
      else if (key.name === 'up') index = (index - 1 + dirs.length) % dirs.length;
      else if (key.name === 'space') {
        const dir = dirs[index];
        selecionadas.has(dir) ? selecionadas.delete(dir) : selecionadas.add(dir);
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

// ================= TREE =================
function gerarEstrutura(dir, prefix = '') {
  let resultado = '';
  const itens = fs.readdirSync(dir);

  itens.forEach((item, idx) => {
    if (ignorarPastas.includes(item)) return;

    const full = path.join(dir, item);
    const stat = fs.statSync(full);

    const isLast = idx === itens.length - 1;
    const branch = isLast ? '└── ' : '├── ';

    resultado += prefix + branch + item + '\n';

    if (stat.isDirectory()) {
      resultado += gerarEstrutura(full, prefix + (isLast ? '    ' : '│   '));
    }
  });

  return resultado;
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

  if (!fs.existsSync(gitPath)) return;

  const conteudo = fs.readFileSync(gitPath, 'utf8');
  if (conteudo.includes(regra)) return;

  fs.appendFileSync(gitPath, `\n${regra}\n`);
}

// ================= EXEC =================
async function main() {
  const langInput = await perguntar('Idioma / Language (pt/en) [pt]: ');
  const lang = langInput.trim().toLowerCase() === 'en' ? 'en' : 'pt';

  console.log(`\n🚀 ${APP_NAME}\n`);

  const pasta = await perguntar('Pasta (./): ');
  const base = path.resolve(pasta || './');

  ignorarPastas = await selecionarPastasCLI(base, lang);

  const onlyTree = await perguntar(
    lang === 'pt' ? '\nExportar apenas estrutura? (s/N): ' : '\nExport structure only? (y/N): '
  );

  const gitResp = await perguntar(
    lang === 'pt'
      ? 'Ignorar arquivo no .gitignore? (s/N): '
      : 'Ignore output in .gitignore? (y/N): '
  );

  if (['s', 'y'].includes(gitResp.toLowerCase())) {
    atualizarGitignore(lang);
  }

  console.log('\nGerando...\n');

  let output = `${APP_NAME}\n====================\n\n`;

  if (['s', 'y'].includes(onlyTree.toLowerCase())) {
    output += gerarEstrutura(base);
  } else {
    output += coletar(base);
  }

  fs.writeFileSync(outputFile, output, 'utf8');

  console.log(`✔ ${outputFile}`);
}

main();
