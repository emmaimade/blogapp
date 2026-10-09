import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';

interface FaqListProps {
  faqs: { question: string; answer: string }[];
}

export const FaqList = ({ faqs }: FaqListProps) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const id = useId();

  return (
    <div className="w-full overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-sm">
      {faqs.map((faq, index) => {
        const isOpen = openIndex === index;
        const panelId = `${id}-panel-${index}`;
        return (
          <div key={faq.question} className="border-b border-zinc-100 last:border-b-0">
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left hover:bg-zinc-50 transition-colors"
              >
                <span className="text-lg font-medium text-zinc-900">{faq.question}</span>
                <ChevronDown
                  size={18}
                  aria-hidden="true"
                  className={`flex-shrink-0 text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </h3>
            <div id={panelId} hidden={!isOpen} className="px-6 pb-5 pt-0">
              <p className="text-zinc-600 leading-relaxed">{faq.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
