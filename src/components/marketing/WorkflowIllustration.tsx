export interface WorkflowStep {
  label: string;
  title: string;
  description: string;
}

interface WorkflowIllustrationProps {
  steps: readonly WorkflowStep[];
  caption?: string;
}

export function WorkflowIllustration({ steps, caption = 'Illustrative product workflow' }: WorkflowIllustrationProps) {
  return (
    <figure className="glass-panel rounded-[2rem] p-5 sm:p-7">
      <figcaption className="mb-6 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
        {caption}
      </figcaption>
      <ol className="grid gap-3 sm:grid-cols-2">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-2xl border border-white/10 bg-black/35 p-5">
            <div className="flex items-center justify-between gap-4">
              <span className="rounded-full border border-neon-cyan/25 bg-neon-cyan/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-neon-cyan">
                {step.label}
              </span>
              <span className="font-heading text-sm font-black text-slate-600">0{index + 1}</span>
            </div>
            <h3 className="mt-5 font-heading text-xl font-black text-white">{step.title}</h3>
            <p className="mt-2 leading-7 text-slate-400">{step.description}</p>
          </li>
        ))}
      </ol>
    </figure>
  );
}
