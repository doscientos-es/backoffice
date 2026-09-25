#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, renameSync, writeFileSync, existsSync, openSync, closeSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'

const SHA = /^[0-9a-f]{40}$/
const PREFIX = '# Novedades\n\n'
const CATEGORIES = ['Nuevas funciones', 'Mejoras', 'Correcciones']
const OPEN = /^# Novedades\n\n<!-- changelog:cursor=([0-9a-f]{40}) -->\n\n/
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const dateOK = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s
const write = (path, data) => { const temp = `${path}.${process.pid}.tmp`; writeFileSync(temp, data, { flag: 'wx' }); renameSync(temp, path) }

function parse(source) {
  const match = source.match(OPEN)
  if (!match) throw Error('Cabecera/cursor de CHANGELOG.md inválidos')
  let rest = source.slice(match[0].length)
  const releases = []
  while (rest) {
    const entry = rest.match(/^## (\d{4}-\d{2}-\d{2}) — ([^\n<>]+)\n\n/)
    if (!entry || !dateOK(entry[1])) throw Error('Entrada inválida')
    rest = rest.slice(entry[0].length)
    const sections = []
    while (rest.startsWith('### ')) {
      const section = rest.match(/^### ([^\n]+)\n\n/)
      if (!section || !CATEGORIES.includes(section[1]) || sections.some((s) => s.title === section[1])) throw Error('Categoría inválida')
      rest = rest.slice(section[0].length)
      const items = []
      while (rest.startsWith('- ')) {
        const item = rest.match(/^- ([^\n<>]+)\n/)
        if (!item || !item[1].trim() || /\[[^\]]+\]\(/.test(item[1])) throw Error('Usa texto plano en las novedades')
        items.push(item[1]); rest = rest.slice(item[0].length)
      }
      if (!items.length || (rest && !rest.startsWith('\n'))) throw Error('Categoría vacía')
      if (rest) rest = rest.slice(1)
      sections.push({ title: section[1], items })
    }
    if (!sections.length) throw Error('Entrada sin novedades')
    releases.push({ date: entry[1], title: entry[2], sections })
  }
  return { cursor: match[1], releases, header: match[0] }
}

function pending(from, to) {
  if (spawnSync('git', ['merge-base', '--is-ancestor', from, to]).status !== 0) throw Error('El cursor no es ancestro de HEAD')
  if (from === to) return []
  return git('log', '--format=%H%x09%s', `${from}..${to}`).split('\n').map((line) => {
    const [sha, ...subject] = line.split('\t'); return { sha, subject: subject.join('\t') }
  }).filter(({ sha }) => git('diff-tree', '--no-commit-id', '--name-only', '-r', sha)
    .split('\n').some((file) => file !== 'CHANGELOG.md' && !/(^|\/)changelog\.json$/.test(file)))
}

function main([command, ...args]) {
  const head = git('rev-parse', 'HEAD')
  if (command === 'init') {
    if (existsSync('CHANGELOG.md') || !SHA.test(args[0] ?? '')) throw Error('Changelog existente o SHA base no válido')
    git('rev-parse', '--verify', `${args[0]}^{commit}`); pending(args[0], head)
    write('CHANGELOG.md', `${PREFIX}<!-- changelog:cursor=${args[0]} -->\n\n`)
    return
  }
  const source = readFileSync('CHANGELOG.md', 'utf8').replace(/\r\n/g, '\n')
  const { cursor, releases, header } = parse(source)
  if (command === 'plan') {
    console.log(JSON.stringify({ from: cursor, to: head, commits: pending(cursor, head) }, null, 2)); return
  }
  if (command === 'add') {
    const lock = openSync('CHANGELOG.md.lock', 'wx')
    try {
      if (readFileSync('CHANGELOG.md', 'utf8').replace(/\r\n/g, '\n') !== source) throw Error('El changelog cambió mientras se preparaba la entrada')
      const [to, date, title, draft] = args
      if (!SHA.test(to ?? '') || to !== head || !draft || !pending(cursor, head).length) throw Error('HEAD cambió o no hay cambios pendientes; ejecuta plan')
      if (!dateOK(date) || !title?.trim() || /[\n<>]/.test(title)) throw Error('Fecha o título inválidos')
      const { sections } = JSON.parse(readFileSync(resolve(draft), 'utf8'))
      if (!Array.isArray(sections) || !sections.length || sections.some((s) => !CATEGORIES.includes(s.title) || !Array.isArray(s.items) || !s.items.length)) throw Error('Borrador inválido')
      const entry = `## ${date} — ${title.trim()}\n\n${sections.map((s) => `### ${s.title}\n\n${s.items.map((v) => `- ${v}`).join('\n')}\n\n`).join('')}`
      parse(`${PREFIX}<!-- changelog:cursor=${to} -->\n\n${entry}`)
      write('CHANGELOG.md', `${PREFIX}<!-- changelog:cursor=${to} -->\n\n${entry}${source.slice(header.length)}`)
      console.log(`Añadida entrada ${releases.length + 1}; ejecuta sync`); return
    } finally { closeSync(lock); unlinkSync('CHANGELOG.md.lock') }
  }
  if (command === 'sync') {
    const [out, check] = args
    if (!out || (check && check !== '--check')) throw Error('Uso: sync <ruta.json> [--check]')
    const data = `${JSON.stringify({ releases }, null, 2)}\n`
    if (check) { if (!existsSync(out) || readFileSync(out, 'utf8') !== data) throw Error('JSON desactualizado'); return }
    if (!existsSync(out) || readFileSync(out, 'utf8') !== data) write(out, data)
    return
  }
  throw Error('Uso: init <sha> | plan | add <sha> <AAAA-MM-DD> <título> <borrador.json> | sync <ruta.json> [--check]')
}

try { main(process.argv.slice(2)) } catch (error) { console.error(error.message); process.exitCode = 1 }