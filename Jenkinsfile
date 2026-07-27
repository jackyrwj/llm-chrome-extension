// Jenkins 流水线，与 .github/workflows/ci.yml 功能对等，用于对比两套 CI。
//
// 与 GitHub Actions 版本的差异，以及原因：
//
// 1. 代码来源是内网 Gitea，不是 GitHub。
//    好处：不再受 github.com 概率性 TLS 干扰的影响，clone 稳定。
//    代价：仓库只能在 Tailscale 网络内访问。
//
// 2. 不需要 tarball 检出那套绕法。
//    GitHub Actions 版本里那 15 行重试脚本，在这里退化成一句 checkout scm。
//
// 3. 全部阶段跑在 Jenkins 所在机器（v100-18，Node v20）。
//    GitHub Actions 版本能把 tests/lint 分到 pro6000-1(Node 22)、build 分到 4090 并行；
//    Jenkins 要做到这点需要额外配置 agent 节点，目前是单机执行。
//    实测这套测试在 Node 20 与 22 下都通过。
//
// 宿主机前提：node、python3、zip、git。
//    这是自建 CI 与托管 CI 的实质差别——托管 runner 的镜像预装了常用工具，
//    自建则由你保证。首次构建就因为这台机器没装 zip 而失败过一次。

pipeline {
    agent any

    options {
        timestamps()
        // 只留最近 20 次构建，避免磁盘被日志和产物撑满
        buildDiscarder(logRotator(numToKeepStr: '20'))
        // 必须大于审批阶段的等待上限（30 分钟），否则顶层会先超时把构建掐掉，
        // 人还没来得及点批准
        timeout(time: 60, unit: 'MINUTES')
    }

    environment {
        NODE_MAJOR_EXPECTED = '20'
    }

    stages {
        stage('检出') {
            steps {
                // 凭据由 Configuration-as-Code 注入（id: gitea-token），
                // 不在此处写明文
                checkout scm
                sh 'echo "提交: $(git rev-parse --short HEAD)"'
            }
        }

        stage('环境确认') {
            steps {
                sh '''
                    set -e
                    echo "机器 : $(hostname)"
                    echo "node : $(node -v)"
                    major=$(node -v | sed 's/^v//;s/\\..*//')
                    if [ "$major" != "$NODE_MAJOR_EXPECTED" ]; then
                        echo "警告: 期望 Node ${NODE_MAJOR_EXPECTED}.x，实际 $(node -v)"
                    fi
                '''
            }
        }

        // 测试与质检互不依赖，并行执行
        stage('测试与质检') {
            parallel {
                stage('单元测试') {
                    steps {
                        sh 'node --test tests/*.js'
                    }
                }

                stage('语法检查') {
                    steps {
                        sh '''
                            set -e
                            find src tests -type f -name '*.js' -print0 \
                              | xargs -0 -n1 node --check
                            echo "语法检查通过"
                        '''
                    }
                }
            }
        }

        stage('打包') {
            steps {
                sh '''
                    set -e
                    test -f manifest.json
                    python3 -m json.tool manifest.json > /dev/null
                    for d in src icons docs; do test -d "$d"; done
                    test -f privacy-policy.html

                    rm -f llm-chrome-extension.zip
                    zip -qr llm-chrome-extension.zip \
                        manifest.json src icons docs privacy-policy.html \
                        -x '*.DS_Store'
                    test -s llm-chrome-extension.zip
                    echo "产物大小: $(du -h llm-chrome-extension.zip | cut -f1)"
                '''
                // 归档后可在 Jenkins 网页上直接下载，这是 Jenkins 比较顺手的一点
                archiveArtifacts artifacts: 'llm-chrome-extension.zip', fingerprint: true
            }
        }

        stage('等待审批') {
            // 不用 when { branch 'main' }：那个条件依赖 BRANCH_NAME 变量，
            // 只有多分支流水线才会注入，普通 Pipeline 任务里恒为空 -> 阶段永远被跳过。
            // 本任务在 config.xml 里已限定只构建 */main，无需再判断。
            options {
                // 不设超时的话，无人处理的构建会一直占着执行器
                timeout(time: 30, unit: 'MINUTES')
            }
            steps {
                // input 是 Jenkins 内置的人工闸门：流水线就地暂停，
                // Stage View 里该格变成待办，点进去有「批准 / 中止」按钮。
                // 这正是 GitHub 免费套餐做不到、只能用独立手动工作流绕开的能力。
                //
                // 注意：input 期间仍占用一个执行器（因为顶层是 agent any，
                // 各阶段共享同一工作区，打包产物要留到发布阶段用）。
                // 单机 Jenkins 执行器充裕，这个代价可接受。
                input message: '确认发布到 Gitea Releases？', ok: '批准发布'
            }
        }

        stage('发布到 Gitea Releases') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'gitea-token',
                    usernameVariable: 'GITEA_USER',
                    passwordVariable: 'GITEA_TOKEN')]) {
                    // 单引号 sh 块：令牌不会被 Groovy 插值，不会出现在构建日志里
                    sh '''
                        set -eu
                        API=http://100.69.54.118:3000/api/v1/repos/raowenjie/llm-chrome-extension

                        VERSION=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
                        # tag 必须精确等于 manifest 版本号：release.yml 会校验二者一致，
                        # 之前加 -build.N 后缀导致该校验失败。
                        # 代价是同一版本只能发一次，所以下面先查重复。
                        TAG="v${VERSION}"
                        echo "目标 tag: ${TAG}"

                        EXISTING=$(curl -sS "${API}/releases/tags/${TAG}" \
                            -H "Authorization: token ${GITEA_TOKEN}" \
                            -o /dev/null -w "%{http_code}")
                        if [ "$EXISTING" = "200" ]; then
                            echo "已存在 ${TAG} 的 release，说明 manifest.json 版本号未变更。"
                            echo "要发布新版本，请先提升 manifest.json 里的 version。"
                            exit 0
                        fi

                        # 上一个 tag 到现在的提交，作为发布说明
                        PREV=$(git describe --tags --abbrev=0 2>/dev/null || true)
                        if [ -n "$PREV" ]; then
                            NOTES=$(git log --pretty=format:'- %s (%h)' "${PREV}..HEAD" | head -30)
                            RANGE="自 ${PREV} 以来的变更"
                        else
                            NOTES=$(git log --pretty=format:'- %s (%h)' -20)
                            RANGE="最近的变更"
                        fi
                        [ -z "$NOTES" ] && NOTES="- 无代码变更"
                        echo "发布说明基于: ${RANGE}"

                        # 用 python 构造 JSON：发布说明是多行文本，shell 手工转义极易出错
                        export TAG VERSION NOTES RANGE
                        python3 > /tmp/release_payload.json <<'PYEOF'
import json, os
body = "\n".join([
    f"### {os.environ['RANGE']}",
    "",
    os.environ["NOTES"],
    "",
    "---",
    f"由 Jenkins 流水线构建，经人工审批发布。构建 #{os.environ.get('BUILD_NUMBER','?')}",
])
print(json.dumps({
    "tag_name": os.environ["TAG"],
    "target_commitish": "main",
    "name": os.environ["VERSION"],
    "body": body,
    "draft": False,
    "prerelease": False,
}, ensure_ascii=False))
PYEOF

                        RESP=$(curl -sS -X POST "${API}/releases" \
                            -H "Authorization: token ${GITEA_TOKEN}" \
                            -H "Content-Type: application/json" \
                            --data-binary @/tmp/release_payload.json)
                        rm -f /tmp/release_payload.json

                        ID=$(printf '%s' "$RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
if 'id' not in d:
    print('创建 release 失败:', d.get('message', d), file=sys.stderr)
    sys.exit(1)
print(d['id'])
")
                        echo "release id: ${ID}"

                        curl -sS -X POST "${API}/releases/${ID}/assets?name=llm-chrome-extension.zip" \
                            -H "Authorization: token ${GITEA_TOKEN}" \
                            -F "attachment=@llm-chrome-extension.zip" \
                            -o /dev/null

                        echo "已发布: http://100.69.54.118:3000/raowenjie/llm-chrome-extension/releases/tag/${TAG}"
                    '''
                }
            }
        }
    }

    post {
        always {
            // 不清工作区的话，磁盘会随构建次数持续增长
            cleanWs()
        }
        success {
            echo '流水线通过'
        }
        failure {
            echo '流水线失败，检查上方阶段日志'
        }
    }
}
