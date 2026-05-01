import { describe, expect, it } from "vitest";

import css from "./App.css?raw";

describe("App CSS table layout", () => {
  it("keeps the Runner Log subject cell as a native table cell", () => {
    const subjectCellRules = [...css.matchAll(/(?<selector>[^{}]+){(?<body>[^{}]*)}/g)]
      .filter((match) => match.groups?.selector.includes(".runner-subject-cell"))
      .map((match) => match.groups?.body ?? "");

    expect(subjectCellRules.join("\n")).not.toContain("display:");
  });
});
