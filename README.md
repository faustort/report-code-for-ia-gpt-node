# report-code-for-ia-gpt-node

Prepare seu projeto para análise por IA de forma rápida, limpa e inteligente.

---

## 🇧🇷 Sobre o projeto

O **report-code-for-ia-gpt-node** é uma ferramenta CLI que organiza, filtra e estrutura automaticamente o código do seu projeto para ser consumido por IAs (como ChatGPT, Copilot, Claude, etc).

Ele remove ruído, mantém apenas o que importa e gera um arquivo otimizado para análise, debugging ou revisão por modelos de linguagem.

Ideal para quem quer respostas mais precisas sem precisar copiar projeto manualmente.

---

## 🚀 O que ele faz

- Remove comentários do código automaticamente
- Ignora arquivos e pastas irrelevantes
- Filtra por extensões úteis
- Evita arquivos muito grandes
- Gera um único arquivo com todo o contexto do projeto
- Interface interativa (pt-br / english)
- Permite customizar pastas ignoradas facilmente
- Integra com `.gitignore` (opcional)

---

## ⚙️ Como usar

1. Coloque o script na raiz do projeto
2. Execute:

```
node report-code-for-ia-gpt-node.js
```

3. Siga o fluxo interativo no terminal

4. O arquivo será gerado automaticamente:

```
_repost-code-for-ia-gpt-[timestamp].txt
```

---

## 💡 Exemplo de uso real

Você pode gerar o contexto e colar direto em uma IA para:

- Revisão de código
- Encontrar bugs
- Refatoração
- Explicação de projeto legado
- Geração de documentação

---

## 🧠 Por que usar

Projetos reais têm muito ruído: logs, configs, dependências, arquivos irrelevantes.

Esse script reduz tudo isso e entrega um contexto limpo, aumentando MUITO a qualidade das respostas da IA.

---

## 🔧 Configurações suportadas

Durante a execução você pode:

- Definir pasta alvo
- Escolher pastas para ignorar (separadas por espaço)
- Adicionar regras no `.gitignore`
- Trabalhar em português ou inglês

---

## 📁 Estrutura gerada

O output segue o padrão:

```
report-code-for-ia-gpt-node
====================
Generated at: 2026-XX-XX

### FILE: /src/index.js

[código limpo aqui]
```

---

## 🌍 English

### About

**report-code-for-ia-gpt-node** is a CLI tool that prepares your codebase for AI analysis.

It removes noise, filters irrelevant files and generates a clean context optimized for LLMs.

---

### Features

- Removes comments automatically
- Ignores unnecessary folders/files
- Filters by file extensions
- Skips large files
- Generates a single AI-ready file
- Interactive CLI (pt-br / english)
- Optional `.gitignore` integration

---

### Usage

```
node report-code-for-ia-gpt-node.js
```

Follow the interactive steps and your file will be generated.

---

### Output

```
_repost-code-for-ia-gpt-[timestamp].txt
```

---

## ☕ Apoie o projeto

Se esse projeto te ajudou, considere apoiar:

https://www.buymeacoffee.com/faustort

---

## 📄 Licença

BSD 3-Clause License
