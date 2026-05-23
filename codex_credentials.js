(function attachCodexCredentialBuilder(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.CodexCredentialBuilder = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : undefined, function createCodexCredentialBuilder() {
  'use strict';

  const SESSION_ENDPOINT = 'https://chatgpt.com/api/auth/session';
  const OPENAI_AUTH_CLAIM = 'https://api.openai.com/auth';
  const OPENAI_PROFILE_EMAIL_CLAIM = 'https://api.openai.com/profile.email';

  function decodeBase64Url(base64Url) {
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const bytes =
      typeof Buffer !== 'undefined'
        ? Uint8Array.from(Buffer.from(padded, 'base64'))
        : Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));

    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder().decode(bytes);
    }

    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return decodeURIComponent(escape(binary));
  }

  function decodeJwtPayload(jwt) {
    if (typeof jwt !== 'string' || !jwt) {
      throw new TypeError('access_token 必须是非空字符串。');
    }
    const segments = jwt.split('.');
    if (segments.length < 2) {
      throw new Error('access_token 不是有效的 JWT 格式。');
    }

    let decoded;
    try {
      decoded = decodeBase64Url(segments[1]);
    } catch {
      throw new Error('access_token payload base64 解码失败。');
    }

    try {
      return JSON.parse(decoded);
    } catch {
      throw new Error('access_token payload 不是合法 JSON。');
    }
  }

  function tryDecodeJwtPayload(jwt) {
    try {
      return decodeJwtPayload(jwt);
    } catch {
      return {};
    }
  }

  function firstString(values) {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  function authClaim(payload) {
    const claim = payload && payload[OPENAI_AUTH_CLAIM];
    return claim && typeof claim === 'object' ? claim : {};
  }

  function extractAccountId(payload, fallback) {
    const claim = authClaim(payload);
    const accountId = firstString([
      claim.chatgpt_account_id,
      claim.account_id,
      payload && payload.chatgpt_account_id,
      payload && payload.account_id,
      fallback,
    ]);
    if (accountId) {
      return accountId;
    }
    throw new Error('access_token 中没有 chatgpt_account_id，且响应里也没有 account.id。');
  }

  function isoFromEpochSeconds(seconds) {
    return typeof seconds === 'number' && Number.isFinite(seconds)
      ? new Date(seconds * 1000).toISOString()
      : null;
  }

  function normalizeIso(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return new Date((value > 1000000000000 ? value : value * 1000)).toISOString();
    }
    if (typeof value !== 'string' || !value.trim()) {
      return '';
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? value.trim() : new Date(parsed).toISOString();
  }

  function buildSyntheticIdToken(accountId, email, planType) {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      email: email || undefined,
      iat: now,
      iss: 'codex-credential-exporter',
      sub: accountId || '',
      [OPENAI_AUTH_CLAIM]: {
        chatgpt_account_id: accountId || '',
        chatgpt_plan_type: planType || 'unknown',
      },
    };
    const encoded = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    return ['e30', encoded, ''].join('.');
  }

  async function fetchSession(fetchImpl) {
    const fetcher = fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (!fetcher) {
      throw new Error('当前环境没有 fetch 实现。');
    }

    const response = await fetcher(SESSION_ENDPOINT, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error('未登录或 cookie 已过期，请先在浏览器访问 chatgpt.com 重新登录。');
    }
    if (!response.ok) {
      throw new Error(`请求 /api/auth/session 失败: HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data || typeof data !== 'object') {
      throw new Error('/api/auth/session 返回的不是 JSON 对象。');
    }
    if (typeof data.accessToken !== 'string' || !data.accessToken) {
      throw new Error('响应里没有 accessToken，可能未登录或 session 已失效。');
    }
    return data;
  }

  function createCredentialContext(sessionData, options = {}) {
    if (!sessionData || typeof sessionData.accessToken !== 'string') {
      throw new Error('sessionData 中缺少 accessToken。');
    }

    const accessToken = sessionData.accessToken;
    const accessPayload = decodeJwtPayload(accessToken);
    const accessAuth = authClaim(accessPayload);
    const rawIdToken = firstString([
      sessionData.idToken,
      sessionData.id_token,
      sessionData.identityToken,
    ]);
    const idToken = rawIdToken || accessToken;
    const idPayload = rawIdToken ? tryDecodeJwtPayload(rawIdToken) : accessPayload;
    const idAuth = authClaim(idPayload);
    const accountId = extractAccountId(accessPayload, sessionData.account && sessionData.account.id);
    const email = firstString([
      sessionData.user && sessionData.user.email,
      idPayload && idPayload.email,
      idPayload && idPayload[OPENAI_PROFILE_EMAIL_CLAIM],
      accessPayload && accessPayload.email,
    ]);
    const planType = firstString([
      sessionData.account && sessionData.account.planType,
      idAuth.chatgpt_plan_type,
      accessAuth.chatgpt_plan_type,
    ]);
    const userId = firstString([
      idAuth.chatgpt_user_id,
      accessAuth.chatgpt_user_id,
      idAuth.user_id,
      accessAuth.user_id,
      idPayload && idPayload.sub,
    ]);
    const organizationId = firstString([
      idAuth.organization_id,
      accessAuth.organization_id,
      Array.isArray(idAuth.organizations) && idAuth.organizations[0] && idAuth.organizations[0].id,
      Array.isArray(accessAuth.organizations) && accessAuth.organizations[0] && accessAuth.organizations[0].id,
    ]);
    const subscriptionActiveUntil = normalizeIso(
      idAuth.chatgpt_subscription_active_until || accessAuth.chatgpt_subscription_active_until || '',
    );
    const accessTokenExpiresAt = isoFromEpochSeconds(accessPayload.exp);
    const lastRefresh = options.lastRefresh || new Date().toISOString();
    const refreshToken = firstString([
      sessionData.refreshToken,
      sessionData.refresh_token,
      sessionData.tokens && sessionData.tokens.refresh_token,
    ]);

    return {
      accessToken,
      idToken,
      refreshToken,
      accountId,
      email,
      planType,
      userId,
      organizationId,
      subscriptionActiveUntil,
      accessTokenExpiresAt,
      sessionExpires: typeof sessionData.expires === 'string' ? sessionData.expires : null,
      lastRefresh,
      idTokenSynthetic: !rawIdToken,
    };
  }

  function buildAuthFile(sessionData, options = {}) {
    const context = createCredentialContext(sessionData, options);
    return {
      auth: {
        auth_mode: 'chatgpt',
        OPENAI_API_KEY: null,
        tokens: {
          id_token: context.idToken,
          access_token: context.accessToken,
          refresh_token: context.refreshToken || '',
          account_id: context.accountId,
        },
        last_refresh: context.lastRefresh,
      },
      meta: context,
    };
  }

  function buildCpaExport(sessionData, options = {}) {
    const context = createCredentialContext(sessionData, options);
    return {
      id_token: context.idToken,
      access_token: context.accessToken,
      refresh_token: context.refreshToken || '',
      account_id: context.accountId,
      last_refresh: context.lastRefresh,
      email: context.email,
      type: 'codex',
      expired: context.accessTokenExpiresAt || '',
      plan_type: context.planType || '',
      chatgpt_plan_type: context.planType || '',
      chatgpt_account_id: context.accountId,
      chatgpt_user_id: context.userId || '',
      organization_id: context.organizationId || '',
      disabled: false,
      id_token_synthetic: context.idTokenSynthetic,
    };
  }

  function buildSub2apiExport(sessionData, options = {}) {
    const context = createCredentialContext(sessionData, options);
    const credentials = {
      access_token: context.accessToken,
      refresh_token: context.refreshToken || '',
      id_token: context.idToken,
      chatgpt_account_id: context.accountId,
      chatgpt_user_id: context.userId || '',
      email: context.email,
      expires_at: context.accessTokenExpiresAt || '',
      organization_id: context.organizationId || '',
      plan_type: context.planType || '',
    };
    if (context.subscriptionActiveUntil) {
      credentials.subscription_expires_at = context.subscriptionActiveUntil;
    }

    return {
      exported_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      proxies: [],
      accounts: [
        {
          name: context.email || context.accountId,
          platform: 'openai',
          type: 'oauth',
          credentials,
          concurrency: 0,
          priority: 0,
        },
      ],
      type: 'sub2api-data',
      version: 1,
    };
  }

  function buildCockpitExport(sessionData, options = {}) {
    const context = createCredentialContext(sessionData, options);
    return [
      {
        id_token: context.idToken,
        access_token: context.accessToken,
        refresh_token: context.refreshToken || '',
        account_id: context.accountId,
        last_refresh: context.lastRefresh,
        email: context.email,
        type: 'codex',
        expired: context.accessTokenExpiresAt || '',
        plan_type: context.planType || '',
        subscription_active_until: context.subscriptionActiveUntil || '',
        id_token_synthetic: context.idTokenSynthetic,
      },
    ];
  }

  function buildCcSwitchExport(sessionData, options = {}) {
    const context = createCredentialContext(sessionData, options);
    const account = {
      account_id: context.accountId,
      refresh_token: context.refreshToken || '',
      authenticated_at: Math.floor(Date.now() / 1000),
    };
    if (context.email) {
      account.email = context.email;
    }

    return {
      version: 1,
      accounts: {
        [context.accountId]: account,
      },
      default_account_id: context.accountId,
    };
  }

  function buildExport(sessionData, exportType, options = {}) {
    if (exportType === 'auth') {
      return buildAuthFile(sessionData, options).auth;
    }
    if (exportType === 'cpa') {
      return buildCpaExport(sessionData, options);
    }
    if (exportType === 'sub2api') {
      return buildSub2apiExport(sessionData, options);
    }
    if (exportType === 'cockpit') {
      return buildCockpitExport(sessionData, options);
    }
    if (exportType === 'ccswitch') {
      return buildCcSwitchExport(sessionData, options);
    }
    throw new Error(`未知导出类型: ${exportType}`);
  }

  async function buildFromBrowser(fetchImpl) {
    const sessionData = await fetchSession(fetchImpl);
    return buildAuthFile(sessionData);
  }

  async function grabFromBrowser(fetchImpl) {
    const sessionData = await fetchSession(fetchImpl);
    return {
      sessionData,
      meta: createCredentialContext(sessionData),
    };
  }

  return Object.freeze({
    OPENAI_AUTH_CLAIM,
    SESSION_ENDPOINT,
    buildAuthFile,
    buildCcSwitchExport,
    buildCpaExport,
    buildCockpitExport,
    buildExport,
    buildFromBrowser,
    buildSub2apiExport,
    createCredentialContext,
    decodeJwtPayload,
    extractAccountId,
    fetchSession,
    grabFromBrowser,
  });
});
