import type { ReactElement } from "react";
import type { Stage } from "./lib/core/stage/index.ts";
import { AppHeader } from "./main/AppHeader.tsx";
import { StageView } from "./main/stage/StageView.tsx";
import type { AppTheme } from "./main/theme/app_theme.ts";
import "./main/app.css";

interface AppProps {
  stage: Stage;
  appTheme: AppTheme;
}

function App({ stage, appTheme }: AppProps): ReactElement {
  return (
    <>
      <AppHeader appTheme={appTheme} />
      <StageView stage={stage} />
    </>
  );
}

export default App;
