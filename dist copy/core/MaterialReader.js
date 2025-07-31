"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaterialReader = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class MaterialReader {
    async readMaterial(material) {
        console.log(`正在读取资料: ${material.name} (${material.path})`);
        switch (material.type) {
            case 'contract':
                return await this.readContract(material);
            case 'document':
                return await this.readDocument(material);
            case 'folder':
                return await this.readFolder(material);
            default:
                throw new Error(`Unsupported material type: ${material.type}`);
        }
    }
    async readContract(material) {
        if (!fs_1.default.existsSync(material.path)) {
            console.warn(`合约文件不存在: ${material.path}`);
            return [];
        }
        const content = fs_1.default.readFileSync(material.path, 'utf-8');
        return [{
                id: material.id,
                name: material.name,
                type: 'solidity',
                content,
                filePath: material.path
            }];
    }
    async readDocument(material) {
        if (!fs_1.default.existsSync(material.path)) {
            console.warn(`文档文件不存在: ${material.path}`);
            return [];
        }
        const content = fs_1.default.readFileSync(material.path, 'utf-8');
        const ext = path_1.default.extname(material.path).toLowerCase();
        let type = 'text';
        if (ext === '.md')
            type = 'markdown';
        else if (ext === '.txt')
            type = 'text';
        else if (ext === '.json')
            type = 'json';
        return [{
                id: material.id,
                name: material.name,
                type,
                content,
                filePath: material.path
            }];
    }
    async readFolder(material) {
        if (!fs_1.default.existsSync(material.path)) {
            console.warn(`文件夹不存在: ${material.path}`);
            return [];
        }
        const results = [];
        try {
            const items = fs_1.default.readdirSync(material.path, { withFileTypes: true });
            let fileIndex = 1;
            for (const item of items) {
                const fullPath = path_1.default.join(material.path, item.name);
                if (item.isFile()) {
                    const ext = path_1.default.extname(item.name).toLowerCase();
                    // 只处理支持的文件类型
                    if (this.isSupportedFile(ext)) {
                        try {
                            const content = fs_1.default.readFileSync(fullPath, 'utf-8');
                            results.push({
                                id: `${material.id}-${fileIndex.toString().padStart(3, '0')}`,
                                name: `${material.name} - ${item.name}`,
                                type: this.getFileType(ext),
                                content,
                                filePath: fullPath
                            });
                            fileIndex++;
                        }
                        catch (error) {
                            console.warn(`无法读取文件 ${fullPath}:`, error);
                        }
                    }
                }
                else if (item.isDirectory()) {
                    // 递归读取子目录
                    const subMaterial = {
                        id: `${material.id}-sub-${item.name}`,
                        type: 'folder',
                        name: `${material.name} - ${item.name}`,
                        path: fullPath,
                        priority: material.priority,
                        completed: false
                    };
                    const subResults = await this.readFolder(subMaterial);
                    results.push(...subResults);
                }
            }
            console.log(`从文件夹 ${material.path} 读取了 ${results.length} 个文件`);
        }
        catch (error) {
            console.error(`读取文件夹 ${material.path} 时出错:`, error);
        }
        return results;
    }
    isSupportedFile(ext) {
        const supportedExtensions = [
            '.sol', // Solidity合约
            '.md', // Markdown文档
            '.txt', // 文本文件
            '.json', // JSON文件
            '.js', // JavaScript (可能包含合约交互逻辑)
            '.ts', // TypeScript
            '.py' // Python脚本
        ];
        return supportedExtensions.includes(ext);
    }
    getFileType(ext) {
        const typeMap = {
            '.sol': 'solidity',
            '.md': 'markdown',
            '.txt': 'text',
            '.json': 'json',
            '.js': 'javascript',
            '.ts': 'typescript',
            '.py': 'python'
        };
        return typeMap[ext] || 'text';
    }
    static validateMaterialPaths(materials) {
        const errors = [];
        for (const material of materials) {
            if (!fs_1.default.existsSync(material.path)) {
                errors.push(`材料 ${material.id} (${material.name}) 的路径不存在: ${material.path}`);
            }
        }
        return errors;
    }
}
exports.MaterialReader = MaterialReader;
//# sourceMappingURL=MaterialReader.js.map