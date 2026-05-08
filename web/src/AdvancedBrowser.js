/**
 * AdvancedBrowser — Left panel for advanced mode.
 *
 * Two tabs:
 *   "By Group"  — 24 catalog groups as an accordion; expand to see member categories.
 *   "All"       — all 664 categories as a virtual-scrolled, searchable flat list.
 *
 * Emits drag events via HTML5 DnD (compatible with SortableJS put handlers).
 * Clicking a group or category calls onAdd(type, id, label).
 */

import { catalogIndex, categoriesIndex } from './ProfileBuilder.js'

const ROW_HEIGHT = 40   // px, fixed height for virtual scroll rows
const OVERSCAN   = 5    // extra rows above/below visible area

export class AdvancedBrowser {
  /**
   * @param {HTMLElement} container
   * @param {function(type:'group'|'category', id:string, label:string):void} onAdd
   */
  constructor(container, onAdd) {
    this._onAdd     = onAdd
    this._tab       = 'groups'
    this._search    = ''
    this._expanded  = new Set()
    this._allCats   = _buildCatList()
    this._filtered  = this._allCats
    this._container = container
    this._render()
  }

  // ── public ──────────────────────────────────────────────────────────────────

  /** Refresh view (e.g. after catalog loads). */
  refresh() { this._renderContent() }

  // ── private ─────────────────────────────────────────────────────────────────

  _render() {
    this._container.innerHTML = `
      <div class="adv-tabs">
        <button class="adv-tab active" data-tab="groups">按规则组</button>
        <button class="adv-tab" data-tab="all">全部分类</button>
      </div>
      <input class="adv-search" id="adv-search" type="text" placeholder="搜索分类名称..." />
      <div class="adv-browser-content" id="adv-content"></div>
    `
    this._container.querySelectorAll('.adv-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this._tab = btn.dataset.tab
        this._container.querySelectorAll('.adv-tab').forEach(b => b.classList.toggle('active', b === btn))
        this._renderContent()
      })
    })
    this._container.querySelector('#adv-search').addEventListener('input', e => {
      this._search = e.target.value.trim().toLowerCase()
      this._filtered = this._search
        ? this._allCats.filter(c => c.name.toLowerCase().includes(this._search))
        : this._allCats
      this._renderContent()
    })
    this._renderContent()
  }

  _renderContent() {
    const el = this._container.querySelector('#adv-content')
    if (this._tab === 'groups') this._renderGroups(el)
    else                        this._renderAllCats(el)
  }

  _renderGroups(el) {
    el.innerHTML = ''
    const groups = Object.entries(catalogIndex)
    for (const [gid, meta] of groups) {
      const action  = meta.defaultAction === 'REJECT' ? 'block' : meta.defaultAction === 'DIRECT' ? 'direct' : 'proxy'
      const isOpen  = this._expanded.has(gid)
      const wrap    = document.createElement('div')
      wrap.className = 'adv-group-row'
      wrap.innerHTML = `
        <div class="adv-group-header" data-gid="${gid}">
          <span class="adv-expand">${isOpen ? '▾' : '▸'}</span>
          <span class="adv-group-name">${meta.name}</span>
          <span class="adv-tag ${action}">${action}</span>
          <span class="adv-member-count">${meta.memberCount}</span>
          <button class="adv-add-btn" data-type="group" data-id="${gid}" data-label="${meta.name}" title="添加到代理组">+</button>
        </div>
      `
      if (isOpen) {
        const memberEl = document.createElement('div')
        memberEl.className = 'adv-members'
        for (const catName of (meta.members || [])) {
          const catMeta = categoriesIndex[catName]
          const type    = catMeta?.type || 'unknown'
          const row     = document.createElement('div')
          row.className = 'adv-cat-row'
          row.innerHTML = `
            <span class="adv-cat-name">${catName}</span>
            <span class="adv-type-tag ${type}">${type}</span>
            <button class="adv-add-btn" data-type="group" data-id="${gid}" data-label="${meta.name}" title="添加所属组 ${meta.name}">+</button>
          `
          memberEl.appendChild(row)
        }
        wrap.appendChild(memberEl)
      }
      el.appendChild(wrap)
      wrap.querySelector('.adv-group-header').addEventListener('click', e => {
        if (e.target.classList.contains('adv-add-btn')) return
        if (this._expanded.has(gid)) this._expanded.delete(gid)
        else this._expanded.add(gid)
        this._renderContent()
      })
    }
    el.querySelectorAll('.adv-add-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation()
        this._onAdd(btn.dataset.type, btn.dataset.id, btn.dataset.label)
      })
    })
  }

  _renderAllCats(el) {
    el.innerHTML = ''
    const items = this._filtered

    if (!items.length) {
      el.innerHTML = '<div style="padding:1rem;color:#8b949e;text-align:center">无匹配分类</div>'
      return
    }

    // Virtual scroll container
    const outer = document.createElement('div')
    outer.className = 'adv-vscroll'
    outer.style.height = '380px'
    outer.style.overflow = 'auto'
    outer.style.position = 'relative'

    const spacer = document.createElement('div')
    spacer.style.height = `${items.length * ROW_HEIGHT}px`
    outer.appendChild(spacer)

    const viewport = document.createElement('div')
    viewport.style.position = 'absolute'
    viewport.style.top = '0'
    viewport.style.width = '100%'
    outer.appendChild(viewport)

    const paint = () => {
      const top  = outer.scrollTop
      const h    = outer.clientHeight || 380
      const start = Math.max(0, Math.floor(top / ROW_HEIGHT) - OVERSCAN)
      const end   = Math.min(items.length, Math.ceil((top + h) / ROW_HEIGHT) + OVERSCAN)
      viewport.style.top = `${start * ROW_HEIGHT}px`
      viewport.innerHTML = ''
      for (let i = start; i < end; i++) {
        const c   = items[i]
        const row = document.createElement('div')
        row.className = 'adv-cat-row'
        row.style.height = `${ROW_HEIGHT}px`
        const grpBadge = c.groups.length
          ? `<span class="adv-grp-badge">${c.groups.map(g => catalogIndex[g]?.name || g).join(', ')}</span>`
          : ''
        row.innerHTML = `
          <span class="adv-cat-name">${c.name}</span>
          <span class="adv-type-tag ${c.type}">${c.type}</span>
          ${grpBadge}
          <button class="adv-add-btn" data-type="${c.groups.length ? 'group' : 'category'}"
            data-id="${c.groups[0] || c.name}"
            data-label="${c.groups.length ? (catalogIndex[c.groups[0]]?.name || c.groups[0]) : c.name}"
            title="${c.groups.length ? '添加所属组 ' + (catalogIndex[c.groups[0]]?.name || '') : '添加分类'}">+</button>
        `
        row.querySelector('.adv-add-btn').addEventListener('click', e => {
          e.stopPropagation()
          const btn = e.currentTarget
          this._onAdd(btn.dataset.type, btn.dataset.id, btn.dataset.label)
        })
        viewport.appendChild(row)
      }
    }

    outer.addEventListener('scroll', paint)
    el.appendChild(outer)
    // Initial paint after element is in DOM
    requestAnimationFrame(paint)
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function _buildCatList() {
  return Object.entries(categoriesIndex)
    .map(([name, meta]) => ({ name, type: meta.type, groups: meta.groups }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
