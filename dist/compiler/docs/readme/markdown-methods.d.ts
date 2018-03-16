import { MemberMeta } from '../../../declarations';
export declare class MarkdownMethods {
    private rows;
    addRow(memberName: string, memberMeta: MemberMeta): void;
    toMarkdown(): string[];
}
