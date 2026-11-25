import { CASE_NAME } from "./cases.ts";

export default function registerTests(t: (name: string) => void): void {
  t(CASE_NAME);
}
