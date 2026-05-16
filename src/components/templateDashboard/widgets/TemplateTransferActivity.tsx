import { ChevronRight, Newspaper, Shield } from "lucide-react";
import { TemplateCard, TemplateCardHeader } from "../Card";

export interface TemplateTransferActivityItem {
  id: string;
  name: string;
  pos: string;
  from: string;
  fee: string;
}

interface TemplateTransferActivityProps {
  items: TemplateTransferActivityItem[];
  onViewAllTransfers?: () => void;
}

export function TemplateTransferActivity({ items, onViewAllTransfers }: TemplateTransferActivityProps) {
  return (
    <TemplateCard className="flex flex-col h-full">
      <TemplateCardHeader title="TRANSFER ACTIVITY" />
      <div className="flex-1 flex flex-col justify-center p-4 py-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-app-text-muted text-xs">
            <Newspaper className="w-8 h-8 text-app-border" />
            <span>No activity available.</span>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-3 border-b border-app-border/30 last:border-0 hover:bg-white/5 transition-colors -mx-4 px-4">
              <div className="w-8 h-8 rounded-full bg-app-bg border border-app-border flex items-center justify-center shrink-0">
                <Newspaper className="w-4 h-4 text-app-green" />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-xs font-semibold text-app-text truncate">{item.name}</span>
                <span className="text-[10px] text-app-text-muted truncate">{item.pos}</span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <Shield className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[10px] text-app-text-muted truncate hidden sm:block w-16">{item.from}</span>
              </div>
              <div className="bg-[#5b75a1]/20 text-[#8baae0] px-2 py-1 rounded text-[10px] font-bold shrink-0">
                {item.fee}
              </div>
            </div>
          ))
        )}
      </div>
      <button type="button" onClick={onViewAllTransfers} className="h-10 border-t border-app-border/50 flex items-center justify-center gap-2 text-[11px] font-semibold text-app-green hover:bg-app-green/5 transition-colors">
        <span>View All Transfers</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </TemplateCard>
  );
}
