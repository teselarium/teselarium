import type { ReactElement } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/vendor/shadcn/ui/alert.tsx";

interface RegistryErrorScreenProps {
  errors: readonly string[];
}

function renderError(error: string): ReactElement {
  return <li key={error}>{error}</li>;
}

/**
 * Shown instead of the app when the section registry breaks a rule: a
 * mistake of whoever edited it, so it fails loudly and names each section.
 */
export function RegistryErrorScreen({
  errors,
}: RegistryErrorScreenProps): ReactElement {
  const items: ReactElement[] = [];
  for (const error of errors) {
    items.push(renderError(error));
  }
  return (
    <main className="p-4">
      <Alert variant="destructive" className="border-destructive">
        <AlertTitle>
          The app cannot start: the section registry is invalid
        </AlertTitle>
        <AlertDescription>
          <ul className="list-disc pl-4">{items}</ul>
        </AlertDescription>
      </Alert>
    </main>
  );
}
