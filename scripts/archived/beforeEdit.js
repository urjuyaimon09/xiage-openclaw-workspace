#!/usr/bin/env node
/**
 * beforeEdit.js - 核心文档修改前检查 + 自动存档
 *
 * 用法: node beforeEdit.js <目标文件路径>
 *
 * 检查目标文件是否是宪法级核心文档：
 *   - 核心文档：自动存档旧版本到 old-versions/，再通过
 *   - 非核心文档：直接通过
 */

const fs = require('fs');
const path = require('path');

const DOC_RULES_PATH = path.join(__dirname, 'DOC_RULES.md');
const LOG_PATH = path.join(__dirname, 'rules-execution-log.jsonl');
const OLD_VERSIONS_DIR = path.join(__dirname, 'old-versions');

function getCoreDocuments() {
    try {
        const content = fs.readFileSync(DOC_RULES_PATH, 'utf8');
        const sectionMatch = content.match(/### 2\.1 宪法级核心文档\n([\s\S]*?)(?=### |\n## |\n# )/);
        if (!sectionMatch) return [];
        const matches = sectionMatch[1].match(/`([^`]+\.md)`/g) || [];
        return matches.map(m => m.replace(/`/g, ''));
    } catch (e) {
        return [];
    }
}

function getCurrentVersion(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const versionMatches = content.match(/^\| (v[\d.]+) \|/gm);
        if (!versionMatches || versionMatches.length === 0) return null;
        const lastMatch = versionMatches[versionMatches.length - 1];
        return lastMatch.match(/\| (v[\d.]+) \|/)[1];
    } catch (e) {
        return null;
    }
}

function archiveOldVersion(targetFile) {
    const fileName = path.basename(targetFile);
    const version = getCurrentVersion(targetFile) || 'unknown';
    if (!fs.existsSync(OLD_VERSIONS_DIR)) {
        fs.mkdirSync(OLD_VERSIONS_DIR, { recursive: true });
    }
    const archivePath = path.join(OLD_VERSIONS_DIR, fileName + '-' + version + '.md');
    fs.writeFileSync(archivePath, fs.readFileSync(targetFile, 'utf8'), 'utf8');
    return { archivePath, version };
}

function logResult(targetFile, result, note) {
    const entry = {
        t: new Date().toISOString(),
        rule: '核心文档修改前检查+自动存档',
        file: path.basename(targetFile),
        result,
        note
    };
    fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n', 'utf8');
}

function check(targetFile) {
    const coreDocs = getCoreDocuments();
    const fileName = path.basename(targetFile);
    const isCore = coreDocs.includes(fileName);
    if (!isCore) return { intercept: false, reason: 'not-core' };

    const { archivePath, version } = archiveOldVersion(targetFile);
    logResult(targetFile, 'archived', '存档至 ' + archivePath);
    console.log('\u2705 核心文档 ' + fileName + '，已自动存档旧版本 ' + version + ' -> ' + archivePath);
    return { intercept: false, reason: 'core-doc-archived', archivePath, version };
}

const targetFile = process.argv[2];
if (!targetFile) {
    console.error('用法: node beforeEdit.js <目标文件路径>');
    process.exit(1);
}

const result = check(targetFile);
if (result.intercept) {
    console.log('\u26a0 ' + result.message);
} else {
    const base = path.basename(targetFile);
    if (result.reason === 'core-doc-archived') {
        console.log('\u2705 ' + base + ' 检查通过（已存档 ' + result.version + '），可以执行 edit。');
    } else {
        console.log('\u2705 ' + base + ' 非核心文档，直接放行。');
    }
}
process.exit(0);
