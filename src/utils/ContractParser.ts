import { ContractInfo } from '../config/DynamicConfigLoader';

export class ContractParser {
  static parseContract(contractCode: string): ContractInfo {
    const contractName = this.extractContractName(contractCode);
    const stateVariables = this.extractStateVariables(contractCode);
    const functions = this.extractFunctions(contractCode);
    
    return {
      contractName,
      stateVariables,
      functions
    };
  }
  
  private static extractContractName(code: string): string {
    const contractMatch = code.match(/contract\s+(\w+)/);
    return contractMatch ? contractMatch[1] : 'UnknownContract';
  }
  
  private static extractStateVariables(code: string): Array<{name: string, type: string, visibility: string}> {
    const variables: Array<{name: string, type: string, visibility: string}> = [];
    
    // 匹配状态变量声明
    const variableRegex = /(?:^|\n)\s*(?:(public|private|internal)\s+)?(\w+(?:\[\]|\s*\[\s*\w*\s*\])*|mapping\s*\([^)]+\)\s*(?:=>\s*\w+)*)\s+(\w+)(?:\s*=\s*[^;]+)?;/gm;
    
    let match;
    while ((match = variableRegex.exec(code)) !== null) {
      const visibility = match[1] || 'internal';
      const type = match[2].trim();
      const name = match[3];
      
      // 过滤掉函数内的局部变量
      if (!this.isInsideFunction(code, match.index)) {
        variables.push({ name, type, visibility });
      }
    }
    
    return variables;
  }
  
  private static extractFunctions(code: string): Array<{name: string, parameters: string[], visibility: string}> {
    const functions: Array<{name: string, parameters: string[], visibility: string}> = [];
    
    // 匹配函数声明
    const functionRegex = /function\s+(\w+)\s*\(([^)]*)\)[^{]*(?:public|private|internal|external)?[^{]*\{/g;
    
    let match;
    while ((match = functionRegex.exec(code)) !== null) {
      const name = match[1];
      const parametersStr = match[2].trim();
      const parameters = parametersStr ? parametersStr.split(',').map(p => p.trim()) : [];
      
      // 提取可见性
      const visibility = this.extractFunctionVisibility(match[0]);
      
      functions.push({ name, parameters, visibility });
    }
    
    return functions;
  }
  
  private static extractFunctionVisibility(functionDeclaration: string): string {
    if (functionDeclaration.includes('public')) return 'public';
    if (functionDeclaration.includes('external')) return 'external';
    if (functionDeclaration.includes('private')) return 'private';
    return 'internal';
  }
  
  private static isInsideFunction(code: string, position: number): boolean {
    // 简单检查：在position之前是否有未闭合的函数
    const beforePosition = code.substring(0, position);
    const functionStarts = (beforePosition.match(/function\s+\w+[^{]*\{/g) || []).length;
    const functionEnds = (beforePosition.match(/\}/g) || []).length;
    
    return functionStarts > functionEnds;
  }
}