#!/usr/bin/env node

/**
 * @file report-code-for-ia-gpt-node.js
 * @description Gera um relatório de código-fonte de um diretório para ser
 *   consumido por modelos de linguagem (LLM/GPT). Suporta modo interativo
 *   (prompts no terminal) e modo não-interativo via flags de linha de comando.
 *
 * @usage
 *   node report-code-for-ia-gpt-node.js [flags]
 *
 * @flags
 *   -h, --help                        Exibe esta ajuda e encerra
 *   -l, --lang        <pt|en>         Idioma das mensagens            [padrão: pt]
 *   -d, --dir         <caminho>       Diretório raiz a escanear       [padrão: ./]
 *   -o, --output      <arquivo>       Nome do arquivo de saída        [padrão: _report-code-for-ia-gpt-<timestamp>.txt]
 *   -t, --tree-only                   Exporta apenas a árvore de diretórios
 *   -g, --gitignore                   Adiciona regra de exclusão ao .gitignore
 *   -i, --ignore      <pasta,...>     Pastas adicionais a ignorar (vírgula ou múltiplas flags)
 *   -e, --ext         <.ext,...>      Extensões permitidas            [padrão: .js,.ts,.jsx,.tsx,.json]
 *   -s, --max-size    <kb>            Tamanho máximo de arquivo em KB [padrão: 200]
 *       --no-strip-comments           Mantém comentários no código coletado
 *
 * @example
 *   # Modo interativo (sem flags)
 *   node report-code-for-ia-gpt-node.js
 *
 *   # Modo não-interativo completo
 *   node report-code-for-ia-gpt-node.js --dir ./meu-projeto --lang en --tree-only --gitignore
 *
 *   # Personalizar extensões e pastas ignoradas
 *   node report-code-for-ia-gpt-node.js -d ./src -e .js,.ts -i coverage,tmp
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

// ================= BRAND =================
const APP_NAME = 'report-code-for-ia-gpt-node';

// ================= DEFAULTS =================

/** Pastas ignoradas por padrão na varredura. */
const DEFAULT_IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', '.cache'];

/** Extensões de arquivo coletadas por padrão. */
const DEFAULT_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.json'];

/** Tamanho máximo de arquivo em bytes (padrão: 200 KB). */
const DEFAULT_MAX_SIZE_BYTES = 200 * 1024;

// ================= FLAGS / ARG PARSING =================

/**
 * Faz parse simples dos argumentos de `process.argv`.
 * Suporta flags booleanas (`--flag`) e flags com valor (`--flag valor` ou `--flag=valor`).
 *
 * @returns {{
 *   help: boolean,
 *   lang: string|null,
 *   dir: string|null,
 *   output: string|null,
 *   treeOnly: boolean,
 *   gitignore: boolean,
 *   ignore: string[],
 *   ext: string[]|null,
 *   maxSize: number|null,
 *   stripComments: boolean
 * }} Objeto com as opções parseadas.
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    help: false,
    lang: null,
    dir: null,
    output: null,
    treeOnly: false,
    gitignore: false,
    ignore: [],
    ext: null,
    maxSize: null,
    stripComments: true,
  };

  for (let i = 0; i < args.length; i++) {
    const raw = args[i];

    // Suporte a --flag=valor
    const eqIdx = raw.indexOf('=');
    const flag = eqIdx !== -1 ? raw.slice(0, eqIdx) : raw;
    const inlineVal = eqIdx !== -1 ? raw.slice(eqIdx + 1) : null;

    /** Obtém o próximo argumento como valor da flag, ou o valor inline. */
    const nextVal = () => inlineVal ?? args[++i];

    switch (flag) {
      case '-h':
      case '--help':
        opts.help = true;
        break;

      case '-l':
      case '--lang':
        opts.lang = nextVal();
        break;

      case '-d':
      case '--dir':
        opts.dir = nextVal();
        break;

      case '-o':
      case '--output':
        opts.output = nextVal();
        break;

      case '-t':
      case '--tree-only':
        opts.treeOnly = true;
        break;

      case '-g':
      case '--gitignore':
        opts.gitignore = true;
        break;

      case '-i':
      case '--ignore': {
        // Aceita lista separada por vírgula ou múltiplas flags -i
        const val = nextVal();
        if (val)
          opts.ignore.push(
            ...val
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          );
        break;
      }

      case '-e':
      case '--ext': {
        const val = nextVal();
        if (val) {
          opts.ext = val
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => (s.startsWith('.') ? s : `.${s}`));
        }
        break;
      }

      case '-s':
      case '--max-size': {
        const kb = parseInt(nextVal(), 10);
        if (!isNaN(kb)) opts.maxSize = kb * 1024;
        break;
      }

      case '--no-strip-comments':
        opts.stripComments = false;
        break;

      default:
        // Ignora flags desconhecidas silenciosamente
        break;
    }
  }

  return opts;
}

/**
 * Exibe o texto de ajuda e encerra o processo.
 */
function mostrarAjuda() {
  console.log(`
${APP_NAME}

Uso: node report-code-for-ia-gpt-node.js [flags]

Flags:
  -h, --help                  Exibe esta ajuda
  -l, --lang <pt|en>          Idioma das mensagens (padrão: pt)
  -d, --dir  <caminho>        Diretório raiz a escanear (padrão: ./)
  -o, --output <arquivo>      Nome do arquivo de saída
  -t, --tree-only             Exporta apenas a árvore de diretórios
  -g, --gitignore             Adiciona regra de exclusão ao .gitignore
  -i, --ignore <pasta,...>    Pastas extras a ignorar (vírgula ou repetir flag)
  -e, --ext <.ext,...>        Extensões coletadas (padrão: .js,.ts,.jsx,.tsx,.json)
  -s, --max-size <kb>         Tamanho máximo por arquivo em KB (padrão: 200)
      --no-strip-comments     Mantém comentários no código coletado

Exemplos:
  node report-code-for-ia-gpt-node.js
  node report-code-for-ia-gpt-node.js --dir ./src --lang en --gitignore
  node report-code-for-ia-gpt-node.js -d ./src -e .js,.ts -i coverage,tmp -s 100
  node report-code-for-ia-gpt-node.js --tree-only --dir ./meu-projeto
`);
  process.exit(0);
}

// ================= UTIL =================

/**
 * Gera um nome de arquivo de saída com timestamp para evitar colisões.
 *
 * @returns {string} Nome do arquivo no formato `_report-code-for-ia-gpt-<ISO>.txt`.
 */
function gerarNomeArquivo() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `_report-code-for-ia-gpt-${ts}.txt`;
}

/**
 * Remove comentários de linha (`//`) e de bloco (`/* … *\/`) do código-fonte
 * e colapsa linhas em branco excessivas.
 *
 * @param {string} [txt=''] Texto a ser limpo.
 * @returns {string} Texto sem comentários.
 */
function limparCodigo(txt = '') {
  return txt
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Verifica se um buffer de arquivo é texto puro (sem bytes nulos).
 *
 * @param {Buffer} buffer Buffer lido do arquivo.
 * @returns {boolean} `true` se o arquivo for texto, `false` se binário.
 */
function ehTexto(buffer) {
  return !buffer.includes(0);
}

/**
 * Exibe uma pergunta no terminal e aguarda a resposta do usuário.
 *
 * @param {string} q Texto da pergunta.
 * @returns {Promise<string>} Resposta digitada pelo usuário.
 */
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

/**
 * Exibe um seletor interativo de pastas no terminal (modo raw TTY) para que
 * o usuário escolha quais diretórios devem ser ignorados na varredura.
 *
 * Caso o processo não esteja em um TTY (ex.: pipe ou CI), retorna diretamente
 * a lista de pastas já configurada em `ignorarPastas`.
 *
 * @param {string}   base         Caminho absoluto do diretório raiz.
 * @param {string}   lang         Idioma das instruções (`'pt'` ou `'en'`).
 * @param {string[]} ignorarPastas Lista inicial de pastas marcadas para ignorar.
 * @returns {Promise<string[]>} Lista de nomes de pastas a serem ignoradas.
 */
function selecionarPastasCLI(base, lang, ignorarPastas) {
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

/**
 * Gera recursivamente uma representação em árvore ASCII do diretório.
 *
 * @param {string}   dir          Caminho do diretório a percorrer.
 * @param {string}   [prefix='']  Prefixo acumulado para indentação visual.
 * @param {string[]} ignorarPastas Pastas que devem ser omitidas da árvore.
 * @returns {string} String com a estrutura de diretórios formatada.
 */
function gerarEstrutura(dir, prefix = '', ignorarPastas) {
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
      resultado += gerarEstrutura(full, prefix + (isLast ? '    ' : '│   '), ignorarPastas);
    }
  });

  return resultado;
}

// ================= CORE =================

/**
 * Percorre recursivamente um diretório e coleta o conteúdo dos arquivos que
 * satisfaçam os critérios de extensão e tamanho. Cada arquivo é precedido
 * por um cabeçalho `### FILE: <caminho>`.
 *
 * @param {string}   dir               Caminho do diretório raiz de coleta.
 * @param {string[]} ignorarPastas      Pastas a serem ignoradas.
 * @param {string[]} extensoesPermitidas Extensões de arquivo aceitas.
 * @param {number}   tamanhoMax         Tamanho máximo em bytes por arquivo.
 * @param {boolean}  stripComments      Se `true`, remove comentários do código.
 * @returns {string} Conteúdo concatenado de todos os arquivos coletados.
 */
function coletar(dir, ignorarPastas, extensoesPermitidas, tamanhoMax, stripComments) {
  let out = '';
  const itens = fs.readdirSync(dir);

  for (const item of itens) {
    if (ignorarPastas.includes(item)) continue;

    const full = path.join(dir, item);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      out += coletar(full, ignorarPastas, extensoesPermitidas, tamanhoMax, stripComments);
    } else {
      const ext = path.extname(item);
      if (!extensoesPermitidas.includes(ext)) continue;
      if (stat.size > tamanhoMax) continue;

      try {
        const buf = fs.readFileSync(full);
        if (!ehTexto(buf)) continue;

        const conteudo = stripComments ? limparCodigo(buf.toString()) : buf.toString().trim();

        if (conteudo.length < 50) continue;

        out += `\n### FILE: ${full}\n\n${conteudo}\n`;
      } catch {
        // Ignora arquivos que não puderem ser lidos (permissões, etc.)
      }
    }
  }

  return out;
}

// ================= GITIGNORE =================

/**
 * Adiciona a regra `_report-code-for-ia-gpt-*` ao `.gitignore` do diretório
 * de trabalho atual, caso o arquivo exista e a regra ainda não esteja presente.
 */
function atualizarGitignore() {
  const gitPath = path.join(process.cwd(), '.gitignore');
  const regra = '_report-code-for-ia-gpt-*';

  if (!fs.existsSync(gitPath)) return;

  const conteudo = fs.readFileSync(gitPath, 'utf8');
  if (conteudo.includes(regra)) return;

  fs.appendFileSync(gitPath, `\n${regra}\n`);
}

// ================= EXEC =================

/**
 * Ponto de entrada principal. Determina o modo de execução:
 *
 * - **Modo não-interativo**: quando flags suficientes são fornecidas via argv,
 *   executa sem nenhuma pergunta ao usuário.
 * - **Modo interativo**: sem flags (ou com flags parciais), exibe prompts para
 *   preencher as opções faltantes.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const opts = parseArgs();

  if (opts.help) mostrarAjuda();

  // ---- Determinar modo (interativo vs não-interativo) ----
  // Considera não-interativo quando ao menos --dir foi fornecido via flag.
  const nonInteractive = opts.dir !== null;

  // ---- Idioma ----
  let lang;
  if (opts.lang !== null) {
    lang = opts.lang.trim().toLowerCase() === 'en' ? 'en' : 'pt';
  } else if (nonInteractive) {
    lang = 'pt';
  } else {
    const langInput = await perguntar('Idioma / Language (pt/en) [pt]: ');
    lang = langInput.trim().toLowerCase() === 'en' ? 'en' : 'pt';
  }

  console.log(`\n🚀 ${APP_NAME}\n`);

  // ---- Diretório base ----
  let base;
  if (opts.dir !== null) {
    base = path.resolve(opts.dir);
  } else {
    const pasta = await perguntar(lang === 'pt' ? 'Pasta (./): ' : 'Directory (./): ');
    base = path.resolve(pasta || './');
  }

  // ---- Pastas ignoradas ----
  // Mescla os defaults com qualquer pasta extra passada via --ignore.
  let ignorarPastas = [...DEFAULT_IGNORE_DIRS, ...opts.ignore];

  if (!nonInteractive) {
    // Modo interativo: abre o seletor visual somente quando não há flags.
    ignorarPastas = await selecionarPastasCLI(base, lang, ignorarPastas);
  }

  // ---- Apenas árvore ----
  let treeOnly = opts.treeOnly;
  if (!nonInteractive && !treeOnly) {
    const onlyTreeResp = await perguntar(
      lang === 'pt' ? '\nExportar apenas estrutura? (s/N): ' : '\nExport structure only? (y/N): '
    );
    treeOnly = ['s', 'y'].includes(onlyTreeResp.trim().toLowerCase());
  }

  // ---- .gitignore ----
  let addGitignore = opts.gitignore;
  if (!nonInteractive && !addGitignore) {
    const gitResp = await perguntar(
      lang === 'pt'
        ? 'Ignorar arquivo no .gitignore? (s/N): '
        : 'Ignore output in .gitignore? (y/N): '
    );
    addGitignore = ['s', 'y'].includes(gitResp.trim().toLowerCase());
  }

  if (addGitignore) atualizarGitignore();

  // ---- Configurações de coleta ----
  const extensoesPermitidas = opts.ext ?? DEFAULT_EXTENSIONS;
  const tamanhoMax = opts.maxSize ?? DEFAULT_MAX_SIZE_BYTES;
  const stripComments = opts.stripComments;
  const outputFile = opts.output ?? gerarNomeArquivo();

  // ---- Geração ----
  console.log(lang === 'pt' ? '\nGerando...\n' : '\nGenerating...\n');

  let output = `${APP_NAME}\n====================\n\n`;

  if (treeOnly) {
    output += gerarEstrutura(base, '', ignorarPastas);
  } else {
    output += coletar(base, ignorarPastas, extensoesPermitidas, tamanhoMax, stripComments);
  }

  fs.writeFileSync(outputFile, output, 'utf8');

  console.log(`✔ ${outputFile}`);
}

main();
