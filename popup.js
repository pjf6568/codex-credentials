(function initializePopup() {
  'use strict';

  const grabButton = document.getElementById('grabButton');
  const followButton = document.getElementById('followButton');
  const shopButton = document.getElementById('shopButton');
  const exportActions = document.getElementById('exportActions');
  const status = document.getElementById('status');
  const preview = document.getElementById('preview');
  const previewSummary = document.getElementById('previewSummary');
  const previewContent = document.getElementById('previewContent');
  const builder = window.CodexCredentialBuilder;
  let currentSessionData = null;
  let currentMeta = null;

  const exportLabels = {
    auth: 'auth.json',
    cpa: 'CPA 导出',
    sub2api: 'sub2api 导出',
    cockpit: 'Cockpit 导出',
    ccswitch: 'CC Switch 导出',
  };
  const followImagePath = 'qrcode_for_gh_cddc163373ea_344.jpg';
  const shopUrl = 'https://pay.ldxp.cn/shop/QO8R0ZFF';
  const exportFileNames = {
    auth: 'auth.json',
  };

  function sanitizeFileNameSegment(value, fallback) {
    const cleaned = `${value || ''}`
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    return cleaned || fallback;
  }

  function getDownloadFileName(exportType) {
    if (exportFileNames[exportType]) {
      return exportFileNames[exportType];
    }

    const email = sanitizeFileNameSegment(
      currentMeta && currentMeta.email,
      (currentMeta && currentMeta.accountId) || 'unknown',
    );

    if (exportType === 'cpa') {
      return `codex-cpa-${email}.json`;
    }
    if (exportType === 'sub2api') {
      return `codex-sub2api-${email}.json`;
    }
    if (exportType === 'cockpit') {
      return `codex-cockpit-${email}.json`;
    }
    if (exportType === 'ccswitch') {
      return `codex-ccswitch-${email}.json`;
    }
    return `codex-credentials-${email}.json`;
  }

  function setStatus(message, kind = 'hint') {
    status.textContent = message;
    status.className = kind;
  }

  function setBusy(isBusy) {
    grabButton.disabled = isBusy;
    grabButton.textContent = isBusy ? '正在抓取...' : '抓取凭证';
    exportActions.querySelectorAll('button').forEach((button) => {
      button.disabled = isBusy;
    });
  }

  function formatExpiry(iso) {
    if (!iso) return '未知';
    const ms = Date.parse(iso) - Date.now();
    if (Number.isNaN(ms)) return iso;
    if (ms <= 0) return `${iso} (已过期)`;
    const days = ms / 86400000;
    if (days >= 1) return `${iso} (约 ${days.toFixed(1)} 天后过期)`;
    const hours = ms / 3600000;
    if (hours >= 1) return `${iso} (约 ${hours.toFixed(1)} 小时后过期)`;
    const minutes = Math.max(1, Math.floor(ms / 60000));
    return `${iso} (约 ${minutes} 分钟后过期)`;
  }

  function getCodexAuthPathHint() {
    const platform = `${navigator.userAgentData?.platform || navigator.platform || ''}`.toLowerCase();
    if (platform.includes('win')) {
      return '%USERPROFILE%\\.codex\\auth.json';
    }
    return '~/.codex/auth.json';
  }

  function getExportHelp(exportType) {
    if (exportType === 'auth') {
      return `保存位置: ${getCodexAuthPathHint()}`;
    }
    if (exportType === 'cpa') {
      return '可导入 CLIProxyAPI / CPA 兼容的 Codex 凭证文件。';
    }
    if (exportType === 'sub2api') {
      return '可导入 sub2api 的 openai oauth 账号数据。';
    }
    if (exportType === 'cockpit') {
      return '可导入 Cockpit Tools 的 Codex 账号。';
    }
    if (exportType === 'ccswitch') {
      return 'CC Switch 使用位置: ~/.cc-switch/codex_oauth_auth.json。请在 CC Switch 退出后备份原文件再替换或合并。';
    }
    return '';
  }

  async function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const fallback = document.createElement('textarea');
    fallback.value = text;
    fallback.style.position = 'fixed';
    fallback.style.opacity = '0';
    document.body.appendChild(fallback);
    fallback.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(fallback);
    if (!ok) {
      throw new Error('剪贴板写入失败，请手动复制下方预览内容。');
    }
  }

  async function downloadJson(text, exportType) {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const filename = getDownloadFileName(exportType);

    try {
      if (chrome.downloads && chrome.downloads.download) {
        await chrome.downloads.download({
          url,
          filename,
          conflictAction: 'uniquify',
          saveAs: false,
        });
        return;
      }

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  }

  function showCredentialStatus(meta) {
    const lines = [
      '凭证已抓取。请选择下方导出格式。',
      `账号: ${meta.email || '(未知)'}  |  套餐: ${meta.planType || '(未知)'}`,
      `account_id: ${meta.accountId}`,
      `access_token 过期: ${formatExpiry(meta.accessTokenExpiresAt)}`,
      `session cookie 过期: ${formatExpiry(meta.sessionExpires)}`
    ];
    setStatus(lines.join('\n'), 'ok');
  }

  async function grabCredentials() {
    setBusy(true);
    setStatus('正在读取 chatgpt.com 登录态...', 'hint');
    preview.hidden = true;
    exportActions.hidden = true;
    currentSessionData = null;
    currentMeta = null;

    try {
      const result = await builder.grabFromBrowser();
      currentSessionData = result.sessionData;
      currentMeta = result.meta;
      exportActions.hidden = false;
      showCredentialStatus(currentMeta);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function exportCredential(exportType) {
    if (!currentSessionData) {
      setStatus('请先点击“抓取凭证”。', 'error');
      return;
    }

    try {
      const payload = builder.buildExport(currentSessionData, exportType);
      const json = JSON.stringify(payload, null, 2);
      previewSummary.textContent = `预览 ${exportLabels[exportType] || '导出 JSON'} (含敏感信息)`;
      previewContent.textContent = json;
      preview.hidden = false;
      await copyText(json);
      await downloadJson(json, exportType);
      const help = getExportHelp(exportType);
      setStatus(`${exportLabels[exportType]} 已复制到剪贴板，并已开始下载。${help ? `\n${help}` : ''}`, 'ok');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(message, 'error');
    }
  }

  grabButton.addEventListener('click', grabCredentials);
  followButton.addEventListener('click', () => {
    window.open(chrome.runtime.getURL(followImagePath), '_blank', 'noopener');
  });
  shopButton.addEventListener('click', () => {
    window.open(shopUrl, '_blank', 'noopener');
  });
  exportActions.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    exportCredential(target.dataset.exportType);
  });
})();
