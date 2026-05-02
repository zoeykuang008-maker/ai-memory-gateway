/**
 * AI Memory Gateway - Dashboard JavaScript
 * 整合记忆管理、导入、导出功能
 */

// ============================================
// 全局状态
// ============================================
let allMemories = [];
let pendingJsonData = null;

// ============================================
// 初始化
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // 初始化侧边栏导航
    initNavigation();
    // 初始化Tab切换
    initTabs();
    // 加载记忆数据
    loadMemories();
    // 加载导出统计
    loadExportStats();
});

// ============================================
// 侧边栏导航
// ============================================
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            switchSection(section);
        });
    });
}

function switchSection(name) {
    // 更新导航激活状态
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
        item.classList.toggle('active', item.dataset.section === name);
    });
    
    // 切换内容区域
    document.querySelectorAll('.section').forEach(section => {
        section.classList.toggle('active', section.id === 'section-' + name);
    });
    
    // 切换到导出页面时刷新统计
    if (name === 'export') {
        loadExportStats();
    }
}

// ============================================
// Tab 切换（导入页面）
// ============================================
function initTabs() {
    const tabs = document.querySelectorAll('.tab[data-tab]');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            // 更新Tab激活状态
            document.querySelectorAll('.tab[data-tab]').forEach(t => {
                t.classList.toggle('active', t.dataset.tab === tabName);
            });
            
            // 切换Tab面板
            document.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.toggle('active', panel.id === 'tab-' + tabName);
            });
            
            // 清除消息
            clearImportResult();
        });
    });
}

// ============================================
// 记忆管理功能
// ============================================
async function loadMemories() {
    try {
        const resp = await fetch('/api/memories');
        const data = await resp.json();
        allMemories = data.memories || [];
        document.getElementById('stats').textContent = '共 ' + allMemories.length + ' 条记忆';
        filterAndSort();
    } catch(e) {
        showManageMsg('error', '加载失败：' + e.message);
    }
}

function renderTable(mems) {
    const tbody = document.getElementById('tbody');
    tbody.innerHTML = mems.map(m => 
        '<tr data-id="' + m.id + '">' +
        '<td class="col-check"><input type="checkbox" class="mem-check" value="' + m.id + '"></td>' +
        '<td class="col-id">' + m.id + '</td>' +
        '<td class="col-content"><textarea class="content-textarea" id="c_' + m.id + '">' + escHtml(m.content) + '</textarea></td>' +
        '<td class="col-importance"><input type="number" class="importance-input" id="i_' + m.id + '" value="' + m.importance + '" min="1" max="10"></td>' +
        '<td class="col-source">' + (m.source_session || '-') + '</td>' +
        '<td class="col-time">' + fmtTime(m.created_at) + '</td>' +
        '<td class="col-actions"><div class="row-actions">' +
            '<button class="btn btn-primary btn-sm" onclick="saveMem(' + m.id + ')">保存</button>' +
            '<button class="btn btn-danger btn-sm" onclick="delMem(' + m.id + ')">删除</button>' +
        '</div></td>' +
        '</tr>'
    ).join('');
}

function escHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function fmtTime(s) {
    if (!s) return '-';
    return s;
}

function filterAndSort() {
    const q = document.getElementById('searchBox').value.trim().toLowerCase();
    const sort = document.getElementById('sortSelect').value;
    const dateVal = document.getElementById('dateFilter').value;
    
    let mems = allMemories;
    
    // 关键词筛选
    if (q) {
        mems = mems.filter(m => m.content.toLowerCase().includes(q));
    }
    
    // 日期筛选
    if (dateVal) {
        mems = mems.filter(m => m.created_at && fmtTime(m.created_at).slice(0, 10) === dateVal);
    }
    
    // 排序
    mems = [...mems].sort((a, b) => {
        if (sort === 'id-desc') return b.id - a.id;
        if (sort === 'id-asc') return a.id - b.id;
        if (sort === 'imp-desc') return b.importance - a.importance || b.id - a.id;
        if (sort === 'imp-asc') return a.importance - b.importance || a.id - b.id;
        return 0;
    });
    
    renderTable(mems);
    
    // 更新统计
    const parts = [];
    if (q || dateVal) {
        parts.push('筛选到 ' + mems.length + ' / ' + allMemories.length + ' 条');
        if (dateVal) parts.push('日期: ' + dateVal);
    } else {
        parts.push('共 ' + allMemories.length + ' 条记忆');
    }
    document.getElementById('stats').textContent = parts.join('  ');
}

function clearDateFilter() {
    document.getElementById('dateFilter').value = '';
    filterAndSort();
}

async function saveMem(id) {
    const content = document.getElementById('c_' + id).value;
    const importance = parseInt(document.getElementById('i_' + id).value);
    
    try {
        const resp = await fetch('/api/memories/' + id, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({content, importance})
        });
        const data = await resp.json();
        if (data.error) {
            showManageMsg('error', '❌ ' + data.error);
        } else {
            showManageMsg('success', '✅ 已保存 #' + id);
            loadMemories();
        }
    } catch(e) {
        showManageMsg('error', '❌ ' + e.message);
    }
}

async function delMem(id) {
    if (!confirm('确定删除 #' + id + '？此操作不可撤销。')) return;
    
    try {
        const resp = await fetch('/api/memories/' + id, { method: 'DELETE' });
        const data = await resp.json();
        if (data.error) {
            showManageMsg('error', '❌ ' + data.error);
        } else {
            showManageMsg('success', '✅ 已删除 #' + id);
            loadMemories();
        }
    } catch(e) {
        showManageMsg('error', '❌ ' + e.message);
    }
}

async function batchSave() {
    const rows = document.querySelectorAll('#tbody tr');
    if (rows.length === 0) {
        showManageMsg('error', '没有记忆可保存');
        return;
    }
    
    const updates = [];
    rows.forEach(row => {
        const id = parseInt(row.dataset.id);
        const cEl = document.getElementById('c_' + id);
        const iEl = document.getElementById('i_' + id);
        if (cEl && iEl) {
            updates.push({
                id,
                content: cEl.value,
                importance: parseInt(iEl.value)
            });
        }
    });
    
    if (!confirm('确定保存全部 ' + updates.length + ' 条记忆的修改？')) return;
    
    try {
        const resp = await fetch('/api/memories/batch-update', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({updates: updates})
        });
        const data = await resp.json();
        if (data.error) {
            showManageMsg('error', '❌ ' + data.error);
        } else {
            showManageMsg('success', '✅ 已保存 ' + data.updated + ' 条');
            loadMemories();
        }
    } catch(e) {
        showManageMsg('error', '❌ ' + e.message);
    }
}

async function batchDelete() {
    const checked = [...document.querySelectorAll('.mem-check:checked')].map(c => parseInt(c.value));
    
    if (checked.length === 0) {
        showManageMsg('error', '请先勾选要删除的记忆');
        return;
    }
    
    if (!confirm('确定删除选中的 ' + checked.length + ' 条记忆？此操作不可撤销。')) return;
    
    try {
        const resp = await fetch('/api/memories/batch-delete', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ids: checked})
        });
        const data = await resp.json();
        if (data.error) {
            showManageMsg('error', '❌ ' + data.error);
        } else {
            showManageMsg('success', '✅ 已删除 ' + data.deleted + ' 条');
            loadMemories();
        }
    } catch(e) {
        showManageMsg('error', '❌ ' + e.message);
    }
}

function toggleAll() {
    const val = event.target.checked;
    document.querySelectorAll('.mem-check').forEach(c => c.checked = val);
    document.getElementById('selectAll').checked = val;
    document.getElementById('selectAllHead').checked = val;
}

function showManageMsg(type, text) {
    const container = document.getElementById('manage-msg');
    container.innerHTML = '<div class="msg msg-' + type + '">' + text + '</div>';
    setTimeout(() => {
        container.innerHTML = '';
    }, 4000);
}

// ============================================
// 导入功能
// ============================================
async function doTextImport() {
    const file = document.getElementById('txtFile').files[0];
    const text = document.getElementById('txtInput').value.trim();
    const skip = document.getElementById('skipScore').checked;
    
    let content = '';
    if (file) {
        content = await file.text();
    } else if (text) {
        content = text;
    } else {
        showImportResult('error', '请先上传文件或输入文本');
        return;
    }
    
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
        showImportResult('error', '没有找到有效的记忆条目');
        return;
    }
    
    showImportResult('info', skip 
        ? '正在导入 ' + lines.length + ' 条记忆...' 
        : '正在为 ' + lines.length + ' 条记忆自动评分，请稍候...');
    
    try {
        const resp = await fetch('/import/text', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({lines: lines, skip_scoring: skip})
        });
        const data = await resp.json();
        if (data.error) {
            showImportResult('error', '❌ ' + data.error);
        } else {
            showImportResult('success', '✅ 导入完成！新增 ' + data.imported + ' 条，跳过 ' + data.skipped + ' 条（已存在），总计 ' + data.total + ' 条');
            // 刷新记忆列表
            loadMemories();
        }
    } catch(e) {
        showImportResult('error', '❌ 请求失败：' + e.message);
    }
}

async function previewJson() {
    const file = document.getElementById('jsonFile').files[0];
    const text = document.getElementById('jsonInput').value.trim();
    const preview = document.getElementById('jsonPreview');
    
    let jsonStr = '';
    if (file) {
        jsonStr = await file.text();
    } else if (text) {
        jsonStr = text;
    } else {
        showImportResult('error', '请先上传文件或粘贴 JSON');
        return;
    }
    
    try {
        const parsed = JSON.parse(jsonStr);
        const mems = parsed.memories || [];
        if (mems.length === 0) {
            showImportResult('error', '❌ 没有找到 memories 字段，请确认这是从导出功能导出的文件');
            preview.innerHTML = '';
            return;
        }
        
        pendingJsonData = parsed;
        let html = '<p><b>预览：共 ' + mems.length + ' 条记忆</b></p>';
        const show = mems.slice(0, 10);
        show.forEach(m => {
            html += '<div class="preview-item">权重 ' + (m.importance || '?') + ' | ' + (m.content || '').substring(0, 80) + '</div>';
        });
        if (mems.length > 10) {
            html += '<div class="preview-item" style="color:#999;">...还有 ' + (mems.length - 10) + ' 条</div>';
        }
        html += '<br><button class="btn btn-primary" onclick="confirmJsonImport()">确认导入</button>';
        preview.innerHTML = html;
        clearImportResult();
    } catch(e) {
        showImportResult('error', '❌ JSON 格式错误：' + e.message);
        preview.innerHTML = '';
    }
}

async function confirmJsonImport() {
    if (!pendingJsonData) {
        showImportResult('error', '请先预览');
        return;
    }
    
    showImportResult('info', '导入中...');
    
    try {
        const resp = await fetch('/import/memories', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(pendingJsonData)
        });
        const data = await resp.json();
        if (data.error) {
            showImportResult('error', '❌ ' + data.error);
        } else {
            showImportResult('success', '✅ 导入完成！新增 ' + data.imported + ' 条，跳过 ' + data.skipped + ' 条（已存在），总计 ' + data.total + ' 条');
            loadMemories();
        }
        document.getElementById('jsonPreview').innerHTML = '';
        pendingJsonData = null;
    } catch(e) {
        showImportResult('error', '❌ 请求失败：' + e.message);
    }
}

function showImportResult(type, text) {
    const container = document.getElementById('import-result');
    container.innerHTML = '<div class="msg msg-' + type + '">' + text + '</div>';
}

function clearImportResult() {
    document.getElementById('import-result').innerHTML = '';
    document.getElementById('jsonPreview').innerHTML = '';
}

// ============================================
// 导出功能
// ============================================
async function loadExportStats() {
    const el = document.getElementById('export-stats');
    try {
        const resp = await fetch('/api/memories');
        const data = await resp.json();
        const count = (data.memories || []).length;
        el.textContent = '当前共有 ' + count + ' 条记忆';
    } catch(e) {
        el.textContent = '无法加载统计';
    }
}

function doExport() {
    // 直接跳转到导出接口，浏览器会下载文件
    window.location.href = '/export/memories';
}
