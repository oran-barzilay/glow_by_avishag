import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import App from "@/App";

describe("Booking route runtime", () => {
  it("renders /booking without throwing", () => {
    window.history.pushState({}, "", "/booking");
    expect(() => render(<App />)).not.toThrow();
  });
});

