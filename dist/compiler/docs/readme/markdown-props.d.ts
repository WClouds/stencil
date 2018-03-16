import { MemberMeta } from '../../../declarations';
export declare class MarkdownProps {
    private rows;
    addRow(memberName: string, memberMeta: MemberMeta): void;
    toMarkdown(): string[];
}
