/**
 * CustomGroups — Right panel for advanced mode.
 *
 * Manages a list of user-defined proxy groups. Each group card has:
 *   - Editable name
 *   - Action selector (PROXY / DIRECT / REJECT)
 *   - List of assigned catalog groups/categories
 *   - Drag handle for reordering cards via SortableJS
 *
 * SortableJS is used for:
 *   1. Card-level reorder (outer list)
 *   2. Item-level reorder within each card
 */

import Sortable from 'sortablejs'
import { catalogIndex } from './catalog.js'

let _nextId = 1

export class CustomGroups {
  /**
   * @param {HTMLElement} container
   * @param {function():void} onChange  — called whenever groups change
   */
  constructor(container, onChange) {
    this._groups    = []   // [{ id, name, action, members: [{type, id, label}] }]
    this._onChange  = onChange
    this._container = container
    this._sortable  = null
    this._render()
  }

  // ── public ───────────────────────────────────────────────────────────────────

  /**
   * Add a catalog group or category to the first group, or create a new group.
   * Called from AdvancedBrowser when user clicks +.
   */
  addItem(type, id, label) {
    if (!this._groups.length) this._addGroup()
    const target = this._groups[this._groups.length - 1]
    if (target.members.find(m => m.id === id)) return  // deduplicate
    target.members.push({ type, id, label })
    this._onChange()
    this._renderCards()
  }

  /**
   * Add an item to a specific group by group index.
   */
  addItemToGroup(groupIdx, type, id, label) {
    const g = this._groups[groupIdx]
    if (!g) return
    if (g.members.find(m => m.id === id)) return
    g.members.push({ type, id, label })
    this._onChange()
    this._renderCards()
  }

  /** Load groups from a preset's group list (catalog group IDs). */
  setFromPreset(groupIds) {
    this._groups = groupIds.map(gid => ({
      id:      `cg-${_nextId++}`,
      name:    catalogIndex[gid]?.name || gid,
      action:  catalogIndex[gid]?.defaultAction || 'PROXY',
      members: [{ type: 'group', id: gid, label: catalogIndex[gid]?.name || gid }],
    }))
    this._onChange()
    this._renderCards()
  }

  /** Returns the current group config for use by ProfileBuilder. */
  getConfig() {
    return this._groups.map(g => ({
      name:    g.name,
      action:  g.action,
      members: g.members,
    }))
  }

  /** True if there are no groups or all groups are empty. */
  isEmpty() {
    return !this._groups.length || this._groups.every(g => !g.members.length)
  }

  // ── private ──────────────────────────────────────────────────────────────────

  _render() {
    this._container.innerHTML = `
      <div class="adv-cg-header">
        <span style="font-size:0.85rem;color:#8b949e">自定义代理组</span>
        <button class="btn btn-sm" id="adv-add-group">+ 新建组</button>
      </div>
      <div id="adv-cg-list" class="adv-cg-list"></div>
    `
    this._container.querySelector('#adv-add-group').addEventListener('click', () => {
      this._addGroup()
      this._renderCards()
    })
    this._renderCards()
  }

  _addGroup() {
    this._groups.push({
      id:      `cg-${_nextId++}`,
      name:    `代理组 ${this._groups.length + 1}`,
      action:  'PROXY',
      members: [],
    })
    this._onChange()
  }

  _renderCards() {
    const list = this._container.querySelector('#adv-cg-list')
    list.innerHTML = ''

    if (!this._groups.length) {
      list.innerHTML = '<div style="padding:2rem 0;color:#8b949e;text-align:center;font-size:0.85rem">点击"+ 新建组"创建代理组，<br>然后从左侧添加规则集</div>'
      return
    }

    for (let i = 0; i < this._groups.length; i++) {
      list.appendChild(this._renderCard(i))
    }

    // Card-level SortableJS
    if (this._sortable) this._sortable.destroy()
    this._sortable = Sortable.create(list, {
      handle:    '.adv-drag-handle',
      animation: 150,
      onEnd: e => {
        const moved = this._groups.splice(e.oldIndex, 1)[0]
        this._groups.splice(e.newIndex, 0, moved)
        this._onChange()
      },
    })
  }

  _renderCard(idx) {
    const g   = this._groups[idx]
    const action = g.action || 'PROXY'
    const card = document.createElement('div')
    card.className = 'adv-cg-card'
    card.dataset.id = g.id

    const actionColor = action === 'REJECT' ? 'block' : action === 'DIRECT' ? 'direct' : 'proxy'
    card.innerHTML = `
      <div class="adv-card-header">
        <span class="adv-drag-handle" title="拖动排序">⠿</span>
        <input class="adv-name-input" value="${_esc(g.name)}" title="点击编辑名称" />
        <select class="adv-action-sel">
          <option value="PROXY"  ${action === 'PROXY'  ? 'selected' : ''}>PROXY</option>
          <option value="DIRECT" ${action === 'DIRECT' ? 'selected' : ''}>DIRECT</option>
          <option value="REJECT" ${action === 'REJECT' ? 'selected' : ''}>REJECT</option>
        </select>
        <button class="adv-del-card" data-idx="${idx}" title="删除">✕</button>
      </div>
      <div class="adv-card-items" id="adv-items-${g.id}">
        ${g.members.map((m, mi) => `
          <div class="adv-card-item" data-mi="${mi}">
            <span class="adv-item-label">${_esc(m.label)}</span>
            <button class="adv-del-item" data-gidx="${idx}" data-midx="${mi}" title="移除">✕</button>
          </div>
        `).join('')}
        ${!g.members.length ? '<div class="adv-empty-hint">从左侧点击 + 添加规则集</div>' : ''}
      </div>
    `

    card.querySelector('.adv-name-input').addEventListener('change', e => {
      this._groups[idx].name = e.target.value.trim() || g.name
      this._onChange()
    })
    card.querySelector('.adv-action-sel').addEventListener('change', e => {
      this._groups[idx].action = e.target.value
      this._onChange()
      card.querySelector('.adv-card-header').className = `adv-card-header action-${e.target.value.toLowerCase()}`
    })
    card.querySelector('.adv-del-card').addEventListener('click', () => {
      this._groups.splice(idx, 1)
      this._onChange()
      this._renderCards()
    })
    card.querySelectorAll('.adv-del-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const gi = parseInt(btn.dataset.gidx, 10)
        const mi = parseInt(btn.dataset.midx, 10)
        this._groups[gi].members.splice(mi, 1)
        this._onChange()
        this._renderCards()
      })
    })

    // Item-level SortableJS (reorder within a card)
    const itemsList = card.querySelector(`#adv-items-${g.id}`)
    if (g.members.length > 1) {
      Sortable.create(itemsList, {
        animation: 100,
        filter:    '.adv-empty-hint',
        onEnd: e => {
          const moved = this._groups[idx].members.splice(e.oldIndex, 1)[0]
          this._groups[idx].members.splice(e.newIndex, 0, moved)
          this._onChange()
        },
      })
    }

    return card
  }
}

function _esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}
