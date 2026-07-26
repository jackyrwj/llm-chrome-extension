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

pipeline {
    agent any

    options {
        timestamps()
        // 只留最近 20 次构建，避免磁盘被日志和产物撑满
        buildDiscarder(logRotator(numToKeepStr: '20'))
        timeout(time: 15, unit: 'MINUTES')
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
