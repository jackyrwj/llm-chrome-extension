#!/usr/bin/env bash
#
# semantic-release 的 prepare 阶段调用：把算好的版本号写进 manifest.json，
# 并打出上架用的 zip。
#
# 为什么单独成文件而不是写在 .releaserc.json 的 prepareCmd 里：
# 那样要把 shell 嵌进 JSON 字符串，引号和转义会叠三层——之前 Jenkinsfile 里
# 把 python 嵌进 Groovy 三重引号，就因为反斜杠 n 被外层先处理掉而炸过一次。
# 拆成文件后每层各管各的，改起来也不用数引号。
#
# 用法: .ci/prepare-release.sh <版本号>   例: .ci/prepare-release.sh 1.0.4

set -euo pipefail

VERSION=${1:?需要版本号参数}

echo "==> 写入 manifest.json 版本号: ${VERSION}"
VERSION="$VERSION" node -e '
const fs = require("fs");
const p = "manifest.json";
const m = JSON.parse(fs.readFileSync(p, "utf8"));
m.version = process.env.VERSION;
// 保持两空格缩进并以换行结尾，与仓库现有格式一致
fs.writeFileSync(p, JSON.stringify(m, null, 2) + "\n");
console.log("    manifest.json version =", m.version);
'

# Chrome 应用商店要求 manifest.json 位于 zip 根目录，不能多一层父目录
ARCHIVE="llm-chrome-extension-v${VERSION}.zip"
echo "==> 打包 ${ARCHIVE}"
rm -f llm-chrome-extension-v*.zip
zip -qr "$ARCHIVE" \
    manifest.json src icons docs privacy-policy.html \
    -x '*.DS_Store'
test -s "$ARCHIVE"
echo "    产物大小: $(du -h "$ARCHIVE" | cut -f1)"
