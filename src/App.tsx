import type { ReactElement } from "react";
import type { Stage } from "./lib/core/stage/index.ts";
import { StageView } from "./main/stage/StageView.tsx";

interface AppProps {
  stage: Stage;
}

function App({ stage }: AppProps): ReactElement {
  return (
    <>
      <h1>OpenTesela</h1>
      <StageView stage={stage} />
    </>
  );
}

export default App;
