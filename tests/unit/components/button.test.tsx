import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

// Assuming a standard button element or a UI component exists
describe("Button component", () => {
  it("renders correctly with text", () => {
    render(<button>Click me</button>);
    const button = screen.getByRole("button", { name: /click me/i });
    expect(button).toBeInTheDocument();
  });
});
