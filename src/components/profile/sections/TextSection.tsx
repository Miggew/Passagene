import type { TextSectionContent } from '@/lib/types';

interface TextSectionProps {
  content: TextSectionContent;
}

export default function TextSection({ content }: TextSectionProps) {
  if (!content.body) return null;

  return (
    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
      {content.body}
    </p>
  );
}
