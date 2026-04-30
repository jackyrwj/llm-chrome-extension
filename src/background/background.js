chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'searchModelScope') {
    handleModelScopeSearch(request.modelId, request.endpoint)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (request.action === 'translate') {
    handleTranslate(request.text, request.provider, request.apiKey, request.targetLang)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (request.action === 'fetchModelConfig') {
    handleFetchModelConfig(request.modelId)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (request.action === 'fetchHFModels') {
    handleFetchHFModels(request.filters)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  return false;
});

async function handleFetchModelConfig(modelId) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`https://huggingface.co/api/models/${encodeURIComponent(modelId)}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const data = await res.json();
    return { config: data.config || {} };
  } catch (err) {
    clearTimeout(timeoutId);
    return { error: err.message };
  }
}

async function handleFetchHFModels(filters = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const params = new URLSearchParams({
      sort: 'downloads',
      direction: '-1',
      limit: String(filters.limit || 50)
    });
    if (filters.pipeline_tag && filters.pipeline_tag !== 'all') {
      params.set('filter', filters.pipeline_tag);
    }
    if (filters.search) {
      params.set('search', filters.search);
    }
    if (filters.author) {
      params.set('author', filters.author);
    }
    const res = await fetch(`https://huggingface.co/api/models?${params}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const data = await res.json();
    return { models: data };
  } catch (err) {
    clearTimeout(timeoutId);
    return { error: err.message };
  }
}

async function handleModelScopeSearch(modelId, endpoint) {
  const url = `${endpoint}?search=${encodeURIComponent(modelId)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'HF-Model-Assistant/1.0'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { data };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { error: 'Request timeout' };
    }
    return { error: err.message };
  }
}

async function handleTranslate(text, provider, apiKey, targetLang) {
  // Free Google Translate (no API key required)
  if (provider === 'google_free') {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      const response = await fetch(url);
      const data = await response.json();
      // Google returns nested array: [[["translated", "original", ...], ...], ...]
      if (data && data[0]) {
        const translated = data[0].map(sentence => sentence[0]).join('');
        return { text: translated };
      }
      return { error: 'Translation failed' };
    } catch (err) {
      return { error: err.message };
    }
  }

  // DeepL (requires API key)
  if (provider === 'deepl' && apiKey) {
    try {
      const response = await fetch('https://api-free.deepl.com/v2/translate', {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: [text],
          target_lang: targetLang.toUpperCase()
        })
      });
      const data = await response.json();
      return { text: data.translations?.[0]?.text };
    } catch (err) {
      return { error: err.message };
    }
  }

  // OpenAI (requires API key)
  if (provider === 'openai' && apiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a translator. Translate the following text to Chinese. Only output the translation, no explanations.' },
            { role: 'user', content: text }
          ],
          temperature: 0.3
        })
      });
      const data = await response.json();
      return { text: data.choices?.[0]?.message?.content };
    } catch (err) {
      return { error: err.message };
    }
  }

  return { error: 'Translation provider not configured' };
}
