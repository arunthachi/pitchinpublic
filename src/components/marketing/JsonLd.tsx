import { serializeJsonLd, type JsonLdValue } from '@/lib/structured-data';

interface JsonLdProps {
  data: JsonLdValue;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
