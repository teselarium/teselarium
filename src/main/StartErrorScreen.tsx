import type { ReactElement } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/vendor/shadcn/ui/alert.tsx";

interface StartErrorScreenProps {
  /** The section registry's rule errors (`validateRegistry`). */
  registryErrors: readonly string[];
  /** The app catalog's errors (`resolveAppCatalog`). */
  catalogErrors: readonly string[];
}

interface StartErrorGroupProps {
  title: string;
  errors: readonly string[];
}

function renderError(error: string): ReactElement {
  return <li key={error}>{error}</li>;
}

/** One alert: the title of what is invalid, and each of its errors. Nothing without errors. */
function StartErrorGroup({
  title,
  errors,
}: StartErrorGroupProps): ReactElement | null {
  if (errors.length === 0) {
    return null;
  }
  const items: ReactElement[] = [];
  for (const error of errors) {
    items.push(renderError(error));
  }
  return (
    <Alert variant="destructive" className="border-destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">{items}</ul>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Shown instead of the app when the section registry or the app catalog
 * breaks a rule: a mistake of whoever set them, so it fails loudly, with the
 * errors of each under its own title, each naming its section or entry.
 */
export function StartErrorScreen({
  registryErrors,
  catalogErrors,
}: StartErrorScreenProps): ReactElement {
  return (
    <main className="flex flex-col gap-4 p-4">
      <StartErrorGroup
        title="The app cannot start: the section registry is invalid"
        errors={registryErrors}
      />
      <StartErrorGroup
        title="The app cannot start: the app catalog is invalid"
        errors={catalogErrors}
      />
    </main>
  );
}
