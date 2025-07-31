import { MaterialItem } from './ProgressManager';
export interface MaterialContent {
    id: string;
    name: string;
    type: string;
    content: string;
    filePath: string;
}
export declare class MaterialReader {
    readMaterial(material: MaterialItem): Promise<MaterialContent[]>;
    private readContract;
    private readDocument;
    private readFolder;
    private isSupportedFile;
    private getFileType;
    static validateMaterialPaths(materials: MaterialItem[]): string[];
}
//# sourceMappingURL=MaterialReader.d.ts.map