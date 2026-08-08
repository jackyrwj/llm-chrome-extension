const I18N = {
  zh: {
    cardTitle: '模型助手',
    sectionInfo: '模型信息',
    sectionDownload: '下载',
    sectionDeploy: '部署',
    params: '参数',
    precision: '精度',
    context: '上下文',
    license: '许可证',
    updated: '更新',
    weights: '权重',
    loading: '加载中…',
    loadFailed: '数据加载失败',
    verifiedMirror: '已验证 ModelScope 镜像',
    unverifiedMirror: '搜索候选，未经人工验证',
    noMirror: '暂无 ModelScope 镜像',
    sourceModelScope: 'ModelScope',
    sourceHF: 'HF 源',
    copy: '复制',
    copied: '已复制',
    viewOnHf: '在 Hugging Face 查看',
    viewOnMs: '在 ModelScope 查看',
  },
  en: {
    cardTitle: 'Model Assistant',
    sectionInfo: 'Model Info',
    sectionDownload: 'Download',
    sectionDeploy: 'Deploy',
    params: 'Params',
    precision: 'Precision',
    context: 'Context',
    license: 'License',
    updated: 'Updated',
    weights: 'Weights',
    loading: 'Loading…',
    loadFailed: 'Failed to load data',
    verifiedMirror: 'Verified ModelScope mirror',
    unverifiedMirror: 'Search candidate, unverified',
    noMirror: 'No ModelScope mirror',
    sourceModelScope: 'ModelScope',
    sourceHF: 'HF source',
    copy: 'Copy',
    copied: 'Copied',
    viewOnHf: 'View on Hugging Face',
    viewOnMs: 'View on ModelScope',
  }
};

function getLang() {
  return navigator.language.startsWith('zh') ? 'zh' : 'en';
}

function t(key, lang) {
  const l = lang || getLang();
  return (I18N[l] && I18N[l][key]) || I18N['en'][key] || key;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { I18N, t, getLang };
}
