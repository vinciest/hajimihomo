import {
  loadCatalog, presets,
  buildSingboxRuleSets, buildFullProfile, buildProfileFromCustomGroups,
} from './ProfileBuilder.js'
import { AdvancedBrowser } from './AdvancedBrowser.js'
import { CustomGroups } from './CustomGroups.js'

const app = document.getElementById('app')

app.innerHTML = `
  <!-- ── Always-visible: kernel + subs + features ───────────────────────── -->
  <div class="section">
    <label>内核 / 输出格式</label>
    <select id="kernel">
      <option value="mihomo">mihomo (Clash Meta) — 完整配置</option>
      <option value="mihomo-smart">mihomo-smart (vernesong fork) — 完整配置 + smart 分组</option>
      <option value="singbox">sing-box — 路由规则片段</option>
    </select>
  </div>

  <div class="section">
    <label>订阅链接（每行一个）</label>
    <textarea id="subs" placeholder="https://your-subscription-url/...&#10;https://backup-subscription-url/..."></textarea>
  </div>

  <div class="section">
    <label>功能开关</label>
    <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-top:0.4rem">
      <label class="cat-item"><input type="checkbox" id="feat-ads" checked> 广告拦截</label>
      <label class="cat-item"><input type="checkbox" id="feat-tracking"> 追踪拦截</label>
      <label class="cat-item"><input type="checkbox" id="feat-quic"> 屏蔽 QUIC</label>
      <label class="cat-item"><input type="checkbox" id="feat-tun"> TUN 模式</label>
      <label class="cat-item"><input type="checkbox" id="feat-dashboard"> 控制面板（:9090）</label>
    </div>
  </div>

  <!-- ── Mode toggle ──────────────────────────────────────────────────────── -->
  <div class="mode-toggle section">
    <button id="mode-simple" class="active">📋 简单模式</button>
    <button id="mode-advanced">⚙️ 高级模式</button>
  </div>

  <!-- ── Simple mode: preset only ────────────────────────────────────────── -->
  <div id="simple-mode">
    <div class="section">
      <label>预设</label>
      <select id="preset">
        <option value="custom">自定义</option>
      </select>
    </div>
  </div>

  <!-- ── Advanced mode: output options + builder ─────────────────────────── -->
  <div id="advanced-mode" style="display:none">
    <div class="adv-opts-grid section">
      <div>
        <label>分组结构</label>
        <select id="topology">
          <option value="global">全局 — 单一代理池</option>
          <option value="regional" selected>分区 — 各地区独立测速（推荐）</option>
          <option value="advanced">高级 — 分区 + 负载均衡</option>
        </select>
      </div>
      <div>
        <label>地理数据源</label>
        <select id="geodata">
          <option value="metacubex">MetaCubeX（轻量）</option>
          <option value="dustinwin">DustinWin（完整）</option>
        </select>
      </div>
      <div id="format-wrap">
        <label>规则集格式</label>
        <select id="format">
          <option value="yaml-split" selected>YAML 分离（推荐）</option>
          <option value="yaml-classical">YAML 经典</option>
          <option value="binary">Binary .mrs</option>
        </select>
      </div>
      <div id="tier-wrap" style="display:none">
        <label>规则集格式（sing-box）</label>
        <select id="tier">
          <option value="1">Tier 1 — 经典合并</option>
          <option value="2" selected>Tier 2 — 分离格式</option>
        </select>
      </div>
      <div>
        <label>排除节点关键词（正则）</label>
        <input id="region-excludes" type="text" placeholder="例: 5x|10x|0.5x" />
      </div>
      <div>
        <label>负载均衡</label>
        <div style="padding-top:0.55rem">
          <label class="cat-item" id="feat-lb-wrap"><input type="checkbox" id="feat-lb"> 启用（需高级拓扑）</label>
        </div>
      </div>
    </div>

    <div class="advanced-layout">
      <div class="adv-panel" id="adv-browser-panel"></div>
      <div class="adv-panel" id="adv-groups-panel"></div>
    </div>
    <div style="margin-bottom:0.5rem;font-size:0.8rem;color:#8b949e">
      点击左侧规则组旁的 <strong>+</strong> 按钮将其添加到右侧代理组；右侧可拖动 ⠿ 调整顺序。
    </div>
  </div>

  <div style="margin-top:1.5rem">
    <button class="btn" id="generate">生成配置</button>
    <button class="btn btn-secondary" id="copy">复制</button>
    <button class="btn btn-secondary" id="download">下载 .yaml</button>
  </div>

  <div id="output" class="output-block" style="display:none"></div>
`

let catalog = null
let simpleGroups = new Set()   // groups selected by preset (simple mode)
let isAdvancedMode = false
let advBrowser = null
let advGroups  = null

async function init() {
  catalog = await loadCatalog().catch(() => ({ items: {} }))

  // Populate preset selector
  const presetEl = document.getElementById('preset')
  for (const [name, data] of Object.entries(presets)) {
    const opt = document.createElement('option')
    opt.value = name
    opt.textContent = `${name} — ${data.description || ''}`
    presetEl.appendChild(opt)
  }
  if (presets.standard) {
    presetEl.value = 'standard'
    applyPreset('standard')
  }

  // Init advanced mode panels
  advBrowser = new AdvancedBrowser(
    document.getElementById('adv-browser-panel'),
    (type, id, label) => advGroups?.addItem(type, id, label)
  )
  advGroups = new CustomGroups(
    document.getElementById('adv-groups-panel'),
    () => {}
  )
}

function applyPreset(name) {
  const data = presets[name]
  if (!data) return
  simpleGroups = new Set(data.groups || [])

  // Sync topology and features from preset (advanced mode uses these)
  const topology = document.getElementById('topology')
  if (topology && data.topology) topology.value = data.topology
  if (data.features) {
    document.getElementById('feat-ads').checked      = !!data.features.ads_block
    document.getElementById('feat-tracking').checked = !!data.features.tracking_block
    document.getElementById('feat-quic').checked     = !!data.features.quic_block
    document.getElementById('feat-lb').checked       = !!data.features.load_balance
  }
}

// ── event listeners ───────────────────────────────────────────────────────────

document.getElementById('kernel').addEventListener('change', e => {
  const isSingbox = e.target.value === 'singbox'
  const fmtWrap  = document.getElementById('format-wrap')
  const tierWrap = document.getElementById('tier-wrap')
  if (fmtWrap)  fmtWrap.style.display  = isSingbox ? 'none' : ''
  if (tierWrap) tierWrap.style.display  = isSingbox ? ''     : 'none'
  const topEl = document.getElementById('topology')
  const geoEl = document.getElementById('geodata')
  if (topEl) topEl.closest('div').style.display = isSingbox ? 'none' : ''
  if (geoEl) geoEl.closest('div').style.display = isSingbox ? 'none' : ''
})

document.getElementById('preset').addEventListener('change', e => {
  if (e.target.value !== 'custom') applyPreset(e.target.value)
})

// ── Mode toggle ───────────────────────────────────────────────────────────────

document.getElementById('mode-simple').addEventListener('click', () => {
  isAdvancedMode = false
  document.getElementById('mode-simple').classList.add('active')
  document.getElementById('mode-advanced').classList.remove('active')
  document.getElementById('simple-mode').style.display = ''
  document.getElementById('advanced-mode').style.display = 'none'
})

document.getElementById('mode-advanced').addEventListener('click', () => {
  isAdvancedMode = true
  document.getElementById('mode-advanced').classList.add('active')
  document.getElementById('mode-simple').classList.remove('active')
  document.getElementById('advanced-mode').style.display = ''
  document.getElementById('simple-mode').style.display = 'none'
  // Pre-populate advanced groups from current preset selection
  if (advGroups?.isEmpty() && simpleGroups.size > 0) {
    advGroups.setFromPreset([...simpleGroups])
  }
})

document.getElementById('generate').addEventListener('click', () => {
  const kernel = document.getElementById('kernel').value
  const subs   = document.getElementById('subs').value.trim().split('\n').filter(Boolean)
  const features = {
    ads_block:       document.getElementById('feat-ads').checked,
    tracking_block:  document.getElementById('feat-tracking').checked,
    quic_block:      document.getElementById('feat-quic').checked,
    load_balance:    document.getElementById('feat-lb')?.checked || false,
    tun_enable:      document.getElementById('feat-tun').checked,
    dashboard:       document.getElementById('feat-dashboard').checked,
  }

  // Advanced mode reads all options from DOM; simple mode uses defaults
  const topology       = document.getElementById('topology')?.value       || 'regional'
  const geodata        = document.getElementById('geodata')?.value        || 'metacubex'
  const format         = document.getElementById('format')?.value         || 'yaml-split'
  const tier           = parseInt(document.getElementById('tier')?.value  || '2', 10)
  const regionExcludes = document.getElementById('region-excludes')?.value.trim() || ''

  let output
  if (kernel === 'singbox') {
    const groupIds = [...simpleGroups]
    output = generateSingbox(groupIds, subs, tier)
  } else if (isAdvancedMode) {
    const customConfig = advGroups?.getConfig() || []
    if (!customConfig.length || customConfig.every(g => !g.members.length)) {
      alert('请先在高级模式中添加规则集到代理组')
      return
    }
    output = buildProfileFromCustomGroups(subs, customConfig, catalog || { items: {} }, {
      topology, target: kernel, features, regionExcludes, geodata, format,
    })
  } else {
    const groupIds = [...simpleGroups]
    output = buildFullProfile(subs, groupIds, catalog || { items: {} }, {
      topology, target: kernel, features, regionExcludes, geodata, format,
    })
  }

  const el = document.getElementById('output')
  el.textContent = output
  el.style.display = 'block'
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
})

document.getElementById('copy').addEventListener('click', () => {
  const text = document.getElementById('output').textContent
  if (text) navigator.clipboard.writeText(text).then(() => alert('已复制到剪贴板'))
})

document.getElementById('download').addEventListener('click', () => {
  const text = document.getElementById('output').textContent
  if (!text) return
  const kernel = document.getElementById('kernel').value
  const ext    = kernel === 'singbox' ? 'json' : 'yaml'
  const name   = isAdvancedMode ? 'custom' : (document.getElementById('preset')?.value || 'profile')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  a.download = `${name}-${kernel}.${ext}`
  a.click()
})

// ── sing-box output (fragment only) ──────────────────────────────────────────

function generateSingbox(groupIds, subs, tier) {
  const { ruleSets, routeRules } = buildSingboxRuleSets(groupIds, catalog || { items: {} }, { tier })
  const outbounds = [
    { tag: 'proxy',  type: 'selector', outbounds: ['auto', 'direct'] },
    { tag: 'auto',   type: 'urltest',  outbounds: ['direct'], url: 'https://cp.cloudflare.com', interval: '5m' },
    { tag: 'direct', type: 'direct' },
    { tag: 'block',  type: 'block' },
    { tag: 'dns-out',type: 'dns' },
  ]
  const config = {
    '$comment': `hajimihomo profile builder — sing-box fragment — tier ${tier}`,
    outbounds,
    route: {
      rule_set: ruleSets,
      rules: [
        { protocol: 'dns', outbound: 'dns-out' },
        ...routeRules,
        { geoip: 'cn', outbound: 'direct' },
      ],
      final: 'proxy',
      auto_detect_interface: true,
    },
  }
  return JSON.stringify(config, null, 2)
}

init()
