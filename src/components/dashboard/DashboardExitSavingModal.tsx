import type { JSX } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import DashboardModalFrame from "./DashboardModalFrame";

export default function DashboardExitSavingModal(): JSX.Element {
  const { t } = useTranslation();

  return (
    <DashboardModalFrame maxWidthClassName="max-w-sm">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
        <h3 className="mt-4 text-lg font-heading font-bold uppercase tracking-wide text-gray-900 dark:text-white">
          {t("exitConfirm.savingTitle")}
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {t("exitConfirm.savingMessage")}
        </p>
      </div>
    </DashboardModalFrame>
  );
}
