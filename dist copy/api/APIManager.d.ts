import { APIConfig } from '../types';
export declare class APIManager {
    private config;
    constructor(config: APIConfig);
    callAPI(prompt: string, agent?: string): Promise<string>;
    private makeAPICall;
    private buildRequestBody;
    private extractResponseContent;
    private is429Error;
    private calculateBackoff;
    private sleep;
}
//# sourceMappingURL=APIManager.d.ts.map