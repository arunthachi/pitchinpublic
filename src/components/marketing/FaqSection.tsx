export interface FaqItem {
  question: string;
  answer: string;
}

interface FaqSectionProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  items: readonly FaqItem[];
}

export function FaqSection({
  eyebrow = 'Questions, answered',
  title = 'What to know before you request access.',
  description,
  items,
}: FaqSectionProps) {
  return (
    <section className="border-t border-white/10 px-4 py-16 sm:px-6 lg:px-8 lg:py-24" aria-labelledby="faq-heading">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.72fr_1.28fr]">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-neon-lime">{eyebrow}</p>
          <h2 id="faq-heading" className="mt-3 text-balance font-heading text-3xl font-black sm:text-4xl">
            {title}
          </h2>
          {description ? <p className="mt-4 max-w-xl leading-7 text-slate-400">{description}</p> : null}
        </div>
        <div className="divide-y divide-white/10 border-y border-white/10">
          {items.map((item) => (
            <details key={item.question} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 font-heading text-lg font-bold text-white marker:content-none">
                {item.question}
                <span aria-hidden="true" className="text-2xl font-light text-neon-cyan group-open:rotate-45">+</span>
              </summary>
              <p className="max-w-3xl pb-5 pr-10 leading-7 text-slate-300">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
