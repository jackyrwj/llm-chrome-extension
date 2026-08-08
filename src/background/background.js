// 所有跨域请求集中在 service worker，content script 只发消息。
// 只做三件事：取 HF 模型硬数据、查打包的镜像映射表、ModelScope 搜索兜底。
const MS_SEARCH_ENDPOINT = 'https://www.modelscope.cn/api/v1/dolphin/models';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;

  if (request.action === 'fetchModelData') {
    handleFetchModelData(request.modelId)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (request.action === 'fetchMsModelData') {
    handleFetchMsModelData(request.modelId)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (request.action === 'lookupMapping') {
    handleLookupMapping(request.modelId, request.direction)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (request.action === 'searchModelScope') {
    handleModelScopeSearch(request.modelId)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  return false;
});

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return { data: await res.json() };
  } catch (err) {
    return { error: err.name === 'AbortError' ? 'Request timeout' : err.message };
  } finally {
    clearTimeout(timeoutId);
  }
}

function handleFetchModelData(modelId) {
  return fetchJson(
    `https://huggingface.co/api/models/${encodeURIComponent(modelId)}?blobs=true`,
    8000
  );
}

async function handleFetchMsModelData(modelId) {
  const info = await fetchJson(
    `https://www.modelscope.cn/api/v1/models/${encodeURIComponent(modelId)}`,
    8000
  );
  if (info.error) return info;

  const files = await fetchJson(
    `https://www.modelscope.cn/api/v1/models/${encodeURIComponent(modelId)}/repo/files?Recursive=true`,
    8000
  );
  return { data: { info: info.data, files: files.error ? null : files.data } };
}

// 打包的 mapping.json 是核心资产：精确命中才算"已验证"，其他任何途径都是"未验证"。
let mappingPromise = null;
function loadMapping() {
  if (!mappingPromise) {
    mappingPromise = fetch(chrome.runtime.getURL('src/data/mapping.json')).then(r => r.json());
  }
  return mappingPromise;
}

async function handleLookupMapping(modelId, direction) {
  const mapping = await loadMapping();

  if (direction === 'fromModelScope') {
    for (const [hfId, entry] of Object.entries(mapping)) {
      if (entry.modelscope === modelId) {
        return { match: { hfId, hfUrl: `https://huggingface.co/${hfId}` } };
      }
    }
    return { match: null };
  }

  const entry = mapping[modelId];
  return {
    match: entry
      ? { msId: entry.modelscope, msUrl: entry.modelscopeUrl, lastVerified: entry.lastVerified }
      : null
  };
}

async function handleModelScopeSearch(modelId) {
  return fetchJson(
    `${MS_SEARCH_ENDPOINT}?search=${encodeURIComponent(modelId)}`,
    5000
  );
}
